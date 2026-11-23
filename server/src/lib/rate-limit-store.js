/**
 * Storage for the rate limits (bolt 004). The limiter policy (what to limit, the messages, the
 * exemptions, the response codes) lives in middleware/rate-limit.js; this module only counts.
 *
 * A store has two operations, `consume` and `refund`:
 *
 *   consume({ namespace, key, limit, windowMs })
 *     -> { allowed, limit, remaining, retryAfterSeconds }
 *     Count one attempt for `key` in the current fixed window. `allowed` is false once more than `limit`
 *     attempts have been counted in that window; `retryAfterSeconds` is the time until the window resets.
 *   refund({ namespace, key })
 *     Take back one counted attempt (used for "failures only" limits when an attempt succeeds).
 *
 * Two implementations:
 *   - MemoryStore: counts in this process. Synchronous, no network. Local development, unit tests, and
 *     the fallback when there is no database. On serverless hosting every instance counts on its own.
 *   - PostgresStore: counts in a table every instance shares, atomically, by the database's clock. This is
 *     what production uses (whenever DATABASE_URL is set).
 *
 * createRateLimitStore() picks one. See docs/rate-limiting.md.
 */
import { createHash } from 'node:crypto';

const SEP = '\u0000';

/** In-process counters (the original behaviour). Synchronous. */
export class MemoryStore {
  /** @param {{ now?: () => number, maxKeys?: number }} [options] */
  constructor({ now = Date.now, maxKeys = 5000 } = {}) {
    this.now = now;
    this.maxKeys = maxKeys;
    this.hits = new Map();
  }

  consume({ namespace, key, limit, windowMs }) {
    const time = this.now();
    const id = `${namespace}${SEP}${key}`;
    let entry = this.hits.get(id);
    if (!entry || time >= entry.resetAt) {
      if (this.hits.size >= this.maxKeys) {
        for (const [k, e] of this.hits) if (time >= e.resetAt) this.hits.delete(k);
        // Still full of live windows: refuse rather than grow without bound.
        if (this.hits.size >= this.maxKeys) {
          return { allowed: false, limit, remaining: 0, retryAfterSeconds: Math.ceil(windowMs / 1000) };
        }
      }
      entry = { count: 0, resetAt: time + windowMs };
      this.hits.set(id, entry);
    }
    const retryAfterSeconds = Math.ceil((entry.resetAt - time) / 1000);
    if (entry.count >= limit) return { allowed: false, limit, remaining: 0, retryAfterSeconds };
    entry.count += 1;
    return { allowed: true, limit, remaining: limit - entry.count, retryAfterSeconds };
  }

  refund({ namespace, key }) {
    const entry = this.hits.get(`${namespace}${SEP}${key}`);
    if (entry && this.now() < entry.resetAt && entry.count > 0) entry.count -= 1;
  }
}

/**
 * One atomic statement per attempt. The row is created on the first attempt of a window; later attempts
 * update it under the row lock that ON CONFLICT takes, so two instances cannot both read "9 of 10" and
 * both succeed. An expired window restarts at 1. The count is capped at limit + 1 so a flood cannot grow
 * it without bound, and `now()` is the database's clock, so instances with skewed clocks agree.
 */
export const CONSUME_SQL = `
INSERT INTO rate_limits AS r (key_hash, namespace, count, reset_at)
VALUES ($1, $2, 1, now() + make_interval(secs => $3::double precision))
ON CONFLICT (key_hash) DO UPDATE SET
  count    = CASE WHEN r.reset_at <= now() THEN 1 ELSE LEAST(r.count + 1, $4::int + 1) END,
  reset_at = CASE WHEN r.reset_at <= now() THEN now() + make_interval(secs => $3::double precision) ELSE r.reset_at END
RETURNING count, GREATEST(CEIL(EXTRACT(EPOCH FROM (reset_at - now()))), 1)::int AS retry_after`;

export const REFUND_SQL = 'UPDATE rate_limits SET count = GREATEST(count - 1, 0) WHERE key_hash = $1 AND reset_at > now()';

/** Rows whose window ended more than an hour ago are garbage. */
export const CLEANUP_SQL = "DELETE FROM rate_limits WHERE reset_at < now() - interval '1 hour'";

/** The raw key (an IP or an email) is never stored or sent in a log: only this hash is. */
export function hashKey(namespace, key) {
  return createHash('sha256').update(`${namespace}${SEP}${key}`).digest('hex');
}

/** Counters in a Postgres table shared by every API instance. */
export class PostgresStore {
  /**
   * @param {{ getPool: () => { query: Function }, ensureSchema?: () => Promise<unknown>,
   *           cleanupEveryMs?: number, now?: () => number, log?: (msg: string) => void }} options
   */
  constructor({ getPool, ensureSchema = async () => {}, cleanupEveryMs = 10 * 60_000, now = Date.now, log = console.error }) {
    this.getPool = getPool;
    this.ensureSchema = ensureSchema;
    this.cleanupEveryMs = cleanupEveryMs;
    this.now = now;
    this.log = log;
    this.lastCleanup = now();
  }

  async consume({ namespace, key, limit, windowMs }) {
    await this.ensureSchema();
    const { rows } = await this.getPool().query(CONSUME_SQL, [hashKey(namespace, key), namespace, windowMs / 1000, limit]);
    const count = Number(rows?.[0]?.count);
    const retryAfterSeconds = Number(rows?.[0]?.retry_after);
    if (!Number.isInteger(count) || !Number.isInteger(retryAfterSeconds)) {
      throw new Error('the rate limit store returned an unexpected result');
    }
    this.cleanupSometimes();
    return { allowed: count <= limit, limit, remaining: Math.max(limit - count, 0), retryAfterSeconds };
  }

  async refund({ namespace, key }) {
    await this.ensureSchema();
    await this.getPool().query(REFUND_SQL, [hashKey(namespace, key)]);
  }

  /** Delete expired rows now and then, in the background; a failure here never affects a request. */
  cleanupSometimes() {
    const time = this.now();
    if (time - this.lastCleanup < this.cleanupEveryMs) return;
    this.lastCleanup = time;
    Promise.resolve()
      .then(() => this.getPool().query(CLEANUP_SQL))
      .catch((err) => this.log(`[rate-limit] cleanup of expired rows failed: ${err?.message ?? err}`));
  }
}

let warned = false;

/**
 * Chooses the store.
 *   RATE_LIMIT_STORE=postgres|memory forces one. Unset: postgres when the API persists to a database
 *   (DATABASE_URL set, i.e. production), memory otherwise (local development, tests).
 * In production the memory store means every serverless instance counts alone, so it is allowed but never
 * silent: a warning is logged once at startup.
 *
 * @param {{ persistence: boolean, getPool?: Function, ensureSchema?: Function, env?: Record<string, string | undefined>, log?: Function }} options
 */
export function createRateLimitStore({ persistence, getPool, ensureSchema, env = process.env, log = console.warn }) {
  const choice = (env.RATE_LIMIT_STORE ?? '').trim().toLowerCase();
  if (choice && choice !== 'memory' && choice !== 'postgres') {
    throw new Error('RATE_LIMIT_STORE must be "postgres" or "memory".');
  }
  const shared = choice ? choice === 'postgres' : persistence;
  if (shared) {
    if (!persistence && !env.DATABASE_URL) throw new Error('RATE_LIMIT_STORE=postgres needs DATABASE_URL.');
    return new PostgresStore({ getPool, ensureSchema });
  }
  if (env.NODE_ENV === 'production' && !warned) {
    warned = true;
    log('[rate-limit] production is using process-local rate limit counters: each API instance counts on its own, so '
      + 'login and form limits are NOT shared across instances. Set DATABASE_URL (or RATE_LIMIT_STORE=postgres) to share them.');
  }
  return new MemoryStore();
}

/** For tests: allow the production warning to fire again. */
export function resetRateLimitWarning() {
  warned = false;
}

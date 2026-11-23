/**
 * Test helper (bolt 004): a fake pg pool that applies the same rules as the rate limit SQL
 * (src/lib/rate-limit-store.js): one atomic upsert per key, a count capped at limit + 1, a window that
 * restarts once it has ended, and a clock the "database" owns. Share one between several stores to model
 * several API instances sharing one database. The real SQL is run by test-db/rate-limit.test.js.
 */
import { CLEANUP_SQL, CONSUME_SQL, REFUND_SQL } from '../src/lib/rate-limit-store.js';

export function fakeDatabase() {
  const rows = new Map();
  const calls = [];
  const db = {
    clock: 1_000_000,
    rows,
    calls,
    failWith: null,
    pool: {
      async query(sql, params = []) {
        calls.push({ sql, params });
        if (db.failWith) throw db.failWith;
        if (sql === CONSUME_SQL) {
          const [keyHash, namespace, windowSecs, limit] = params;
          const row = rows.get(keyHash);
          let next;
          if (!row || row.resetAt <= db.clock) next = { namespace, count: 1, resetAt: db.clock + windowSecs * 1000 };
          else next = { namespace, count: Math.min(row.count + 1, limit + 1), resetAt: row.resetAt };
          rows.set(keyHash, next);
          return { rows: [{ count: next.count, retry_after: Math.max(Math.ceil((next.resetAt - db.clock) / 1000), 1) }] };
        }
        if (sql === REFUND_SQL) {
          const row = rows.get(params[0]);
          if (row && row.resetAt > db.clock) row.count = Math.max(row.count - 1, 0);
          return { rows: [] };
        }
        if (sql === CLEANUP_SQL) {
          for (const [k, r] of rows) if (r.resetAt < db.clock - 3_600_000) rows.delete(k);
          return { rows: [] };
        }
        throw new Error(`unexpected SQL: ${sql}`);
      },
    },
  };
  return db;
}

/**
 * Per-request persistence of the in-memory store in Postgres.
 *
 * Writes (and the few GETs that change state) run inside a transaction that
 * locks the `app_state` row, so they are serialised across every instance. The
 * store is reloaded only when another instance has saved a newer version, and
 * a changed store is saved and committed before the response is sent. 5xx
 * responses roll back. The snapshot is stored gzip-compressed (~100 KB instead
 * of ~1.4 MB of JSON).
 *
 * Plain reads take no lock and no transaction: one `SELECT version` decides
 * whether to reload, then the route reads the in-memory store. Turning the
 * store into JSON costs ~100-200 ms, so skipping it on reads (most requests,
 * since the floor screens poll) is the main speed win.
 */
import { gzipSync, gunzipSync } from 'node:zlib';
import { getPool, ensureTable } from './db.js';
import { serialize, restore } from './snapshot.js';

export const pack = (json) => gzipSync(json);
const unpack = (bytes) => JSON.parse(gunzipSync(bytes));

/**
 * GETs that also update stored state, so they take the locked write path:
 * listing tables or reservations refreshes the tables held for upcoming
 * bookings (syncTableHolds). Every other GET or HEAD only reads.
 */
const WRITING_READS = new Set(['/api/tables', '/api/reservations']);

export function isReadOnly(req) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;
  const path = req.originalUrl.split('?')[0].replace(/\/+$/, '');
  return !WRITING_READS.has(path);
}

let loadedVersion = null;
let queue = Promise.resolve();

/** Run tasks one at a time within this instance. */
function serial(task) {
  const run = queue.then(task, task);
  queue = run.catch(() => {});
  return run;
}

export function persistState({ key = process.env.STATE_KEY || 'main' } = {}) {
  return (req, res, next) => {
    serial(() => (isReadOnly(req) ? read(key, res, next) : handle(key, res, next))).catch(next);
  };
}

/** A read: reload the store if another instance saved since, then run the route. No lock. */
async function read(key, res, next) {
  await ensureTable();
  const pool = getPool();
  const { rows } = await pool.query('SELECT version FROM app_state WHERE key = $1', [key]);
  // The first request ever creates the row, which needs the locked path.
  if (!rows.length) return handle(key, res, next);
  const { version } = rows[0];
  if (version !== loadedVersion) {
    const { rows: saved } = await pool.query('SELECT data FROM app_state WHERE key = $1', [key]);
    restore(unpack(saved[0].data), { copy: false });
    // If a write landed between the two queries the data is newer than `version`;
    // the next request then just reloads once more.
    loadedVersion = version;
  }
  // Keep this instance's queue until the response is out, so a reload for the
  // next request can't swap the store under a route that is still reading it.
  return new Promise((resolve) => {
    res.once('finish', resolve);
    res.once('close', resolve);
    next();
  });
}

/** Lock the state row (creating it from the current store if missing). */
async function lockRow(client, key) {
  const select = () => client.query('SELECT version FROM app_state WHERE key = $1 FOR UPDATE', [key]);
  let { rows } = await select();
  if (!rows.length) {
    const inserted = await client.query(
      'INSERT INTO app_state (key, data, version) VALUES ($1, $2, 1) ON CONFLICT (key) DO NOTHING',
      [key, pack(serialize())],
    );
    ({ rows } = await select());
    if (inserted.rowCount === 1) loadedVersion = rows[0].version;
  }
  return rows[0].version;
}

async function handle(key, res, next) {
  await ensureTable();
  const client = await getPool().connect();
  // A connection that drops mid-request fails the pending query; keep the
  // process alive and discard the broken connection on release.
  let broken = null;
  const onError = (err) => { broken = err; console.error('[db] connection error', err.message ?? err); };
  client.on('error', onError);
  const release = () => {
    client.off('error', onError);
    client.release(broken ?? undefined);
  };
  let before;
  try {
    await client.query('BEGIN');
    const version = await lockRow(client, key);
    if (version !== loadedVersion) {
      const { rows } = await client.query('SELECT data FROM app_state WHERE key = $1', [key]);
      restore(unpack(rows[0].data), { copy: false });
      loadedVersion = version;
    }
    before = serialize();
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    broken ??= err;
    release();
    throw err;
  }

  async function settle(keep) {
    try {
      const after = serialize();
      let version = loadedVersion;
      if (keep && after !== before) {
        const { rows } = await client.query(
          'UPDATE app_state SET data = $2, version = version + 1, updated_at = now() WHERE key = $1 RETURNING version',
          [key, pack(after)],
        );
        version = rows[0].version;
      } else if (after !== before) {
        restore(JSON.parse(before), { copy: false });
      }
      await client.query(keep ? 'COMMIT' : 'ROLLBACK');
      loadedVersion = version;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      restore(JSON.parse(before), { copy: false });
      broken ??= err;
      throw err;
    } finally {
      release();
    }
  }

  return new Promise((resolve) => {
    const originalEnd = res.end;
    let settled = false;

    res.end = function end(...args) {
      res.end = originalEnd;
      if (settled) return originalEnd.apply(res, args);
      settled = true;
      settle(res.statusCode < 500)
        .then(() => originalEnd.apply(res, args))
        .catch((err) => {
          console.error('[persist] failed to save state', err);
          res.statusCode = 500;
          res.removeHeader('Content-Length');
          res.removeHeader('ETag');
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          originalEnd.call(res, JSON.stringify({ error: 'Could not save changes. Please try again.' }));
        })
        .finally(resolve);
      return res;
    };

    // Client went away before a response: discard any changes.
    res.once('close', () => {
      if (settled) return;
      settled = true;
      res.end = originalEnd;
      settle(false).catch(() => {}).finally(resolve);
    });

    next();
  });
}

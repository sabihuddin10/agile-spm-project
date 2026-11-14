/**
 * Per-request persistence of the in-memory store in the relational tables.
 *
 * Each request runs inside a transaction that takes a Postgres advisory lock,
 * so requests are serialised across every instance. The store version lives in
 * `sequences` ('state_version'); the store is reloaded from the tables only
 * when another instance has saved a newer version, and a changed store is
 * written to the tables and committed before the response is sent. 5xx
 * responses roll back.
 */
import { getPool, ensureSchema } from './db.js';
import { snapshot, restore } from './snapshot.js';
import { saveStore, loadStore } from './relational/index.js';

/** Arbitrary constant shared by every instance for pg_advisory_xact_lock. */
const LOCK_KEY = 727274;

let loadedVersion = null;
let queue = Promise.resolve();

/** Run tasks one at a time within this instance. */
function serial(task) {
  const run = queue.then(task, task);
  queue = run.catch(() => {});
  return run;
}

export function persistState() {
  return (req, res, next) => {
    serial(() => handle(res, next)).catch(next);
  };
}

/** Take the global lock and read the store version (seeding empty tables from the current store). */
async function lock(client) {
  await client.query('SELECT pg_advisory_xact_lock($1)', [LOCK_KEY]);
  const { rows } = await client.query("SELECT last_value::int AS version FROM sequences WHERE name = 'state_version'");
  if (rows.length) return rows[0].version;
  await saveStore(client, snapshot());
  await client.query("INSERT INTO sequences (name, last_value) VALUES ('state_version', 1)");
  loadedVersion = 1;
  return 1;
}

async function handle(res, next) {
  await ensureSchema();
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
    const version = await lock(client);
    if (version !== loadedVersion) {
      restore(await loadStore(client));
      loadedVersion = version;
    }
    before = JSON.stringify(snapshot());
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    broken ??= err;
    release();
    throw err;
  }

  async function settle(keep) {
    try {
      const after = JSON.stringify(snapshot());
      let version = loadedVersion;
      if (keep && after !== before) {
        await saveStore(client, JSON.parse(after));
        const { rows } = await client.query(
          "UPDATE sequences SET last_value = last_value + 1 WHERE name = 'state_version' RETURNING last_value::int AS version",
        );
        version = rows[0].version;
      } else if (after !== before) {
        restore(JSON.parse(before));
      }
      await client.query(keep ? 'COMMIT' : 'ROLLBACK');
      loadedVersion = version;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      restore(JSON.parse(before));
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
          res.removeHeader('Set-Cookie');
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

/**
 * Bind the super admin on a database (scripts/superadmin.js), with the same
 * protocol as persist.js: one transaction under the global advisory lock; the
 * store is loaded from the tables (or, before the server's first request, taken
 * from the seed), bound, saved, and state_version is bumped so running
 * instances reload it on their next request. Anything that throws rolls back.
 */
import { LOCK_KEY } from './persist.js';
import { snapshot, restore } from './snapshot.js';
import { saveStore, loadStore } from './relational/index.js';
import { bindSuperadmin } from '../lib/superadmin.js';

/** Returns bindSuperadmin's result plus the new store `version`. */
export async function bindInDatabase(pool, options) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [LOCK_KEY]);
    const { rows } = await client.query("SELECT 1 FROM sequences WHERE name = 'state_version'");
    if (rows.length) restore(await loadStore(client));
    const result = bindSuperadmin(options);
    await saveStore(client, snapshot());
    const bumped = await client.query(
      "INSERT INTO sequences (name, last_value) VALUES ('state_version', 1) ON CONFLICT (name) DO UPDATE SET last_value = sequences.last_value + 1 RETURNING last_value::int AS version",
    );
    await client.query('COMMIT');
    return { ...result, version: bumped.rows[0].version };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

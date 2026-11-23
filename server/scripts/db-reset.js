/**
 * Overwrite the persisted store with freshly seeded demo data (`npm run db:reset`).
 * Rewrites the relational tables and bumps the store version so running
 * instances reload it on their next request.
 */
import 'dotenv/config';
import { getPool, ensureSchema } from '../src/data/db.js';
import { snapshot } from '../src/data/snapshot.js';
import { saveStore } from '../src/data/relational/index.js';

await ensureSchema();
const client = await getPool().connect();
try {
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(727274)');
  await saveStore(client, snapshot());
  const { rows } = await client.query(
    "INSERT INTO sequences (name, last_value) VALUES ('state_version', 1) ON CONFLICT (name) DO UPDATE SET last_value = sequences.last_value + 1 RETURNING last_value",
  );
  await client.query('COMMIT');
  console.log(`[db:reset] tables reseeded (version ${rows[0].last_value})`);
} catch (err) {
  await client.query('ROLLBACK');
  throw err;
} finally {
  client.release();
  await getPool().end();
}

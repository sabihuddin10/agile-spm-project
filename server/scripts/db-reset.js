/**
 * Overwrite the persisted store with freshly seeded demo data (`npm run db:reset`).
 * Bumps the version so running instances reload it on their next request.
 */
import 'dotenv/config';
import { getPool, ensureTable } from '../src/data/db.js';
import { pack } from '../src/data/persist.js';
import { snapshot } from '../src/data/snapshot.js';

const key = process.env.STATE_KEY || 'main';
await ensureTable();
const { rows } = await getPool().query(
  `INSERT INTO app_state (key, data, version) VALUES ($1, $2, 1)
   ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, version = app_state.version + 1, updated_at = now()
   RETURNING version`,
  [key, pack(JSON.stringify(snapshot()))],
);
console.log(`[db:reset] ${key} reseeded (version ${rows[0].version})`);
await getPool().end();

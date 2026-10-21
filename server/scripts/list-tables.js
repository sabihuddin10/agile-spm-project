import 'dotenv/config';
import { createPool } from '../src/data/db.js';

const url = process.env.DATABASE_URL;
if (!url) { console.error('No DATABASE_URL'); process.exit(1); }

const pool = createPool(url);
const r = await pool.query(
  `SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`
);
console.log('Tables in your database:');
for (const t of r.rows) console.log(' -', t.table_name);
await pool.end();

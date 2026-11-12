/**
 * Schema bootstrap — data/relational/schema.js applies the schema files to a
 * real Postgres database (needs DATABASE_URL, see `npm run test:db`).
 */
import 'dotenv/config';
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createPool } from '../src/data/db.js';
import { ensureSchema } from '../src/data/relational/schema.js';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for the database tests.');
const pool = createPool(process.env.DATABASE_URL);
after(() => pool.end());

test('ensureSchema creates all 28 tables and the store-only columns, idempotently', async () => {
  // Arrange
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');

  // Act
  await ensureSchema(pool);
  await ensureSchema(pool);

  // Assert
  const { rows } = await pool.query(
    "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'",
  );
  assert.equal(rows[0].n, 28);
  const col = await pool.query(
    "SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_order_lines' AND column_name = 'supplier'",
  );
  assert.equal(col.rowCount, 1);
});

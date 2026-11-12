/**
 * SQL injection safety against a real database — a hostile-looking name is
 * stored in the relational tables and read back as plain data (needs
 * DATABASE_URL, see `npm run test:db`).
 */
import 'dotenv/config';
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createPool } from '../src/data/db.js';
import { snapshot } from '../src/data/snapshot.js';
import { ensureSchema } from '../src/data/relational/schema.js';
import { saveStore, loadStore } from '../src/data/relational/index.js';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for the database tests.');
const pool = createPool(process.env.DATABASE_URL);
after(() => pool.end());

const HOSTILE = "Robert'); DROP TABLE users;--";

test('a hostile customer name is stored and restored as plain data', async () => {
  // Arrange
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await ensureSchema(pool);
  const store = snapshot();
  store.customers[0].name = HOSTILE;

  // Act
  await saveStore(pool, store);
  const loaded = await loadStore(pool);

  // Assert
  const { rows } = await pool.query('SELECT name FROM customers WHERE ext_id = $1', [store.customers[0].id]);
  assert.equal(rows[0].name, HOSTILE);
  assert.equal(loaded.customers[0].name, HOSTILE);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM users')).rows[0].n, store.users.length);
});

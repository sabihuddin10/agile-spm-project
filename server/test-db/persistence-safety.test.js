/**
 * Persistence safety against a real Postgres (needs DATABASE_URL, see `npm run test:db`): saveStore rewrites the
 * persisted tables, so a table it does not own (rate_limits) must survive, and a table someone adds later without
 * updating the list must make the save fail loudly, never be wiped silently.
 */
import 'dotenv/config';
import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createPool } from '../src/data/db.js';
import { requireTestDatabase } from './guard.js';
import { ensureSchema } from '../src/data/relational/schema.js';
import { PERSISTED_TABLES, saveStore } from '../src/data/relational/index.js';
import { snapshot } from '../src/data/snapshot.js';

requireTestDatabase();
const pool = createPool(process.env.DATABASE_URL);

/** Tables saveStore deliberately does not own: the version counter and the shared rate limit counters. */
const NOT_PERSISTED = ['sequences', 'rate_limits'];

before(async () => {
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await ensureSchema(pool);
});

after(() => pool.end());

/** Run `work` on one connection inside a transaction that is committed on success and rolled back on failure. */
async function inTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

const count = async (table) => (await pool.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n;

test('every table in the schema is either persisted by saveStore or explicitly not', async () => {
  // Arrange
  const { rows } = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'",
  );
  const inSchema = rows.map((r) => r.table_name);

  // Act
  const unaccounted = inSchema.filter((t) => !PERSISTED_TABLES.includes(t) && !NOT_PERSISTED.includes(t));
  const listedButMissing = PERSISTED_TABLES.filter((t) => !inSchema.includes(t));

  // Assert
  assert.deepEqual(unaccounted, [], 'a table was added without deciding whether saveStore owns it');
  assert.deepEqual(listedButMissing, []);
});

test('saving the store leaves tables it does not own alone', async () => {
  // Arrange
  await pool.query("INSERT INTO rate_limits (key_hash, namespace, count, reset_at) VALUES ('survivor', 'auth-login-ip', 2, now() + interval '1 hour')");

  // Act
  await inTransaction((client) => saveStore(client, snapshot()));

  // Assert
  const survivor = await pool.query("SELECT count FROM rate_limits WHERE key_hash = 'survivor'");
  assert.equal(survivor.rowCount, 1);
  assert.ok((await count('users')) > 0, 'the persisted tables were rewritten from the store');
});

test('a table added later with a foreign key into a persisted table makes the save fail loudly instead of being wiped', async () => {
  // Arrange: a "future feature" table nobody added to the persisted list
  await pool.query('CREATE TABLE zz_future_feature (id bigserial PRIMARY KEY, user_id bigint REFERENCES users(id))');
  await pool.query('INSERT INTO zz_future_feature (user_id) SELECT min(id) FROM users');
  const usersBefore = await count('users');

  try {
    // Act
    const save = inTransaction((client) => saveStore(client, snapshot()));

    // Assert: refused, and nothing was emptied
    await assert.rejects(save, /cannot truncate a table referenced in a foreign key constraint/);
    assert.equal(await count('zz_future_feature'), 1, 'the unlisted table was not wiped');
    assert.equal(await count('users'), usersBefore, 'the failed save rolled back');
  } finally {
    await pool.query('DROP TABLE zz_future_feature');
  }
});

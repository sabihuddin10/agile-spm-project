/**
 * DB helpers — data/db.js: `ensureSchema` applies the relational schema once
 * and reuses that result, retries after a failure, and `setPool` resets it.
 * Runs against a fake pool installed with `setPool`, so it needs no database.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { Pool as NeonPool } from '@neondatabase/serverless';
import { setPool, getPool, ensureSchema, isNeonUrl, createPool } from '../../src/data/db.js';

/** Fake pool counting schema runs (the users table starts each run); `failures` makes the first N runs reject. */
function fakePool({ failures = 0 } = {}) {
  const pool = {
    creates: 0,
    async query(sql) {
      if (!sql.includes('CREATE TABLE IF NOT EXISTS users')) return { rows: [] };
      pool.creates += 1;
      await new Promise((resolve) => setImmediate(resolve));
      if (pool.creates <= failures) throw new Error('connection refused');
      return { rows: [] };
    },
  };
  return pool;
}

test('setPool installs the pool that getPool returns', () => {
  // Arrange
  const pool = fakePool();

  // Act
  setPool(pool);

  // Assert
  assert.equal(getPool(), pool);
});

test('ensureSchema applies the schema once across repeated calls', async () => {
  // Arrange
  const pool = fakePool();
  setPool(pool);

  // Act
  await ensureSchema();
  await ensureSchema();
  await ensureSchema();

  // Assert
  assert.equal(pool.creates, 1);
});

test('concurrent ensureSchema calls share one schema run', async () => {
  // Arrange
  const pool = fakePool();
  setPool(pool);

  // Act
  const calls = [ensureSchema(), ensureSchema(), ensureSchema()];
  await Promise.all(calls);

  // Assert
  assert.equal(pool.creates, 1);
  assert.equal(calls[0], calls[1]);
  assert.equal(calls[1], calls[2]);
});

test('after a failed schema run the next call retries and succeeds', async () => {
  // Arrange
  const pool = fakePool({ failures: 1 });
  setPool(pool);

  // Act
  const first = ensureSchema();

  // Assert
  await assert.rejects(first, /connection refused/);

  // Act
  await ensureSchema();
  await ensureSchema();

  // Assert
  assert.equal(pool.creates, 2);
});

test('setPool resets the memo so the new pool applies the schema again', async () => {
  // Arrange
  const oldPool = fakePool();
  setPool(oldPool);
  await ensureSchema();
  const newPool = fakePool();

  // Act
  setPool(newPool);
  await ensureSchema();

  // Assert
  assert.equal(oldPool.creates, 1);
  assert.equal(newPool.creates, 1);
});

test('isNeonUrl is true only for Neon hosts', () => {
  // Arrange
  const neon = 'postgres://u:p@ep-cool-name-123456.eu-central-1.aws.neon.tech/neondb?sslmode=require';
  const local = 'postgres://postgres:secret@localhost:5432/agspm';

  // Act
  const results = [isNeonUrl(neon), isNeonUrl(local), isNeonUrl('not a url'), isNeonUrl(undefined)];

  // Assert
  assert.deepEqual(results, [true, false, false, false]);
});

test('createPool uses the Neon driver for Neon and pg for a local Postgres', async () => {
  // Arrange
  const neonUrl = 'postgres://u:p@ep-x.eu-central-1.aws.neon.tech/neondb';
  const localUrl = 'postgres://postgres:secret@localhost:5432/agspm';

  // Act (pools connect lazily, so nothing is opened here)
  const neon = createPool(neonUrl);
  const local = createPool(localUrl, { max: 2 });

  // Assert
  assert.ok(neon instanceof NeonPool);
  assert.ok(local instanceof pg.Pool);
  assert.ok(!(local instanceof NeonPool));
  assert.equal(local.options.max, 2);
  await Promise.all([neon.end(), local.end()]);
});

/**
 * DB helpers — data/db.js: `ensureTable` creates the `app_state` table once
 * and reuses that result, retries after a failure, and `setPool` resets it.
 * Runs against a fake pool installed with `setPool`, so it needs no database.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setPool, getPool, ensureTable } from '../../src/data/db.js';

/** Fake pool counting CREATE TABLE queries; `failures` makes the first N of them reject. */
function fakePool({ failures = 0 } = {}) {
  const pool = {
    creates: 0,
    async query(sql) {
      assert.match(sql.trim(), /^CREATE TABLE IF NOT EXISTS app_state/);
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

test('ensureTable issues CREATE TABLE once across repeated calls', async () => {
  // Arrange
  const pool = fakePool();
  setPool(pool);

  // Act
  await ensureTable();
  await ensureTable();
  await ensureTable();

  // Assert
  assert.equal(pool.creates, 1);
});

test('concurrent ensureTable calls share one CREATE TABLE', async () => {
  // Arrange
  const pool = fakePool();
  setPool(pool);

  // Act
  const calls = [ensureTable(), ensureTable(), ensureTable()];
  await Promise.all(calls);

  // Assert
  assert.equal(pool.creates, 1);
  assert.equal(calls[0], calls[1]);
  assert.equal(calls[1], calls[2]);
});

test('after a failed CREATE TABLE the next call retries and succeeds', async () => {
  // Arrange
  const pool = fakePool({ failures: 1 });
  setPool(pool);

  // Act
  const first = ensureTable();

  // Assert
  await assert.rejects(first, /connection refused/);

  // Act
  await ensureTable();
  await ensureTable();

  // Assert
  assert.equal(pool.creates, 2);
});

test('setPool resets the memo so the new pool creates the table again', async () => {
  // Arrange
  const oldPool = fakePool();
  setPool(oldPool);
  await ensureTable();
  const newPool = fakePool();

  // Act
  setPool(newPool);
  await ensureTable();

  // Assert
  assert.equal(oldPool.creates, 1);
  assert.equal(newPool.creates, 1);
});

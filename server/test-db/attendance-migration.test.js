/**
 * The attendance migration (schema/006_attendance_integrity.sql) against a real Postgres (needs DATABASE_URL, see
 * `npm run test:db`). It runs every time the schema is applied, which is every API instance start, so once applied
 * it must be cheap and must not lock the attendance tables.
 */
import 'dotenv/config';
import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createPool } from '../src/data/db.js';
import { requireTestDatabase } from './guard.js';
import { ensureSchema } from '../src/data/relational/schema.js';

requireTestDatabase();
const pool = createPool(process.env.DATABASE_URL);

before(async () => {
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await ensureSchema(pool);
});

after(() => pool.end());

test('the attendance migration leaves validated constraints and only the unique open-session indexes', async () => {
  // Arrange / Act: apply the whole schema again, as every instance start does
  await ensureSchema(pool);
  await ensureSchema(pool);

  // Assert
  const constraints = await pool.query(
    "SELECT conname, convalidated FROM pg_constraint WHERE conname IN ('ck_attendance_sessions_clock_order', 'ck_attendance_breaks_time_order') ORDER BY conname",
  );
  const indexes = await pool.query(
    "SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname IN ('idx_attendance_sessions_open', 'uq_attendance_sessions_one_open', 'uq_attendance_breaks_one_open') ORDER BY indexname",
  );
  assert.deepEqual(constraints.rows.map((r) => [r.conname, r.convalidated]), [['ck_attendance_breaks_time_order', true], ['ck_attendance_sessions_clock_order', true]]);
  assert.deepEqual(indexes.rows.map((r) => r.indexname), ['uq_attendance_breaks_one_open', 'uq_attendance_sessions_one_open'],
    'the old plain index is no longer re-created on every run');
});

test('an already migrated database is not locked by the schema being applied again', async () => {
  // Arrange: another connection is reading the attendance table, which holds a lock only an exclusive lock would wait for
  const reader = await pool.connect();
  const migrator = await pool.connect();
  try {
    await reader.query('BEGIN');
    await reader.query('SELECT 1 FROM attendance_sessions LIMIT 1');
    await migrator.query("SET lock_timeout = '1500ms'");

    // Control: an exclusive lock on that table really would have to wait (so this test can detect one).
    // LOCK TABLE is only allowed inside a transaction block.
    await migrator.query('BEGIN');
    await assert.rejects(migrator.query('LOCK TABLE attendance_sessions IN ACCESS EXCLUSIVE MODE'), /lock timeout/);
    await migrator.query('ROLLBACK');

    // Act / Assert: applying the whole schema again does not wait
    await ensureSchema(migrator);
  } finally {
    await reader.query('ROLLBACK').catch(() => {});
    reader.release();
    await migrator.query("RESET lock_timeout").catch(() => {});
    migrator.release();
  }
});

test('a database that still has the old plain index (from earlier runs) loses it on the next run, once', async () => {
  // Arrange: put the old index back, as a production database that ran the previous schema has it
  await pool.query('CREATE INDEX idx_attendance_sessions_open ON attendance_sessions (user_id) WHERE clock_out IS NULL');

  // Act
  await ensureSchema(pool);
  await ensureSchema(pool);

  // Assert
  const left = await pool.query("SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_attendance_sessions_open'");
  assert.equal(left.rowCount, 0);
});

test('a fresh database still ends up with every constraint and index, and applying the schema is repeatable', async () => {
  // Arrange: start from nothing
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');

  // Act
  await ensureSchema(pool);
  await ensureSchema(pool);

  // Assert
  const found = await pool.query(
    "SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname IN ('uq_attendance_sessions_one_open', 'uq_attendance_breaks_one_open') ORDER BY indexname",
  );
  const validated = await pool.query("SELECT count(*)::int AS n FROM pg_constraint WHERE conname LIKE 'ck_attendance_%' AND convalidated");
  assert.equal(found.rowCount, 2);
  assert.equal(validated.rows[0].n, 2);
});

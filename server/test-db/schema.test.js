/**
 * Schema bootstrap — data/relational/schema.js applies the schema files to a
 * real Postgres database (needs DATABASE_URL, see `npm run test:db`).
 */
import 'dotenv/config';
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createPool } from '../src/data/db.js';
import { requireTestDatabase } from './guard.js';
import { ensureSchema } from '../src/data/relational/schema.js';

requireTestDatabase();
const pool = createPool(process.env.DATABASE_URL);
after(() => pool.end());

test('ensureSchema creates all 29 tables and the store-only columns, idempotently', async () => {
  // Arrange
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');

  // Act
  await ensureSchema(pool);
  await ensureSchema(pool);

  // Assert
  const { rows } = await pool.query(
    "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'",
  );
  assert.equal(rows[0].n, 29);
  const col = await pool.query(
    "SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_order_lines' AND column_name = 'supplier'",
  );
  assert.equal(col.rowCount, 1);
});

test('the role enum has the super admin, and the database allows at most one super admin', async () => {
  // Arrange
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await ensureSchema(pool);
  const insertSuperadmin = (ext, email) => pool.query(
    "INSERT INTO users (ext_id, name, email, role, password_hash) VALUES ($1, 'Someone', $2, 'superadmin', 'x')",
    [ext, email],
  );

  // Act
  const { rows } = await pool.query('SELECT unnest(enum_range(NULL::role))::text AS role');
  await insertSuperadmin('usr_one', 'one@example.com');
  const second = await insertSuperadmin('usr_two', 'two@example.com').catch((err) => err);

  // Assert
  assert.ok(rows.some((r) => r.role === 'superadmin'));
  assert.equal(second.code, '23505', 'a second super admin is a unique violation');
  assert.equal(second.constraint, 'uq_users_one_superadmin');
});

test('attendance tables enforce one open session/break and valid time ranges', async () => {
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await ensureSchema(pool);
  const { rows: indexes } = await pool.query(
    "SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname = ANY($1::text[])",
    [['uq_attendance_sessions_one_open', 'uq_attendance_breaks_one_open']],
  );
  assert.deepEqual(indexes.map((row) => row.indexname).sort(), [
    'uq_attendance_breaks_one_open',
    'uq_attendance_sessions_one_open',
  ]);

  const { rows: userRows } = await pool.query(
    "INSERT INTO users (name, email, role, password_hash) VALUES ('Clock Test', 'clock-test@example.com', 'waiter', 'test') RETURNING id",
  );
  const userId = userRows[0].id;
  const { rows: sessions } = await pool.query(
    `INSERT INTO attendance_sessions (user_id, date, clock_in)
     VALUES ($1, '2026-01-01', '2026-01-01T12:00:00Z') RETURNING id, clock_in`,
    [userId],
  );
  const sessionId = sessions[0].id;

  const duplicateSession = await pool.query(
    `INSERT INTO attendance_sessions (user_id, date, clock_in)
     VALUES ($1, '2026-01-01', '2026-01-01T13:00:00Z')`,
    [userId],
  ).catch((error) => error);
  assert.equal(duplicateSession.code, '23505');
  assert.equal(duplicateSession.constraint, 'uq_attendance_sessions_one_open');

  await pool.query(
    `INSERT INTO attendance_breaks (session_id, "start") VALUES ($1, '2026-01-01T12:30:00Z')`,
    [sessionId],
  );
  const duplicateBreak = await pool.query(
    `INSERT INTO attendance_breaks (session_id, "start") VALUES ($1, '2026-01-01T12:45:00Z')`,
    [sessionId],
  ).catch((error) => error);
  assert.equal(duplicateBreak.code, '23505');
  assert.equal(duplicateBreak.constraint, 'uq_attendance_breaks_one_open');

  const invalidSession = await pool.query(
    'UPDATE attendance_sessions SET clock_out = clock_in WHERE id = $1',
    [sessionId],
  ).catch((error) => error);
  assert.equal(invalidSession.code, '23514');
  assert.equal(invalidSession.constraint, 'ck_attendance_sessions_clock_order');

  const invalidBreak = await pool.query(
    'UPDATE attendance_breaks SET "end" = "start" WHERE session_id = $1',
    [sessionId],
  ).catch((error) => error);
  assert.equal(invalidBreak.code, '23514');
  assert.equal(invalidBreak.constraint, 'ck_attendance_breaks_time_order');
});

test('db:init applies every schema file before the seed, so the seeded super admin loads', async () => {
  // Arrange
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  const serverRoot = fileURLToPath(new URL('../', import.meta.url));

  // Act
  const run = spawnSync(process.execPath, ['scripts/initdb_localpg.js', `--url=${process.env.DATABASE_URL}`], {
    cwd: serverRoot, env: process.env, encoding: 'utf8',
  });
  const { rows } = await pool.query("SELECT email, role::text AS role FROM users WHERE role = 'superadmin'");

  // Assert
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(rows, [{ email: 'sabihuddin106@gmail.com', role: 'superadmin' }]);
});

test('db:init accepts the -- that `pnpm run db:init -- …` forwards', async () => {
  // Arrange
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  const serverRoot = fileURLToPath(new URL('../', import.meta.url));

  // Act
  const run = spawnSync(process.execPath, ['scripts/initdb_localpg.js', '--', `--url=${process.env.DATABASE_URL}`], {
    cwd: serverRoot, env: process.env, encoding: 'utf8',
  });

  // Assert
  assert.equal(run.status, 0, run.stderr);
});


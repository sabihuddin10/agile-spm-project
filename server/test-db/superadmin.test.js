/**
 * Binding the super admin on a database — data/superadmin.js and the
 * scripts/superadmin.js CLI (needs DATABASE_URL, see `npm run test:db`).
 */
import 'dotenv/config';
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { createPool } from '../src/data/db.js';
import { requireTestDatabase } from './guard.js';
import { ensureSchema } from '../src/data/relational/schema.js';
import { saveStore, loadStore } from '../src/data/relational/index.js';
import { snapshot, restore } from '../src/data/snapshot.js';
import { bindInDatabase } from '../src/data/superadmin.js';

requireTestDatabase();
const pool = createPool(process.env.DATABASE_URL);
after(() => pool.end());

const SERVER_DIR = fileURLToPath(new URL('..', import.meta.url));
const seed = snapshot();

/** A database holding the store seed at version 1, as the server's first request leaves it. */
async function seededDatabase() {
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await ensureSchema(pool);
  restore(seed);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await saveStore(client, snapshot());
    await client.query("INSERT INTO sequences (name, last_value) VALUES ('state_version', 1)");
    await client.query('COMMIT');
  } finally {
    client.release();
  }
}

const superadmins = async () => (await pool.query("SELECT email FROM users WHERE role = 'superadmin' ORDER BY email")).rows.map((r) => r.email);
const version = async () => (await pool.query("SELECT last_value::int AS v FROM sequences WHERE name = 'state_version'")).rows[0].v;
const PASSWORD = 'Ledger-Kite-42!';
/** Run the CLI with `input` on stdin (piped, as automation would); a leading '--' is what `pnpm run x -- …` forwards. */
const runScript = (args, input = '') => spawnSync(process.execPath, ['scripts/superadmin.js', ...args], { cwd: SERVER_DIR, env: process.env, encoding: 'utf8', input });
const passwordHashOf = async (email) => (await pool.query('SELECT password_hash FROM users WHERE email = $1', [email])).rows[0]?.password_hash;

test('binding loads the tables first, moves the role to the account, demotes the old holder and bumps the version', async () => {
  // Arrange — a change only the database knows about (another instance saved it)
  await seededDatabase();
  await pool.query("UPDATE users SET name = 'Shahan Saved Elsewhere' WHERE email = 'shahanarain33@gmail.com'");

  // Act
  const result = await bindInDatabase(pool, { email: 'shahanarain33@gmail.com', password: PASSWORD });

  // Assert
  assert.deepEqual(await superadmins(), ['shahanarain33@gmail.com']);
  assert.deepEqual(result.demoted, ['sabihuddin106@gmail.com']);
  assert.equal(result.version, 2);
  assert.equal(await version(), 2);
  const { rows } = await pool.query("SELECT name FROM users WHERE email = 'shahanarain33@gmail.com'");
  assert.equal(rows[0].name, 'Shahan Saved Elsewhere', 'the stored store was loaded, not overwritten');
});

test('binding a new email creates the account with its password, and a fresh load sees it', async () => {
  // Arrange
  await seededDatabase();

  // Act
  const result = await bindInDatabase(pool, { email: 'owner@example.com', name: 'Olive Owner', password: 'Ledger-Kite-42!' });
  const client = await pool.connect();
  let loaded;
  try {
    loaded = await loadStore(client);
  } finally {
    client.release();
  }

  // Assert
  const owner = loaded.users.find((u) => u.email === 'owner@example.com');
  assert.equal(result.created, true);
  assert.equal(owner.role, 'superadmin');
  assert.ok(bcrypt.compareSync('Ledger-Kite-42!', owner.passwordHash));
  assert.deepEqual(await superadmins(), ['owner@example.com']);
});

test('on a database the server has not used yet, binding starts from the seed at version 1', async () => {
  // Arrange
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await ensureSchema(pool);
  restore(seed);

  // Act
  const result = await bindInDatabase(pool, { email: 'sabihuddin106@gmail.com', password: PASSWORD });

  // Assert
  assert.equal(result.version, 1);
  assert.deepEqual(await superadmins(), ['sabihuddin106@gmail.com']);
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM users');
  assert.equal(rows[0].n, seed.users.length);
});

test('a refused binding leaves the database as it was', async () => {
  // Arrange
  await seededDatabase();

  // Act
  const refused = bindInDatabase(pool, { email: 'owner@example.com', name: 'Olive Owner', password: 'weak' });

  // Assert
  await assert.rejects(refused, /Password needs/);
  assert.equal(await version(), 1);
  assert.deepEqual(await superadmins(), ['sabihuddin106@gmail.com']);
});

test('the script binds an existing account with the password it is given, as pnpm runs it', async () => {
  // Arrange
  await seededDatabase();

  // Act
  const run = runScript(['--', `--url=${process.env.DATABASE_URL}`, '--email=shahanarain33@gmail.com'], `${PASSWORD}\n${PASSWORD}\n`);

  // Assert
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /shahanarain33@gmail\.com is now the super admin/);
  assert.match(run.stdout, /admin account "Shahan Arain"/, 'the operator sees which account is being promoted');
  assert.deepEqual(await superadmins(), ['shahanarain33@gmail.com']);
  assert.ok(bcrypt.compareSync(PASSWORD, await passwordHashOf('shahanarain33@gmail.com')), 'the typed password is set');
  assert.doesNotMatch(run.stdout, /Ledger-Kite/, 'the password is never printed');
});

test('the script changes nothing when the two passwords differ', async () => {
  // Arrange
  await seededDatabase();

  // Act
  const run = runScript([`--url=${process.env.DATABASE_URL}`, '--email=shahanarain33@gmail.com'], `${PASSWORD}\nLedger-Kite-43!\n`);

  // Assert
  assert.equal(run.status, 1);
  assert.match(run.stderr, /do not match/);
  assert.equal(await version(), 1);
  assert.deepEqual(await superadmins(), ['sabihuddin106@gmail.com']);
});

test('the script refuses a Neon database without --yes-really, before connecting', () => {
  // Act
  const run = runScript(['--url=postgresql://user:secret@ep-example-123456.us-east-2.aws.neon.tech/neondb?sslmode=require']);

  // Assert
  assert.equal(run.status, 1);
  assert.match(run.stderr, /--yes-really/);
  assert.doesNotMatch(`${run.stdout}${run.stderr}`, /secret/, 'the password never reaches the output');
});

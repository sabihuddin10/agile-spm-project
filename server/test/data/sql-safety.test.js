/**
 * SQL injection safety — data/db.js, data/persist.js, data/relational/ and
 * scripts/db-reset.js.
 *
 * The store lives in memory and is saved to the relational tables. These tests
 * record every statement sent to a fake pool and check that user input only
 * ever travels as a bound parameter ($1), never inside the SQL text, and that
 * table and column names can only be fixed identifiers. The round trip of a
 * hostile name through a real database is in test-db/sql-safety.test.js.
 */
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createApp } from '../../src/app.js';
import { setPool } from '../../src/data/db.js';
import { snapshot, restore } from '../../src/data/snapshot.js';
import { insertRows, selectRows } from '../../src/data/relational/sql.js';

const HOSTILE = "Robert'); DROP TABLE users;--";

/** Fake pool that records { sql, params }; the schema files are not recorded. */
function recordingPool() {
  const log = [];
  let version = null;
  async function query(sql, params = []) {
    const text = sql.replace(/\s+/g, ' ').trim();
    if (text.includes('CREATE TABLE IF NOT EXISTS') || text.startsWith('-- Columns')) return { rows: [] };
    log.push({ sql: text, params });
    if (text.startsWith('SELECT last_value')) return { rows: version === null ? [] : [{ version }] };
    if (text.startsWith("INSERT INTO sequences (name, last_value) VALUES ('state_version'")) version = 1;
    if (text.startsWith('UPDATE sequences')) return { rows: [{ version: ++version }] };
    return { rows: [] };
  }
  const client = { query, on() {}, off() {}, release() {} };
  return { pool: { query, connect: async () => client, on() {} }, log };
}

const initial = snapshot();
let server;

afterEach(async () => {
  if (server) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    server = null;
  }
  restore(initial);
});

async function post(path, body) {
  const res = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });
  return { status: res.status, body: await res.json() };
}

async function start() {
  server = createApp({ logging: false, persistence: true, rateLimits: false }).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
}

test('user input only travels as a bound value, never inside the SQL text', async () => {
  // Arrange
  const db = recordingPool();
  setPool(db.pool);
  await start();

  // Act
  const res = await post('/auth/register', { name: HOSTILE, email: 'bobby@example.com', password: 'Little-Bobby-1' });

  // Assert
  assert.equal(res.status, 201);
  assert.ok(db.log.some(({ params }) => params.some((p) => String(p).includes('Robert'))), 'the name was saved as a parameter');
  for (const { sql } of db.log) {
    assert.ok(!sql.includes('Robert') && !sql.includes('DROP'), `input leaked into SQL: ${sql}`);
    assert.ok(!sql.includes('bobby@example.com'), `input leaked into SQL: ${sql}`);
  }
});

test('table and column names must be plain identifiers', async () => {
  // Arrange
  const db = recordingPool();

  // Act
  const badTable = insertRows(db.pool, 'users; DROP TABLE users', 'id bigint', [{ id: 1 }]);
  const badColumn = insertRows(db.pool, 'users', 'id bigint, name text); DROP TABLE users; --', [{ id: 1 }]);
  const badType = insertRows(db.pool, 'users', 'id bigint; DROP TABLE users', [{ id: 1 }]);
  const badOrder = selectRows(db.pool, 'users', 'id; DROP TABLE users');

  // Assert
  await assert.rejects(badTable, /identifier/);
  await assert.rejects(badColumn, /identifier/);
  await assert.rejects(badType, /identifier/);
  await assert.rejects(badOrder, /identifier/);
  assert.equal(db.log.length, 0);
});

test('no source file builds SQL with string interpolation or concatenation', () => {
  // Arrange
  // db.js no longer sends SQL itself; data/relational/ builds statements from checked identifiers (tested above).
  const files = ['src/data/persist.js', 'scripts/db-reset.js'].map((f) => new URL(`../../${f}`, import.meta.url));

  for (const file of files) {
    // Act
    const source = fs.readFileSync(file, 'utf8');
    const calls = [...source.matchAll(/\.query\(\s*(`[^`]*`|'[^']*'|"[^"]*")/g)].map((m) => m[1]);

    // Assert
    assert.ok(calls.length > 0, `${file.pathname} has queries`);
    for (const sql of calls) assert.ok(!sql.includes('${'), `interpolated SQL in ${file.pathname}: ${sql}`);
    assert.doesNotMatch(source, /\.query\(\s*[`'"][^`'"]*[`'"]\s*\+/, `concatenated SQL in ${file.pathname}`);
    // A variable as the SQL argument is suspicious; the one allowed form picks between two constants (keep ? 'COMMIT' : 'ROLLBACK').
    assert.doesNotMatch(source, /\.query\(\s*(?![a-zA-Z_]\w*\s*\?\s*'[A-Z]+'\s*:\s*'[A-Z]+')[a-zA-Z_]/, `SQL built in a variable in ${file.pathname}`);
  }
});

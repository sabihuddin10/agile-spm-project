/**
 * SQL injection safety — data/db.js, data/persist.js and scripts/db-reset.js.
 *
 * The store lives in memory and is saved as one gzip-compressed JSON snapshot
 * in the `app_state` table. These tests record every statement sent to a fake
 * pool and check that user input only ever travels as a bound parameter ($1,
 * $2), never inside the SQL text, and that a hostile-looking name survives the
 * round trip as plain data.
 */
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createApp } from '../../src/app.js';
import { setPool } from '../../src/data/db.js';
import { snapshot, restore } from '../../src/data/snapshot.js';

const HOSTILE = "Robert'); DROP TABLE app_state;--";
const HOSTILE_KEY = "main'; DELETE FROM app_state; --";

/** The only statements the app may send, compared with whitespace collapsed. */
const ALLOWED = [
  /^CREATE TABLE IF NOT EXISTS app_state \(/,
  /^BEGIN$/,
  /^COMMIT$/,
  /^ROLLBACK$/,
  /^SELECT version FROM app_state WHERE key = \$1 FOR UPDATE$/,
  /^SELECT data FROM app_state WHERE key = \$1$/,
  /^INSERT INTO app_state \(key, data, version\) VALUES \(\$1, \$2, 1\) ON CONFLICT \(key\) DO NOTHING$/,
  /^UPDATE app_state SET data = \$2, version = version \+ 1, updated_at = now\(\) WHERE key = \$1 RETURNING version$/,
];

/** Fake pool that records { sql, params } and keeps the state row in memory. */
function recordingPool() {
  const rows = new Map();
  const log = [];
  async function query(sql, params = []) {
    const text = sql.replace(/\s+/g, ' ').trim();
    log.push({ sql: text, params });
    const [key, data] = params;
    const row = rows.get(key);
    if (text.startsWith('SELECT version')) return { rows: row ? [{ version: row.version }] : [] };
    if (text.startsWith('SELECT data')) return { rows: [{ data: row.data }] };
    if (text.startsWith('INSERT')) {
      if (row) return { rowCount: 0, rows: [] };
      rows.set(key, { data, version: 1 });
      return { rowCount: 1, rows: [] };
    }
    if (text.startsWith('UPDATE')) {
      rows.set(key, { data, version: row.version + 1 });
      return { rows: [{ version: row.version + 1 }] };
    }
    return { rows: [] };
  }
  const client = { query, on() {}, off() {}, release() {} };
  return { pool: { query, connect: async () => client, on() {} }, log, rows };
}

const initial = snapshot();
const savedKey = process.env.STATE_KEY;
let server;

afterEach(async () => {
  if (server) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    server = null;
  }
  restore(initial);
  if (savedKey === undefined) delete process.env.STATE_KEY;
  else process.env.STATE_KEY = savedKey;
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

test('every statement is a fixed, parameterised query; user input only travels as a bound value', async () => {
  // Arrange
  const db = recordingPool();
  setPool(db.pool);
  process.env.STATE_KEY = HOSTILE_KEY;
  await start();

  // Act
  const res = await post('/auth/register', { name: HOSTILE, email: 'bobby@example.com', password: 'Little-Bobby-1' });

  // Assert
  assert.equal(res.status, 201);
  assert.ok(db.log.length > 0);
  for (const { sql } of db.log) {
    assert.ok(ALLOWED.some((re) => re.test(sql)), `unexpected statement: ${sql}`);
    assert.ok(!sql.includes('Robert') && !sql.includes('DROP') && !sql.includes('DELETE'), `input leaked into SQL: ${sql}`);
  }
  // The state key (from the environment) is always the first bound parameter, never part of the text.
  for (const { sql, params } of db.log.filter((q) => q.sql.includes('$1'))) {
    assert.equal(params[0], HOSTILE_KEY, sql);
  }
});

test('a hostile customer name is stored and restored as plain data', async () => {
  // Arrange
  const db = recordingPool();
  setPool(db.pool);
  process.env.STATE_KEY = `sql_safety_${Date.now()}`;
  await start();

  // Act
  const res = await post('/auth/register', { name: HOSTILE, email: 'bobby2@example.com', password: 'Little-Bobby-1' });
  const saved = db.rows.get(process.env.STATE_KEY);
  const stored = JSON.parse(gunzipSync(saved.data));
  restore(initial);
  restore(stored);
  const restored = snapshot();

  // Assert
  assert.equal(res.status, 201);
  assert.ok(Buffer.isBuffer(saved.data), 'the snapshot is sent as a bytea parameter');
  assert.equal(stored.customers.find((c) => c.email === 'bobby2@example.com').name, HOSTILE);
  assert.equal(restored.users.find((u) => u.email === 'bobby2@example.com').name, HOSTILE);
});

test('no source file builds SQL with string interpolation or concatenation', () => {
  // Arrange
  const files = ['src/data/db.js', 'src/data/persist.js', 'scripts/db-reset.js'].map((f) => new URL(`../../${f}`, import.meta.url));

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

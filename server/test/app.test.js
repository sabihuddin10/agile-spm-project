/**
 * App wiring — app.js: the persistence middleware is mounted on /api when
 * `persistence` is on (by default whenever DATABASE_URL is set) and skipped
 * otherwise, and /api/health never touches the database. Runs against an
 * in-memory fake of the Postgres pool installed with `setPool`.
 */
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { setPool } from '../src/data/db.js';
import { snapshot, restore } from '../src/data/snapshot.js';

const initial = snapshot();
const savedEnv = { DATABASE_URL: process.env.DATABASE_URL, STATE_KEY: process.env.STATE_KEY };
let keySeq = 0;

/** Fake pool that records the first word of every statement and answers persist.js's queries. */
function fakeDb() {
  const rows = new Map();
  const statements = [];

  async function query(sql, params = []) {
    const text = sql.trim();
    statements.push(text.split(/\s+/)[0]);
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
      const version = row.version + 1;
      rows.set(key, { data, version });
      return { rows: [{ version }] };
    }
    return { rows: [] }; // CREATE TABLE, BEGIN, COMMIT, ROLLBACK
  }

  const client = { query, on() {}, off() {}, release() {} };
  return { pool: { query, connect: async () => client, on() {} }, statements };
}

let db;
let servers = [];

function setEnv(name, value) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

/** Start an app built with `options` and return a GET helper for /api paths. */
async function start(options) {
  const server = createApp({ logging: false, ...options }).listen(0);
  servers.push(server);
  await new Promise((resolve) => server.once('listening', resolve));
  return async (path) => {
    // Time out so a request stuck in the persistence queue fails the test instead of hanging the run.
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, { signal: AbortSignal.timeout(5000) });
    return { status: res.status, body: await res.json() };
  };
}

beforeEach(() => {
  restore(initial);
  db = fakeDb();
  setPool(db.pool);
  // persist.js remembers the last loaded version, so give each test its own state row.
  process.env.STATE_KEY = `app_test_${++keySeq}`;
});

// Close servers here, not in the tests, so a failed assertion can't leave one open and hang the run.
afterEach(async () => {
  await Promise.all(servers.map((server) => new Promise((resolve) => {
    server.closeAllConnections();
    server.close(resolve);
  })));
  servers = [];
  setEnv('DATABASE_URL', savedEnv.DATABASE_URL);
  setEnv('STATE_KEY', savedEnv.STATE_KEY);
});

test('with persistence on, an API request runs inside a database transaction', async () => {
  // Arrange
  const get = await start({ persistence: true });

  // Act
  const res = await get('/menu');

  // Assert
  assert.equal(res.status, 200);
  assert.equal(db.statements.includes('BEGIN'), true);
  assert.equal(db.statements.at(-1), 'COMMIT');
});

test('with persistence on, /api/health does not touch the database', async () => {
  // Arrange
  const get = await start({ persistence: true });

  // Act
  const res = await get('/health');

  // Assert
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'ok');
  assert.deepEqual(db.statements, []);
});

test('with persistence off, no query reaches the database', async () => {
  // Arrange
  const get = await start({ persistence: false });

  // Act
  const menu = await get('/menu');
  const health = await get('/health');

  // Assert
  assert.equal(menu.status, 200);
  assert.equal(health.status, 200);
  assert.deepEqual(db.statements, []);
});

test('persistence defaults to on when DATABASE_URL is set', async () => {
  // Arrange
  process.env.DATABASE_URL = 'postgres://fake.invalid/app';
  const get = await start({});

  // Act
  const res = await get('/menu');

  // Assert
  assert.equal(res.status, 200);
  assert.equal(db.statements.includes('BEGIN'), true);
  assert.equal(db.statements.at(-1), 'COMMIT');
});

test('persistence defaults to off when DATABASE_URL is unset', async () => {
  // Arrange
  delete process.env.DATABASE_URL;
  const get = await start({});

  // Act
  const res = await get('/menu');

  // Assert
  assert.equal(res.status, 200);
  assert.deepEqual(db.statements, []);
});

/* ------------------------------------------------------ input guards */

/** Send a raw body (string) with a content type to a fresh app; returns { status, body }. */
async function sendRaw(method, path, rawBody, { contentType = 'application/json' } = {}) {
  const server = createApp({ logging: false, persistence: false, rateLimits: false }).listen(0);
  servers.push(server);
  await new Promise((resolve) => server.once('listening', resolve));
  const res = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, {
    method,
    headers: { 'Content-Type': contentType },
    body: rawBody,
    signal: AbortSignal.timeout(5000),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

test('a JSON body larger than 100 KB is answered 413, not 500', async () => {
  // Arrange
  const huge = JSON.stringify({ name: 'x'.repeat(150 * 1024), email: 'big@example.com', password: 'Big-body-1' });

  // Act
  const res = await sendRaw('POST', '/auth/register', huge);

  // Assert
  assert.equal(res.status, 413);
  assert.match(res.body.error, /too large/);
});

test('malformed JSON, a top-level array and a bare value are rejected with 400', async () => {
  // Act
  const malformed = await sendRaw('POST', '/auth/login', '{"email": ');
  const array = await sendRaw('POST', '/auth/login', '[{"email":"admin@rest.test","password":"password"}]');
  const bare = await sendRaw('POST', '/auth/login', '"admin@rest.test"');

  // Assert
  assert.equal(malformed.status, 400);
  assert.equal(array.status, 400);
  assert.match(array.body.error, /JSON object/);
  assert.equal(bare.status, 400);
});

test('a non-JSON body is not parsed, so it cannot smuggle fields in', async () => {
  // Act
  const res = await sendRaw('POST', '/auth/login', 'email=admin@rest.test&password=password', { contentType: 'application/x-www-form-urlencoded' });

  // Assert
  assert.equal(res.status, 400);
});

test('a __proto__ / constructor key anywhere in the body is refused and pollutes nothing', async () => {
  // Arrange
  const payloads = [
    '{"name":"P","email":"p1@example.com","password":"Proto-pass1","__proto__":{"role":"admin","polluted":true}}',
    '{"name":"P","email":"p2@example.com","password":"Proto-pass1","constructor":{"prototype":{"polluted":true}}}',
    '{"name":"P","email":"p3@example.com","password":"Proto-pass1","preferences":{"__proto__":{"polluted":true}}}',
  ];

  for (const payload of payloads) {
    // Act
    const res = await sendRaw('POST', '/auth/register', payload);

    // Assert
    assert.equal(res.status, 400, payload);
    assert.match(res.body.error, /reserved key/);
  }
  assert.equal({}.polluted, undefined);
  assert.equal({}.role, undefined);
});

test('query parameters must be single strings (no arrays or nested objects)', async () => {
  // Act
  const array = await sendRaw('GET', '/reservations/availability?date[]=2030-01-01');
  const nested = await sendRaw('GET', '/reservations/availability?date[a]=b');
  const plain = await sendRaw('GET', '/reservations/availability?date=2030-01-01');

  // Assert
  assert.equal(array.status, 400);
  assert.equal(nested.status, 400);
  assert.equal(plain.status, 200);
});

/**
 * Persistence module — data/persist.js: each API request loads, saves or rolls
 * back the store inside a transaction. Runs against an in-memory fake of the
 * Postgres pool, so it needs no database (the real-Neon tests live in test-db/).
 */
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { gunzipSync } from 'node:zlib';
import express from 'express';
import { customers } from '../../src/data/store.js';
import { snapshot, restore } from '../../src/data/snapshot.js';
import { setPool } from '../../src/data/db.js';
import { persistState, pack } from '../../src/data/persist.js';

const initial = snapshot();
let keySeq = 0;

/** Fake pool holding app_state rows, with transactions staged until COMMIT. */
function fakeDb({ failUpdate = false } = {}) {
  let rows = new Map();
  let tx = null;
  const statements = [];
  const table = () => tx ?? rows;

  async function query(sql, params = []) {
    const text = sql.trim();
    statements.push(text.split(/\s+/)[0]);
    if (text.startsWith('CREATE TABLE')) return { rows: [] };
    if (text === 'BEGIN') { tx = new Map(rows); return { rows: [] }; }
    if (text === 'COMMIT') { rows = tx; tx = null; return { rows: [] }; }
    if (text === 'ROLLBACK') { tx = null; return { rows: [] }; }
    const [key, data] = params;
    const row = table().get(key);
    if (text.startsWith('SELECT version')) return { rows: row ? [{ version: row.version }] : [] };
    if (text.startsWith('SELECT data')) return { rows: [{ data: row.data }] };
    if (text.startsWith('INSERT')) {
      if (row) return { rowCount: 0, rows: [] };
      table().set(key, { data, version: 1 });
      return { rowCount: 1, rows: [] };
    }
    if (text.startsWith('UPDATE')) {
      if (failUpdate) throw new Error('connection lost');
      const version = row.version + 1;
      table().set(key, { data, version });
      return { rows: [{ version }] };
    }
    throw new Error(`unexpected SQL: ${text}`);
  }

  const client = { query, on() {}, off() {}, release() {} };
  return {
    pool: { query, connect: async () => client, on() {} },
    statements,
    row: (key) => rows.get(key),
    saved: (key) => JSON.parse(gunzipSync(rows.get(key).data)),
    put: (key, state, version) => rows.set(key, { data: pack(JSON.stringify(state)), version }),
  };
}

/** An API with persistence in front of routes that read, write, or fail after writing. */
function startApi(key) {
  const app = express();
  app.use('/api', persistState({ key }));
  app.get('/api/count', (req, res) => res.json({ names: customers.map((c) => c.name) }));
  app.post('/api/add', (req, res) => {
    customers.push({ id: 'cus_added', name: 'Added' });
    res.status(201).json({ ok: true });
  });
  app.post('/api/broken', (req, res) => {
    customers.push({ id: 'cus_broken', name: 'Broken' });
    res.status(500).json({ error: 'boom' });
  });
  const server = app.listen(0);
  servers.push(server);
  const call = async (method, path) => {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, { method });
    return { status: res.status, body: await res.json() };
  };
  return { call };
}

const names = () => customers.map((c) => c.name);

let db;
let key;
let servers = [];

beforeEach(() => {
  restore(initial);
  db = fakeDb();
  setPool(db.pool);
  key = `test_${++keySeq}`;
});

// Close servers here, not in the tests, so a failed assertion can't leave one open and hang the run.
afterEach(async () => {
  await Promise.all(servers.map((server) => new Promise((resolve) => {
    server.closeAllConnections();
    server.close(resolve);
  })));
  servers = [];
});

test('the first request seeds a missing state row from the current store at version 1', async () => {
  // Arrange
  const api = startApi(key);

  // Act
  const res = await api.call('GET', '/count');

  // Assert
  assert.equal(res.status, 200);
  assert.equal(db.row(key).version, 1);
  assert.deepEqual(db.saved(key), initial);
});

test('a successful write is saved and bumps the version', async () => {
  // Arrange
  const api = startApi(key);
  await api.call('GET', '/count');

  // Act
  const res = await api.call('POST', '/add');

  // Assert
  assert.equal(res.status, 201);
  assert.equal(db.row(key).version, 2);
  assert.ok(db.saved(key).customers.some((c) => c.name === 'Added'));
  assert.equal(db.statements.at(-1), 'COMMIT');
});

test('a read-only request does not write to the database', async () => {
  // Arrange
  const api = startApi(key);
  await api.call('GET', '/count');
  db.statements.length = 0;

  // Act
  await api.call('GET', '/count');

  // Assert
  assert.equal(db.row(key).version, 1);
  assert.equal(db.statements.includes('UPDATE'), false);
});

test('a 5xx response rolls back both the in-memory store and the database', async () => {
  // Arrange
  const api = startApi(key);
  await api.call('GET', '/count');

  // Act
  const res = await api.call('POST', '/broken');

  // Assert
  assert.equal(res.status, 500);
  assert.equal(names().includes('Broken'), false);
  assert.equal(db.row(key).version, 1);
  assert.equal(db.saved(key).customers.some((c) => c.name === 'Broken'), false);
  assert.equal(db.statements.at(-1), 'ROLLBACK');
});

test('a newer version saved by another instance is loaded before the handler runs', async () => {
  // Arrange
  const api = startApi(key);
  await api.call('GET', '/count');
  const remote = snapshot();
  remote.customers.push({ id: 'cus_remote', name: 'Remote' });
  db.put(key, remote, 2);

  // Act
  const res = await api.call('GET', '/count');

  // Assert
  assert.ok(res.body.names.includes('Remote'));
  assert.ok(names().includes('Remote'));
});

test('a failed save answers 500 and discards the change', async () => {
  // Arrange
  db = fakeDb({ failUpdate: true });
  setPool(db.pool);
  const api = startApi(key);
  await api.call('GET', '/count');

  // Act
  const res = await api.call('POST', '/add');

  // Assert
  assert.equal(res.status, 500);
  assert.equal(res.body.error, 'Could not save changes. Please try again.');
  assert.equal(names().includes('Added'), false);
  assert.equal(db.row(key).version, 1);
});

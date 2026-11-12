/**
 * Persistence module — data/persist.js: each API request loads, saves or rolls
 * back the store in the relational tables inside a transaction. Runs against a
 * real Postgres database (needs DATABASE_URL, see `npm run test:db`).
 */
import 'dotenv/config';
import { test, before, beforeEach, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { customers } from '../src/data/store.js';
import { snapshot, restore } from '../src/data/snapshot.js';
import { setPool, createPool } from '../src/data/db.js';
import { persistState } from '../src/data/persist.js';
import { saveStore } from '../src/data/relational/index.js';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for the database tests.');

const initial = snapshot();
let pool;
let servers = [];

const version = async () =>
  (await pool.query("SELECT last_value::int AS v FROM sequences WHERE name = 'state_version'")).rows[0]?.v;
const dbNames = async () => (await pool.query('SELECT name FROM customers ORDER BY id')).rows.map((r) => r.name);
const names = () => customers.map((c) => c.name);

/** An API with persistence in front of routes that read, write, fail after writing, or write invalid data. */
function startApi() {
  const app = express();
  app.use('/api', persistState());
  app.get('/api/count', (req, res) => res.json({ names: names() }));
  app.post('/api/add', (req, res) => {
    customers.push({ ...customers[0], id: 'cus_added', name: 'Added', userId: null, preferences: { dietary: [], allergies: [] } });
    res.status(201).json({ ok: true });
  });
  app.post('/api/broken', (req, res) => {
    customers.push({ ...customers[0], id: 'cus_broken', name: 'Broken', userId: null, preferences: { dietary: [], allergies: [] } });
    res.status(500).json({ error: 'boom' });
  });
  app.post('/api/invalid', (req, res) => {
    customers.push({ ...customers[0], id: 'cus_invalid', name: null, userId: null, preferences: { dietary: [], allergies: [] } });
    res.status(201).json({ ok: true });
  });
  const server = app.listen(0);
  servers.push(server);
  const call = async (method, path) => {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, { method });
    return { status: res.status, body: await res.json() };
  };
  return { call };
}

before(() => {
  pool = createPool(process.env.DATABASE_URL);
});

beforeEach(async () => {
  restore(initial);
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  setPool(createPool(process.env.DATABASE_URL));
});

// Close servers here, not in the tests, so a failed assertion can't leave one open and hang the run.
afterEach(async () => {
  await Promise.all(servers.map((server) => new Promise((resolve) => {
    server.closeAllConnections();
    server.close(resolve);
  })));
  servers = [];
});

after(() => pool.end());

test('the first request creates the schema and seeds the tables from the store at version 1', async () => {
  // Arrange
  const api = startApi();

  // Act
  const res = await api.call('GET', '/count');

  // Assert
  assert.equal(res.status, 200);
  assert.equal(await version(), 1);
  assert.deepEqual(await dbNames(), initial.customers.map((c) => c.name));
  const blob = await pool.query("SELECT 1 FROM information_schema.tables WHERE table_name = 'app_state'");
  assert.equal(blob.rowCount, 0);
});

test('a successful write is saved as rows and bumps the version', async () => {
  // Arrange
  const api = startApi();
  await api.call('GET', '/count');

  // Act
  const res = await api.call('POST', '/add');

  // Assert
  assert.equal(res.status, 201);
  assert.equal(await version(), 2);
  assert.ok((await dbNames()).includes('Added'));
});

test('a read-only request does not bump the version', async () => {
  // Arrange
  const api = startApi();
  await api.call('GET', '/count');

  // Act
  await api.call('GET', '/count');

  // Assert
  assert.equal(await version(), 1);
});

test('a 5xx response rolls back both the in-memory store and the database', async () => {
  // Arrange
  const api = startApi();
  await api.call('GET', '/count');

  // Act
  const res = await api.call('POST', '/broken');

  // Assert
  assert.equal(res.status, 500);
  assert.equal(names().includes('Broken'), false);
  assert.equal(await version(), 1);
  assert.equal((await dbNames()).includes('Broken'), false);
});

test('a newer version saved by another instance is loaded before the handler runs', async () => {
  // Arrange
  const api = startApi();
  await api.call('GET', '/count');
  const remote = snapshot();
  remote.customers.push({ ...remote.customers[0], id: 'cus_remote', name: 'Remote', userId: null });
  await saveStore(pool, remote);
  await pool.query("UPDATE sequences SET last_value = 2 WHERE name = 'state_version'");

  // Act
  const res = await api.call('GET', '/count');

  // Assert
  assert.ok(res.body.names.includes('Remote'));
  assert.ok(names().includes('Remote'));
});

test('a failed save answers 500 and discards the change', async () => {
  // Arrange
  const api = startApi();
  await api.call('GET', '/count');

  // Act
  const res = await api.call('POST', '/invalid');

  // Assert
  assert.equal(res.status, 500);
  assert.equal(res.body.error, 'Could not save changes. Please try again.');
  assert.equal(names().includes(null), false);
  assert.equal(await version(), 1);
});

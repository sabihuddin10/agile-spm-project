/**
 * Persistence against a real Neon database (needs DATABASE_URL, see
 * `npm run test:db`). Each API server runs in its own process — like separate
 * serverless instances — and the whole run uses a unique app_state row that is
 * deleted afterwards.
 */
import 'dotenv/config';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { Pool } from '@neondatabase/serverless';

const STATE_KEY = `test_${process.pid}_${Date.now()}`;
const SERVER_DIR = fileURLToPath(new URL('..', import.meta.url));

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for the database tests.');

let pool;
const servers = [];

before(() => {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
});

after(async () => {
  await Promise.all(servers.map((s) => s.close()));
  await pool.query('DELETE FROM app_state WHERE key = $1', [STATE_KEY]).catch(() => {});
  await pool.end();
});

/** Boot the API in a fresh Node process (a "cold" instance) on a random port. */
async function spawnServer() {
  const child = spawn(process.execPath, ['--input-type=module', '-e', `
    import { createApp } from './src/app.js';
    const server = createApp({ logging: false }).listen(0, () => console.log('PORT=' + server.address().port));
  `], { cwd: SERVER_DIR, env: { ...process.env, STATE_KEY }, stdio: ['ignore', 'pipe', 'inherit'] });

  const port = await new Promise((resolve, reject) => {
    child.once('exit', (code) => reject(new Error(`server exited early (${code})`)));
    child.stdout.on('data', (chunk) => {
      const match = /PORT=(\d+)/.exec(String(chunk));
      if (match) resolve(Number(match[1]));
    });
  });
  const base = `http://127.0.0.1:${port}/api`;

  async function call(method, path, { token, body } = {}) {
    const res = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(180_000),
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  }

  async function login(who) {
    const res = await call('POST', '/auth/login', { body: { email: `${who}@rest.test`, password: 'password' } });
    assert.equal(res.status, 200, `login ${who}`);
    return res.body.token;
  }

  const close = () => new Promise((resolve) => {
    if (child.exitCode !== null) return resolve();
    child.once('exit', resolve);
    child.kill();
  });

  const server = { call, login, close };
  servers.push(server);
  return server;
}

const customerNames = async (api, token) =>
  (await api.call('GET', '/customers', { token })).body.customers.map((c) => c.name);

test('the first request seeds a missing state row with the gzip-compressed demo data', async () => {
  const api = await spawnServer();
  const menu = await api.call('GET', '/menu');
  assert.equal(menu.status, 200);

  const { rows } = await pool.query('SELECT version, data FROM app_state WHERE key = $1', [STATE_KEY]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].version, 1);
  const data = JSON.parse(gunzipSync(rows[0].data));
  assert.equal(data.users.length, 7);
  await api.close();
});

test('a write survives a cold start on another instance', async () => {
  const first = await spawnServer();
  const token = await first.login('manager');
  const created = await first.call('POST', '/customers', { token, body: { name: 'Persisted Pat' } });
  assert.equal(created.status, 201);
  await first.close();

  const second = await spawnServer();
  const token2 = await second.login('manager');
  assert.ok((await customerNames(second, token2)).includes('Persisted Pat'));
  await second.close();
});

test('concurrent writes on two instances are all kept', async () => {
  const [a, b] = [await spawnServer(), await spawnServer()];
  const [tokenA, tokenB] = [await a.login('manager'), await b.login('waiter')];

  const names = Array.from({ length: 6 }, (_, i) => `Concurrent ${i}`);
  const results = await Promise.all(names.map((name, i) =>
    (i % 2 ? b : a).call('POST', '/customers', { token: i % 2 ? tokenB : tokenA, body: { name } })));
  assert.deepEqual(results.map((r) => r.status), names.map(() => 201));

  const ids = results.map((r) => r.body.customer.id);
  assert.equal(new Set(ids).size, ids.length, 'customer ids are unique across instances');

  for (const [api, token] of [[a, tokenA], [b, tokenB]]) {
    const seen = await customerNames(api, token);
    for (const name of names) assert.ok(seen.includes(name), `${name} visible`);
  }
});

/**
 * Shared rate limits against a real Postgres (bolt 004): the SQL in lib/rate-limit-store.js, real
 * concurrency across separate connection pools (standing in for separate API instances), and the app
 * answering from a database every instance shares. Needs DATABASE_URL, see `npm run test:db`.
 */
import 'dotenv/config';
import { test, after, before, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createPool } from '../src/data/db.js';
import { requireTestDatabase } from './guard.js';
import { ensureSchema } from '../src/data/relational/schema.js';
import { PostgresStore, hashKey } from '../src/lib/rate-limit-store.js';
import { createApp } from '../src/app.js';

requireTestDatabase();

// Three pools: three "API instances" with their own connections to the same database.
const pools = [createPool(process.env.DATABASE_URL), createPool(process.env.DATABASE_URL), createPool(process.env.DATABASE_URL)];
const [poolA, poolB, poolC] = pools;
const storeFor = (pool, options = {}) => new PostgresStore({ getPool: () => pool, ...options });
const servers = [];

const policy = (over = {}) => ({ namespace: 'auth-login-ip', key: '203.0.113.7', limit: 3, windowMs: 60_000, ...over });
const row = async (namespace, key) => (await poolA.query('SELECT count, reset_at FROM rate_limits WHERE key_hash = $1', [hashKey(namespace, key)])).rows[0];

before(async () => {
  await poolA.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await ensureSchema(poolA);
});

after(async () => {
  for (const server of servers) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
  await Promise.all(pools.map((p) => p.end().catch(() => {})));
});

test('the rate_limits table and its expiry index exist, and applying the schema again is harmless', async () => {
  // Arrange / Act
  await ensureSchema(poolA);
  const table = await poolA.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'rate_limits' ORDER BY ordinal_position");
  const index = await poolA.query("SELECT 1 FROM pg_indexes WHERE tablename = 'rate_limits' AND indexname = 'idx_rate_limits_reset_at'");

  // Assert
  assert.deepEqual(table.rows.map((r) => r.column_name), ['key_hash', 'namespace', 'count', 'reset_at']);
  assert.equal(index.rowCount, 1);
});

test('attempts up to the limit are allowed, the next ones are not, and the window does not extend while blocked', async () => {
  // Arrange
  const store = storeFor(poolA);
  const args = policy({ key: 'sequence-test', limit: 3, windowMs: 60_000 });

  // Act
  const results = [];
  for (let i = 0; i < 6; i += 1) results.push(await store.consume(args));
  const after = await row(args.namespace, args.key);

  // Assert
  assert.deepEqual(results.map((r) => r.allowed), [true, true, true, false, false, false]);
  assert.deepEqual(results.slice(0, 3).map((r) => r.remaining), [2, 1, 0]);
  assert.ok(results[3].retryAfterSeconds >= 1 && results[3].retryAfterSeconds <= 60, `Retry-After ${results[3].retryAfterSeconds}`);
  assert.equal(after.count, 4, 'the count is capped at limit + 1 however many attempts arrive');
});

test('simultaneous attempts from separate instances: exactly the permitted number succeed', async () => {
  // Arrange
  const stores = [storeFor(poolA), storeFor(poolB), storeFor(poolC)];
  const args = policy({ key: 'race-test', limit: 10 });

  // Act: 60 attempts in flight at once over three connection pools
  const results = await Promise.all(Array.from({ length: 60 }, (_, i) => stores[i % 3].consume(args)));

  // Assert
  assert.equal(results.filter((r) => r.allowed).length, 10);
  assert.equal(results.filter((r) => !r.allowed).length, 50);
});

test('instances share one window: a block made through one is seen by the others, with the same reset time', async () => {
  // Arrange
  const args = policy({ key: 'shared-window', limit: 2 });
  await storeFor(poolA).consume(args);
  await storeFor(poolB).consume(args);

  // Act
  const fromC = await storeFor(poolC).consume(args);
  const fromA = await storeFor(poolA).consume(args);

  // Assert
  assert.equal(fromC.allowed, false);
  assert.equal(fromA.allowed, false);
  assert.ok(Math.abs(fromC.retryAfterSeconds - fromA.retryAfterSeconds) <= 1);
});

test('the database clock decides when a window ends: an expired window restarts at one', async () => {
  // Arrange
  const store = storeFor(poolA);
  const args = policy({ key: 'expiry-test', limit: 1 });
  await store.consume(args);
  const blocked = await store.consume(args);

  // Act: age the window on the database side
  await poolA.query("UPDATE rate_limits SET reset_at = now() - interval '1 second' WHERE key_hash = $1", [hashKey(args.namespace, args.key)]);
  const fresh = await store.consume(args);
  const afterRestart = await row(args.namespace, args.key);

  // Assert
  assert.equal(blocked.allowed, false);
  assert.equal(fresh.allowed, true);
  assert.equal(afterRestart.count, 1);
});

test('a short window really ends in real time', async () => {
  // Arrange
  const store = storeFor(poolA);
  const args = policy({ key: 'real-time-test', limit: 1, windowMs: 1000 });
  await store.consume(args);
  assert.equal((await store.consume(args)).allowed, false);

  // Act
  await new Promise((resolve) => setTimeout(resolve, 1300));
  const next = await store.consume(args);

  // Assert
  assert.equal(next.allowed, true);
});

test('refund gives an attempt back inside the window, never goes below zero, and does nothing after the window', async () => {
  // Arrange
  const store = storeFor(poolA);
  const args = policy({ key: 'refund-test', limit: 1 });
  await store.consume(args);

  // Act
  await store.refund(args);
  await store.refund(args);
  await store.refund(args);
  const zeroed = await row(args.namespace, args.key);
  const reusable = await store.consume(args);
  await poolA.query("UPDATE rate_limits SET reset_at = now() - interval '1 second' WHERE key_hash = $1", [hashKey(args.namespace, args.key)]);
  await store.refund(args);
  const expired = await row(args.namespace, args.key);

  // Assert
  assert.equal(zeroed.count, 0);
  assert.equal(reusable.allowed, true);
  assert.equal(expired.count, 1, 'an expired window is not touched');
});

test('only a hash of the key is stored: no IP address or email appears in the table', async () => {
  // Arrange
  const store = storeFor(poolA);
  await store.consume(policy({ namespace: 'auth-login-email', key: 'private.person@example.com' }));
  await store.consume(policy({ namespace: 'booking-ip', key: '198.51.100.23' }));

  // Act
  const dump = JSON.stringify((await poolA.query('SELECT * FROM rate_limits')).rows);

  // Assert
  assert.ok(!dump.includes('private.person'));
  assert.ok(!dump.includes('example.com'));
  assert.ok(!dump.includes('198.51.100.23'));
  assert.match(dump, /[0-9a-f]{64}/);
});

test('expired rows are removed in the background; live rows are kept', async () => {
  // Arrange
  await poolA.query("INSERT INTO rate_limits (key_hash, namespace, count, reset_at) VALUES ('old-row', 'booking-ip', 3, now() - interval '3 hours')");
  await poolA.query("INSERT INTO rate_limits (key_hash, namespace, count, reset_at) VALUES ('recent-row', 'booking-ip', 3, now() - interval '5 minutes')");
  const store = storeFor(poolA, { cleanupEveryMs: 0 });

  // Act: every attempt may trigger the cleanup
  await store.consume(policy({ key: 'cleanup-trigger' }));
  await new Promise((resolve) => setTimeout(resolve, 300));
  const keys = (await poolA.query("SELECT key_hash FROM rate_limits WHERE key_hash IN ('old-row', 'recent-row')")).rows.map((r) => r.key_hash);

  // Assert
  assert.deepEqual(keys, ['recent-row']);
});

// ------------------------------------------------------------------ the app on a shared database

async function startInstance(pool) {
  const server = createApp({ logging: false, persistence: false, limiterStore: storeFor(pool) }).listen(0);
  servers.push(server);
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  return (method, path, body) => fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

test('sign-in failures made on one API instance lock the account out on another, with Retry-After', async () => {
  // Arrange
  const instanceA = await startInstance(poolA);
  const instanceB = await startInstance(poolB);
  const wrong = { email: 'chef2@rest.test', password: 'wrong-password' };

  // Act
  const statuses = [];
  for (let i = 0; i < 5; i += 1) statuses.push((await (i % 2 ? instanceB : instanceA)('POST', '/auth/login', wrong)).status);
  const blockedOnA = await instanceA('POST', '/auth/login', wrong);
  const blockedOnB = await instanceB('POST', '/auth/login', wrong);

  // Assert
  assert.deepEqual(statuses, [401, 401, 401, 401, 401]);
  assert.equal(blockedOnA.status, 429);
  assert.equal(blockedOnB.status, 429);
  assert.ok(Number(blockedOnB.headers.get('retry-after')) > 0);
});

test('a successful sign-in is not counted against the email limit, on a shared database', async () => {
  // Arrange
  const instance = await startInstance(poolC);
  const good = { email: 'waiter2@rest.test', password: 'password' };

  // Act: more successes than the five-failure limit allows
  const statuses = [];
  for (let i = 0; i < 8; i += 1) {
    statuses.push((await instance('POST', '/auth/login', good)).status);
    await new Promise((resolve) => setTimeout(resolve, 30)); // the give-back runs when the response finishes
  }

  // Assert
  assert.deepEqual(statuses, Array(8).fill(200));
});

test('with the database unreachable, sign-in answers 503 with a short Retry-After and the outage is logged', async () => {
  // Arrange
  const errors = mock.method(console, 'error', () => {});
  const brokenPool = createPool(process.env.DATABASE_URL);
  await brokenPool.end();
  const instance = await startInstance(brokenPool);

  // Act
  const login = await instance('POST', '/auth/login', { email: 'customer@rest.test', password: 'password' });
  const menu = await instance('GET', '/menu');
  const logged = errors.mock.calls.map((c) => String(c.arguments[0])).join('\n');
  mock.restoreAll();

  // Assert
  assert.equal(login.status, 503);
  assert.equal(login.headers.get('retry-after'), '5');
  assert.equal(menu.status, 200, 'requests that are not rate limited keep working');
  assert.match(logged, /\[rate-limit\] store unavailable/);
});

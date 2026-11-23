/**
 * Rate limit storage (bolt 004) — lib/rate-limit-store.js: the in-memory store, the Postgres store
 * (against a fake pool that applies the same rules as the SQL, so cross-instance behaviour can be
 * tested without a database; the real SQL is exercised by test-db/rate-limit.test.js), and the
 * choice between them.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CLEANUP_SQL, CONSUME_SQL, MemoryStore, PostgresStore,
  createRateLimitStore, hashKey, resetRateLimitWarning,
} from '../../src/lib/rate-limit-store.js';
import { fakeDatabase } from '../rate-limit-fake-db.js';

const policy = (over = {}) => ({ namespace: 'auth-login-ip', key: '203.0.113.7', limit: 3, windowMs: 60_000, ...over });

// ------------------------------------------------------------------ in-memory store

test('memory store: allows up to the limit, then blocks with the time left in the window', () => {
  // Arrange
  let clock = 0;
  const store = new MemoryStore({ now: () => clock });

  // Act
  const results = [1, 2, 3, 4].map(() => store.consume(policy()));
  clock = 45_000;
  const later = store.consume(policy());

  // Assert
  assert.deepEqual(results.map((r) => r.allowed), [true, true, true, false]);
  assert.deepEqual(results.map((r) => r.remaining), [2, 1, 0, 0]);
  assert.equal(results[3].retryAfterSeconds, 60);
  assert.equal(later.retryAfterSeconds, 15);
});

test('memory store: keys and namespaces are counted separately, and the window resets', () => {
  // Arrange
  let clock = 0;
  const store = new MemoryStore({ now: () => clock });
  store.consume(policy({ limit: 1 }));

  // Act
  const otherKey = store.consume(policy({ limit: 1, key: '198.51.100.9' }));
  const otherNamespace = store.consume(policy({ limit: 1, namespace: 'booking-ip' }));
  const sameBlocked = store.consume(policy({ limit: 1 }));
  clock = 60_000;
  const afterWindow = store.consume(policy({ limit: 1 }));

  // Assert
  assert.equal(otherKey.allowed, true);
  assert.equal(otherNamespace.allowed, true);
  assert.equal(sameBlocked.allowed, false);
  assert.equal(afterWindow.allowed, true);
});

test('memory store: refund gives one attempt back, never below zero, and not after the window', () => {
  // Arrange
  let clock = 0;
  const store = new MemoryStore({ now: () => clock });
  store.consume(policy({ limit: 1 }));

  // Act
  store.refund(policy());
  store.refund(policy());
  const reusable = store.consume(policy({ limit: 1 }));
  const blockedAgain = store.consume(policy({ limit: 1 }));

  // Assert
  assert.equal(reusable.allowed, true);
  assert.equal(blockedAgain.allowed, false);
});

test('memory store: stops growing at its key cap instead of exhausting memory, and frees expired keys first', () => {
  // Arrange
  let clock = 0;
  const store = new MemoryStore({ now: () => clock, maxKeys: 3 });
  for (const key of ['a', 'b', 'c']) store.consume(policy({ key }));

  // Act: full of live windows
  const refused = store.consume(policy({ key: 'd' }));
  clock = 60_000; // every window has ended
  const freed = store.consume(policy({ key: 'd' }));

  // Assert
  assert.equal(refused.allowed, false);
  assert.equal(refused.retryAfterSeconds, 60);
  assert.equal(freed.allowed, true);
});

// ------------------------------------------------------------------ postgres store

test('postgres store: binds the hashed key, namespace, window in seconds and limit, never the raw key', async () => {
  // Arrange
  const db = fakeDatabase();
  const store = new PostgresStore({ getPool: () => db.pool });

  // Act
  await store.consume(policy({ key: 'someone@example.com', windowMs: 15 * 60_000, limit: 5 }));

  // Assert
  const [{ sql, params }] = db.calls;
  assert.equal(sql, CONSUME_SQL);
  assert.deepEqual(params, [hashKey('auth-login-ip', 'someone@example.com'), 'auth-login-ip', 900, 5]);
  assert.ok(!JSON.stringify(params).includes('someone@example.com'));
  assert.match(params[0], /^[0-9a-f]{64}$/);
});

test('postgres store: the hash depends on both the namespace and the key', () => {
  // Arrange / Act / Assert
  assert.notEqual(hashKey('a', 'x'), hashKey('b', 'x'));
  assert.notEqual(hashKey('a', 'x'), hashKey('a', 'y'));
  assert.equal(hashKey('a', 'x'), hashKey('a', 'x'));
  assert.notEqual(hashKey('ab', 'c'), hashKey('a', 'bc'), 'the separator must stop "ab"+"c" colliding with "a"+"bc"');
});

test('postgres store: attempts up to the limit are allowed, the next is not, and Retry-After is the shared reset time', async () => {
  // Arrange
  const db = fakeDatabase();
  const store = new PostgresStore({ getPool: () => db.pool });

  // Act
  const results = [];
  for (let i = 0; i < 5; i += 1) results.push(await store.consume(policy()));
  db.clock += 20_000;
  const later = await store.consume(policy());

  // Assert
  assert.deepEqual(results.map((r) => r.allowed), [true, true, true, false, false]);
  assert.deepEqual(results.map((r) => r.remaining), [2, 1, 0, 0, 0]);
  assert.equal(results[0].retryAfterSeconds, 60);
  assert.equal(later.retryAfterSeconds, 40);
  assert.ok(db.rows.get(hashKey('auth-login-ip', '203.0.113.7')).count <= 4, 'the counter is capped at limit + 1');
});

test('postgres store: a new window starts after the old one ends', async () => {
  // Arrange
  const db = fakeDatabase();
  const store = new PostgresStore({ getPool: () => db.pool });
  for (let i = 0; i < 4; i += 1) await store.consume(policy());

  // Act
  db.clock += 60_000;
  const fresh = await store.consume(policy());

  // Assert
  assert.equal(fresh.allowed, true);
  assert.equal(fresh.remaining, 2);
});

test('two instances share one counter: attempts made through either count against the same quota', async () => {
  // Arrange: two stores, as two serverless instances would have, over one database
  const db = fakeDatabase();
  const instanceA = new PostgresStore({ getPool: () => db.pool });
  const instanceB = new PostgresStore({ getPool: () => db.pool });

  // Act
  const results = [
    await instanceA.consume(policy()),
    await instanceB.consume(policy()),
    await instanceA.consume(policy()),
    await instanceB.consume(policy()),
    await instanceA.consume(policy()),
  ];

  // Assert: one shared quota of 3, so the 4th and 5th are blocked wherever they land
  assert.deepEqual(results.map((r) => r.allowed), [true, true, true, false, false]);
});

test('simultaneous attempts from several instances: exactly the permitted number succeed', async () => {
  // Arrange
  const db = fakeDatabase();
  const instances = [0, 1, 2, 3].map(() => new PostgresStore({ getPool: () => db.pool }));

  // Act: 40 attempts in flight at once, spread over the instances
  const results = await Promise.all(Array.from({ length: 40 }, (_, i) => instances[i % 4].consume(policy({ limit: 10 }))));

  // Assert
  assert.equal(results.filter((r) => r.allowed).length, 10);
});

test('postgres store: refund gives an attempt back inside the window only', async () => {
  // Arrange
  const db = fakeDatabase();
  const store = new PostgresStore({ getPool: () => db.pool });
  await store.consume(policy({ limit: 1 }));

  // Act
  await store.refund(policy());
  const reusable = await store.consume(policy({ limit: 1 }));
  db.clock += 60_000;
  await store.refund(policy()); // the window is over: nothing to give back
  const nextWindow = await store.consume(policy({ limit: 1 }));

  // Assert
  assert.equal(reusable.allowed, true);
  assert.equal(nextWindow.allowed, true);
  assert.equal(db.rows.get(hashKey('auth-login-ip', '203.0.113.7')).count, 1);
});

test('postgres store: the schema is ensured before the first query', async () => {
  // Arrange
  const db = fakeDatabase();
  const order = [];
  const store = new PostgresStore({
    getPool: () => db.pool,
    ensureSchema: async () => { order.push('schema'); },
  });
  const original = db.pool.query;
  db.pool.query = async (...args) => { order.push('query'); return original(...args); };

  // Act
  await store.consume(policy());

  // Assert
  assert.deepEqual(order, ['schema', 'query']);
});

test('postgres store: database errors and unreadable answers surface, so the limiter can fail safe', async () => {
  // Arrange
  const db = fakeDatabase();
  const store = new PostgresStore({ getPool: () => db.pool });
  db.failWith = new Error('connection terminated');

  // Act / Assert: an outage
  await assert.rejects(store.consume(policy()), /connection terminated/);
  await assert.rejects(store.refund(policy()), /connection terminated/);

  // Act / Assert: an answer with no usable counter
  db.failWith = null;
  db.pool.query = async () => ({ rows: [] });
  await assert.rejects(store.consume(policy()), /unexpected result/);
  db.pool.query = async () => ({ rows: [{ count: 'many', retry_after: null }] });
  await assert.rejects(store.consume(policy()), /unexpected result/);
});

test('postgres store: expired rows are cleaned up in the background, at most once per interval, and a failure is only logged', async () => {
  // Arrange
  const db = fakeDatabase();
  let clock = 0;
  const logs = [];
  const store = new PostgresStore({ getPool: () => db.pool, now: () => clock, cleanupEveryMs: 600_000, log: (m) => logs.push(m) });

  // Act
  await store.consume(policy());
  await store.consume(policy());
  const withoutCleanup = db.calls.filter((c) => c.sql === CLEANUP_SQL).length;
  clock = 600_000;
  await store.consume(policy());
  await store.consume(policy());
  await new Promise((resolve) => setImmediate(resolve));
  const afterInterval = db.calls.filter((c) => c.sql === CLEANUP_SQL).length;
  clock = 1_200_000;
  const original = db.pool.query;
  db.pool.query = async (sql, ...rest) => {
    if (sql === CLEANUP_SQL) throw new Error('cleanup blew up');
    return original(sql, ...rest);
  };
  const stillServing = await store.consume(policy());
  await new Promise((resolve) => setImmediate(resolve));

  // Assert
  assert.equal(withoutCleanup, 0);
  assert.equal(afterInterval, 1);
  assert.equal(typeof stillServing.allowed, 'boolean', 'a failed cleanup never stops a decision being made');
  assert.match(logs.join('\n'), /cleanup of expired rows failed: cleanup blew up/);
});

// ------------------------------------------------------------------ choosing a store

const pick = (options) => createRateLimitStore({ getPool: () => null, ensureSchema: async () => {}, log: () => {}, ...options });

test('with a database the shared store is used; without one, memory', () => {
  // Arrange / Act / Assert
  assert.ok(pick({ persistence: true, env: {} }) instanceof PostgresStore);
  assert.ok(pick({ persistence: false, env: {} }) instanceof MemoryStore);
});

test('RATE_LIMIT_STORE can force either store, and a bad value or an impossible request fails at startup', () => {
  // Arrange / Act / Assert
  assert.ok(pick({ persistence: true, env: { RATE_LIMIT_STORE: 'memory' } }) instanceof MemoryStore);
  assert.ok(pick({ persistence: true, env: { RATE_LIMIT_STORE: ' POSTGRES ' } }) instanceof PostgresStore);
  assert.ok(pick({ persistence: false, env: { RATE_LIMIT_STORE: 'postgres', DATABASE_URL: 'postgres://x' } }) instanceof PostgresStore);
  assert.throws(() => pick({ persistence: false, env: { RATE_LIMIT_STORE: 'postgres' } }), /needs DATABASE_URL/);
  assert.throws(() => pick({ persistence: true, env: { RATE_LIMIT_STORE: 'redis' } }), /must be "postgres" or "memory"/);
});

test('production never silently runs on process-local counters: it warns, once', () => {
  // Arrange
  resetRateLimitWarning();
  const warnings = [];
  const log = (m) => warnings.push(m);

  // Act
  pick({ persistence: false, env: { NODE_ENV: 'production' }, log });
  pick({ persistence: false, env: { NODE_ENV: 'production' }, log });
  pick({ persistence: true, env: { NODE_ENV: 'production' }, log });
  pick({ persistence: false, env: { NODE_ENV: 'development' }, log });

  // Assert
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /NOT shared across instances/);
  assert.match(warnings[0], /DATABASE_URL/);
  resetRateLimitWarning();
});

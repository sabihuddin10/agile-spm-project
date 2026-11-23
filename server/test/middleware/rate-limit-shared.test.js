/**
 * Shared rate limits (bolt 004) — middleware/rate-limit.js on a store several API instances share, and
 * the wiring in app.js. A fake database stands in for Postgres (see test/rate-limit-fake-db.js); the
 * real SQL and real concurrency are exercised by test-db/rate-limit.test.js.
 */
import { test, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { rateLimit, limitPost, STORE_OUTAGE_MESSAGE, STORE_OUTAGE_RETRY_SECONDS } from '../../src/middleware/rate-limit.js';
import { createApp } from '../../src/app.js';
import { PostgresStore } from '../../src/lib/rate-limit-store.js';
import { fakeDatabase } from '../rate-limit-fake-db.js';

const servers = [];
afterEach(async () => {
  mock.restoreAll();
  while (servers.length) {
    const server = servers.pop();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

/** Run a middleware against a fake request; resolves with the status sent, or 'next'. */
function run(mw, req = {}, { finishWith } = {}) {
  return new Promise((resolve) => {
    const headers = {};
    let onFinish;
    const res = {
      statusCode: 200,
      setHeader: (k, v) => { headers[k] = v; },
      status(code) { this.statusCode = code; return { json: (body) => resolve({ code, body, headers }) }; },
      once: (event, fn) => { if (event === 'finish') onFinish = fn; },
    };
    mw({ ip: '10.0.0.1', method: 'POST', path: '/', ...req }, res, () => {
      if (finishWith !== undefined) { res.statusCode = finishWith; onFinish?.(); }
      resolve('next');
    });
  });
}

const instance = (db, options = {}) => rateLimit({
  limit: 3, windowMs: 60_000, store: new PostgresStore({ getPool: () => db.pool }), name: 'booking-ip', ...options,
});

test('a shared store needs a stable name, so every instance counts the same limit', () => {
  // Arrange
  const db = fakeDatabase();

  // Act / Assert
  assert.throws(() => rateLimit({ limit: 1, windowMs: 1000, store: new PostgresStore({ getPool: () => db.pool }) }), /needs a stable "name"/);
  assert.doesNotThrow(() => rateLimit({ limit: 1, windowMs: 1000 }));
});

test('two instances on one store share the quota: the limit holds however the requests are spread', async () => {
  // Arrange
  const db = fakeDatabase();
  const a = instance(db);
  const b = instance(db);

  // Act
  const results = [await run(a), await run(b), await run(a), await run(b), await run(a)];

  // Assert
  assert.deepEqual(results.slice(0, 3), ['next', 'next', 'next']);
  assert.equal(results[3].code, 429);
  assert.equal(results[4].code, 429);
});

test('the 429 carries a positive Retry-After that reflects the shared reset time', async () => {
  // Arrange
  const db = fakeDatabase();
  const a = instance(db);
  const b = instance(db);
  for (let i = 0; i < 3; i += 1) await run(a);
  db.clock += 42_000;

  // Act
  const blocked = await run(b);

  // Assert: the other instance reports the time left on the one shared window
  assert.equal(blocked.code, 429);
  assert.equal(blocked.headers['Retry-After'], '18');
  assert.equal(blocked.body.error, 'Too many requests. Please try again later.');
});

test('different limits and different clients do not share counters', async () => {
  // Arrange
  const db = fakeDatabase();
  const bookings = instance(db, { limit: 1, name: 'booking-ip' });
  const applications = instance(db, { limit: 1, name: 'application-ip' });
  await run(bookings);

  // Act
  const otherLimit = await run(applications);
  const otherClient = await run(bookings, { ip: '10.0.0.2' });
  const sameBlocked = await run(bookings);

  // Assert
  assert.equal(otherLimit, 'next');
  assert.equal(otherClient, 'next');
  assert.equal(sameBlocked.code, 429);
});

test('failures-only: failed sign-ins stay counted across instances, and a success gives the attempt back', async () => {
  // Arrange
  const db = fakeDatabase();
  const emailKey = (req) => req.body.email;
  const a = instance(db, { limit: 3, name: 'auth-login-email', keyFor: emailKey, failuresOnly: true, exemptStaff: false });
  const b = instance(db, { limit: 3, name: 'auth-login-email', keyFor: emailKey, failuresOnly: true, exemptStaff: false });
  const req = { body: { email: 'a@example.com' } };

  // Act: two failures (one per instance), then a success on A, then a refund-aware count
  await run(a, req, { finishWith: 401 });
  await run(b, req, { finishWith: 403 });
  await run(a, req, { finishWith: 200 });
  await new Promise((resolve) => setImmediate(resolve));
  const third = await run(b, req, { finishWith: 401 });
  const fourth = await run(a, req, { finishWith: 401 });

  // Assert: the success did not count, so exactly three failed attempts fit before the block
  assert.equal(third, 'next');
  assert.equal(fourth.code, 429);
});

test('staff are still exempt from the public-form limit on a shared store', async () => {
  // Arrange
  const db = fakeDatabase();
  const limiter = instance(db, { limit: 0 });

  // Act
  const staff = await run(limiter, { user: { role: 'manager' } });
  const customer = await run(limiter, { user: { role: 'customer' } });

  // Assert
  assert.equal(staff, 'next');
  assert.equal(customer.code, 429);
  assert.equal(db.calls.length, 1, 'staff never reach the store');
});

// ------------------------------------------------------------------ store outage

test('when the shared store is unreachable, a sensitive request is refused with 503 and a short Retry-After', async () => {
  // Arrange
  const db = fakeDatabase();
  db.failWith = new Error('connection terminated unexpectedly');
  const errors = mock.method(console, 'error', () => {});

  // Act
  const result = await run(instance(db));

  // Assert
  assert.equal(result.code, 503);
  assert.deepEqual(result.body, { error: STORE_OUTAGE_MESSAGE });
  assert.equal(result.headers['Retry-After'], String(STORE_OUTAGE_RETRY_SECONDS));
  assert.equal(errors.mock.callCount(), 1);
});

test('the outage is observable in the logs, names the limit, and never includes the counted key', async () => {
  // Arrange
  const db = fakeDatabase();
  db.failWith = new Error('connection terminated unexpectedly');
  const errors = mock.method(console, 'error', () => {});
  const limiter = instance(db, { name: 'auth-login-email', keyFor: (req) => req.body.email });

  // Act
  await run(limiter, { body: { email: 'private.person@example.com' } });

  // Assert
  const line = String(errors.mock.calls[0].arguments[0]);
  assert.match(line, /store unavailable for "auth-login-email"/);
  assert.match(line, /refusing the request/);
  assert.match(line, /connection terminated unexpectedly/);
  assert.ok(!line.includes('private.person@example.com'));
});

test('a store that throws synchronously, or answers garbage, is treated as an outage too', async () => {
  // Arrange
  mock.method(console, 'error', () => {});
  const throwing = rateLimit({ limit: 1, windowMs: 1000, name: 'x', store: { consume() { throw new Error('boom'); }, refund() {} } });
  const garbage = rateLimit({ limit: 1, windowMs: 1000, name: 'x', store: new PostgresStore({ getPool: () => ({ query: async () => ({ rows: [] }) }) }) });

  // Act
  const results = [await run(throwing), await run(garbage)];

  // Assert
  assert.deepEqual(results.map((r) => r.code), [503, 503]);
});

test('onStoreError "allow" lets a request through during an outage, and says so in the log', async () => {
  // Arrange
  const db = fakeDatabase();
  db.failWith = new Error('down');
  const errors = mock.method(console, 'error', () => {});

  // Act
  const result = await run(instance(db, { onStoreError: 'allow' }));

  // Assert
  assert.equal(result, 'next');
  assert.match(String(errors.mock.calls[0].arguments[0]), /letting the request through/);
});

test('failing to give an attempt back never crashes the request or the process', async () => {
  // Arrange
  const errors = mock.method(console, 'error', () => {});
  const store = {
    consume: async () => ({ allowed: true, limit: 3, remaining: 2, retryAfterSeconds: 60 }),
    refund: async () => { throw new Error('refund failed'); },
  };
  const limiter = rateLimit({ limit: 3, windowMs: 1000, name: 'auth-login-email', store, failuresOnly: true, exemptStaff: false });

  // Act
  const result = await run(limiter, {}, { finishWith: 200 });
  await new Promise((resolve) => setImmediate(resolve));

  // Assert
  assert.equal(result, 'next');
  assert.match(String(errors.mock.calls[0].arguments[0]), /could not give back a counted attempt \(auth-login-email\): refund failed/);
});

// ------------------------------------------------------------------ in the app

async function startApp(options) {
  const server = createApp({ logging: false, persistence: false, ...options }).listen(0);
  servers.push(server);
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  return (method, path, body) => fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const wrongLogin = { email: 'customer@rest.test', password: 'definitely-wrong' };

test('two app instances on one store: sign-in failures made on one lock the account out on the other', async () => {
  // Arrange: two separate apps, as two serverless instances, sharing one counter store
  const db = fakeDatabase();
  const shared = () => new PostgresStore({ getPool: () => db.pool });
  const instanceA = await startApp({ limiterStore: shared() });
  const instanceB = await startApp({ limiterStore: shared() });

  // Act: five wrong passwords, alternating instances, then one more on each
  const statuses = [];
  for (let i = 0; i < 5; i += 1) statuses.push((await (i % 2 ? instanceB : instanceA)('POST', '/auth/login', wrongLogin)).status);
  const sixthOnA = await instanceA('POST', '/auth/login', wrongLogin);
  const sixthOnB = await instanceB('POST', '/auth/login', wrongLogin);

  // Assert
  assert.deepEqual(statuses, [401, 401, 401, 401, 401]);
  assert.equal(sixthOnA.status, 429);
  assert.equal(sixthOnB.status, 429);
  assert.ok(Number(sixthOnB.headers.get('retry-after')) > 0);
});

test('with the store down, sign-in and registration answer 503 while every other request is unaffected', async () => {
  // Arrange
  mock.method(console, 'error', () => {});
  const db = fakeDatabase();
  db.failWith = new Error('connection refused');
  const call = await startApp({ limiterStore: new PostgresStore({ getPool: () => db.pool }) });

  // Act
  const login = await call('POST', '/auth/login', { email: 'customer@rest.test', password: 'password' });
  const register = await call('POST', '/auth/register', { name: 'New Person', email: 'new@example.com', password: 'Str0ng!Passw0rd' });
  const menu = await call('GET', '/menu');
  const health = await call('GET', '/health');

  // Assert
  assert.equal(login.status, 503);
  assert.equal(register.status, 503);
  assert.equal(login.headers.get('retry-after'), String(STORE_OUTAGE_RETRY_SECONDS));
  assert.equal(menu.status, 200);
  assert.equal(health.status, 200);
});

test('the app counts each limit under its own stable name, so deployments agree', async () => {
  // Arrange
  const db = fakeDatabase();
  const call = await startApp({ limiterStore: new PostgresStore({ getPool: () => db.pool }) });

  // Act
  await call('POST', '/auth/login', wrongLogin);
  await call('POST', '/auth/register', { name: 'x' });
  await call('POST', '/reservations', {});
  await call('POST', '/staff/applications', {});

  // Assert
  const namespaces = [...db.rows.values()].map((r) => r.namespace).sort();
  assert.deepEqual(namespaces, ['application-ip', 'auth-login-email', 'auth-login-ip', 'auth-register-ip', 'booking-ip']);
});

test('limitPost still passes other methods and paths straight through without touching the store', async () => {
  // Arrange
  const db = fakeDatabase();
  const mw = limitPost('/applications', instance(db, { limit: 0 }));

  // Act
  const get = await run(mw, { method: 'GET', path: '/applications' });
  const other = await run(mw, { method: 'POST', path: '/other' });

  // Assert
  assert.equal(get, 'next');
  assert.equal(other, 'next');
  assert.equal(db.calls.length, 0);
});

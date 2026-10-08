/** Rate limit middleware — middleware/rate-limit.js, and its wiring on the public forms in app.js. */
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { rateLimit, limitPost } from '../../src/middleware/rate-limit.js';
import { createApp } from '../../src/app.js';

/** Run a middleware against a fake request; resolves with the status sent, or 'next'. */
function run(mw, req) {
  return new Promise((resolve) => {
    const headers = {};
    const res = {
      setHeader: (k, v) => { headers[k] = v; },
      status: (code) => ({ json: (body) => resolve({ code, body, headers }) }),
    };
    mw({ ip: '10.0.0.1', method: 'POST', path: '/', ...req }, res, () => resolve('next'));
  });
}

test('allows up to the limit per client, then answers 429 with Retry-After', async () => {
  // Arrange
  let clock = 0;
  const limiter = rateLimit({ limit: 2, windowMs: 60_000, now: () => clock });

  // Act
  const results = [await run(limiter, {}), await run(limiter, {}), await run(limiter, {})];

  // Assert
  assert.deepEqual(results.slice(0, 2), ['next', 'next']);
  assert.equal(results[2].code, 429);
  assert.equal(results[2].headers['Retry-After'], '60');
});

test('counts each client address separately and resets after the window', async () => {
  // Arrange
  let clock = 0;
  const limiter = rateLimit({ limit: 1, windowMs: 60_000, now: () => clock });
  await run(limiter, { ip: '10.0.0.1' });

  // Act
  const sameClient = await run(limiter, { ip: '10.0.0.1' });
  const otherClient = await run(limiter, { ip: '10.0.0.2' });
  clock = 60_000;
  const afterWindow = await run(limiter, { ip: '10.0.0.1' });

  // Assert
  assert.equal(sameClient.code, 429);
  assert.equal(otherClient, 'next');
  assert.equal(afterWindow, 'next');
});

test('signed-in staff are never limited; signed-in customers are', async () => {
  // Arrange
  const limiter = rateLimit({ limit: 0, windowMs: 60_000 });

  // Act
  const waiter = await run(limiter, { user: { role: 'waiter' } });
  const customer = await run(limiter, { user: { role: 'customer' } });

  // Assert
  assert.equal(waiter, 'next');
  assert.equal(customer.code, 429);
});

test('limitPost only limits POST to the given path', async () => {
  // Arrange
  const mw = limitPost('/applications', rateLimit({ limit: 0, windowMs: 60_000 }));

  // Act
  const post = await run(mw, { method: 'POST', path: '/applications' });
  const get = await run(mw, { method: 'GET', path: '/applications' });
  const otherPost = await run(mw, { method: 'POST', path: '/shifts' });

  // Assert
  assert.equal(post.code, 429);
  assert.equal(get, 'next');
  assert.equal(otherPost, 'next');
});

let server;
afterEach(() => new Promise((resolve) => {
  if (!server) return resolve();
  server.closeAllConnections();
  server.close(() => { server = null; resolve(); });
}));

test('the app limits guest job applications to 3 an hour and waves signed-in staff booking through', async () => {
  // Arrange
  server = createApp({ logging: false, persistence: false }).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const post = (path, body, token) => fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const application = (i) => ({ name: `Spam ${i}`, email: `spam${i}@example.com`, desiredRole: 'waiter' });
  const login = await (await post('/auth/login', { email: 'waiter@rest.test', password: 'password' })).json();

  // Act
  const statuses = [];
  for (let i = 0; i < 4; i += 1) statuses.push((await post('/staff/applications', application(i))).status);
  const bookings = [];
  for (let i = 0; i < 7; i += 1) {
    bookings.push((await post('/reservations', { customerName: `Walk-in ${i}`, partySize: 2, date: '2099-01-0' + (1 + (i % 7)), time: '19:00' }, login.token)).status);
  }

  // Assert
  assert.deepEqual(statuses, [201, 201, 201, 429]);
  assert.ok(bookings.every((s) => s !== 429), `staff bookings are never limited (got ${bookings})`);
});

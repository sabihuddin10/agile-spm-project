/**
 * Request hardening (bolt 003) — hostile or malformed traffic must get a safe 4xx and must never
 * take the API process down. Covers the surface of the patched middleware: body-parser (compressed
 * bodies, malformed JSON, size limit), qs (query-string parsing) and proxy-addr (client addressing
 * through X-Forwarded-For). Each test ends by proving the API still answers.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import zlib from 'node:zlib';
import { createApp } from '../../src/app.js';

let server;
let port;

before(async () => {
  server = createApp({ logging: false, persistence: false, rateLimits: false }).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  port = server.address().port;
});

after(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

/** Raw HTTP, so tests control the exact bytes and headers (fetch would normalise them). */
function send(targetPort, { method = 'GET', path, headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port: targetPort, method, path, headers, timeout: 5000 },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString('utf8') }));
      },
    );
    req.on('timeout', () => req.destroy(new Error('request timed out')));
    req.on('error', reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

const post = (path, body, headers = {}) => send(port, { method: 'POST', path, body, headers: { 'Content-Type': 'application/json', ...headers } });
const get = (path) => send(port, { path });

async function assertStillServing() {
  const res = await get('/api/health');
  assert.equal(res.status, 200, 'the API must still answer after hostile input');
}

const loginBody = JSON.stringify({ email: 'customer@rest.test', password: 'password' });

test('a compressed JSON body is accepted when well formed', async () => {
  // Arrange
  const body = zlib.gzipSync(loginBody);

  // Act
  const res = await post('/api/auth/login', body, { 'Content-Encoding': 'gzip' });

  // Assert
  assert.equal(res.status, 200);
  await assertStillServing();
});

test('a compressed body with trailing bytes after the stream is rejected without crashing the API', async () => {
  // Arrange
  const body = Buffer.concat([zlib.gzipSync(loginBody), Buffer.from('trailing-garbage-bytes')]);

  // Act
  const res = await post('/api/auth/login', body, { 'Content-Encoding': 'gzip' });

  // Assert
  assert.ok(res.status >= 400 && res.status < 500, `expected a 4xx, got ${res.status}`);
  await assertStillServing();
});

test('a truncated compressed body is a 4xx, not a crash', async () => {
  // Arrange
  const whole = zlib.gzipSync(loginBody);
  const body = whole.subarray(0, whole.length - 6);

  // Act
  const res = await post('/api/auth/login', body, { 'Content-Encoding': 'gzip' });

  // Assert
  assert.ok(res.status >= 400 && res.status < 500, `expected a 4xx, got ${res.status}`);
  await assertStillServing();
});

test('a body that is not the declared encoding is a 4xx', async () => {
  // Arrange
  const body = Buffer.from(loginBody); // plain JSON, but declared as gzip

  // Act
  const res = await post('/api/auth/login', body, { 'Content-Encoding': 'gzip' });

  // Assert
  assert.ok(res.status >= 400 && res.status < 500, `expected a 4xx, got ${res.status}`);
  await assertStillServing();
});

test('an unsupported content encoding is a 415, not a crash', async () => {
  // Arrange / Act
  const res = await post('/api/auth/login', loginBody, { 'Content-Encoding': 'compress-me-harder' });

  // Assert
  assert.equal(res.status, 415);
  await assertStillServing();
});

test('malformed JSON is a 400', async () => {
  // Arrange / Act
  const res = await post('/api/auth/login', '{"email": "customer@rest.test", "password": ');

  // Assert
  assert.equal(res.status, 400);
  await assertStillServing();
});

test('a body over the 100 KB limit is a 413', async () => {
  // Arrange
  const body = JSON.stringify({ email: 'customer@rest.test', password: 'x'.repeat(150 * 1024) });

  // Act
  const res = await post('/api/auth/login', body);

  // Assert
  assert.equal(res.status, 413);
  await assertStillServing();
});

test('a compressed body that inflates past the limit is a 413', async () => {
  // Arrange: small on the wire, large once inflated
  const body = zlib.gzipSync(JSON.stringify({ email: 'customer@rest.test', password: 'x'.repeat(2 * 1024 * 1024) }));
  assert.ok(body.length < 100 * 1024, 'the compressed body should be under the limit on its own');

  // Act
  const res = await post('/api/auth/login', body, { 'Content-Encoding': 'gzip' });

  // Assert
  assert.equal(res.status, 413);
  await assertStillServing();
});

test('prototype-shaped keys are a 400', async () => {
  // Arrange: a literal "__proto__" key survives JSON.parse as an own property
  const bodies = [
    '{"__proto__": {"role": "admin"}, "email": "a@b.co", "password": "x"}',
    '{"email": "a@b.co", "password": "x", "constructor": {"prototype": {"role": "admin"}}}',
    '{"email": "a@b.co", "nested": {"deep": {"__proto__": {"polluted": true}}}, "password": "x"}',
  ];

  for (const body of bodies) {
    // Act
    const res = await post('/api/auth/login', body);

    // Assert
    assert.equal(res.status, 400, body);
  }
  assert.equal({}.polluted, undefined, 'Object.prototype must stay clean');
  await assertStillServing();
});

test('query strings with repeated, bracketed or nested keys are a 400', async () => {
  // Arrange
  const hostile = [
    '/api/menu?a=1&a=2',
    '/api/menu?a[]=1&a[]=2',
    '/api/menu?a[b][c][d][e][f][g]=1',
    `/api/menu?${Array.from({ length: 200 }, (_, i) => `a[${i}]=x`).join('&')}`,
    '/api/menu?a[__proto__][polluted]=1',
  ];

  for (const path of hostile) {
    // Act
    const res = await get(path);

    // Assert
    assert.equal(res.status, 400, path.slice(0, 60));
  }
  assert.equal({}.polluted, undefined, 'Object.prototype must stay clean');
  await assertStillServing();
});

test('a comma-separated query value stays a plain string', async () => {
  // Arrange / Act
  const res = await get('/api/menu?tag=vegan,keto');

  // Assert
  assert.equal(res.status, 200);
});

test('an oversized query string does not crash the API', async () => {
  // Arrange
  const path = `/api/menu?q=${'a'.repeat(60_000)}`;

  // Act
  const res = await get(path);

  // Assert: refused by Node's header limit (431) or handled; never a crash
  assert.ok([200, 400, 414, 431].includes(res.status), `unexpected status ${res.status}`);
  await assertStillServing();
});

/** Boot an app with rate limits on, optionally trusting one proxy hop as on Vercel. */
async function withApp({ vercel }, run) {
  const saved = process.env.VERCEL;
  if (vercel) process.env.VERCEL = '1';
  else delete process.env.VERCEL;
  const app = createApp({ logging: false, persistence: false, rateLimits: true });
  if (saved === undefined) delete process.env.VERCEL;
  else process.env.VERCEL = saved;
  const instance = app.listen(0);
  await new Promise((resolve) => instance.once('listening', resolve));
  try {
    await run(instance.address().port);
  } finally {
    instance.closeAllConnections();
    await new Promise((resolve) => instance.close(resolve));
  }
}

/** 11 registrations from one socket, each claiming a different client in X-Forwarded-For. */
async function spoofedRegistrations(listenPort) {
  const statuses = [];
  for (let i = 0; i < 11; i += 1) {
    const res = await send(listenPort, {
      method: 'POST',
      path: '/api/auth/register',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `203.0.113.${i + 1}` },
      body: '{}', // invalid on purpose: the attempt still counts against the per-IP limit
    });
    statuses.push(res.status);
  }
  return statuses;
}

test('off Vercel, a spoofed X-Forwarded-For does not buy a fresh rate-limit bucket', async () => {
  await withApp({ vercel: false }, async (listenPort) => {
    // Act
    const statuses = await spoofedRegistrations(listenPort);

    // Assert: the header is ignored, so all 11 share one client and the 11th is throttled
    assert.equal(statuses.at(-1), 429, statuses.join(','));
  });
});

test('on Vercel, one trusted hop makes X-Forwarded-For the client address', async () => {
  await withApp({ vercel: true }, async (listenPort) => {
    // Act
    const statuses = await spoofedRegistrations(listenPort);

    // Assert: each claimed client has its own bucket, so none is throttled
    assert.ok(!statuses.includes(429), statuses.join(','));
  });
});

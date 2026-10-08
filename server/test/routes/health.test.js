/** Health module — routes/health.js (status page, endpoint catalogue, live probes). */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from '../helpers.js';
import { createApp } from '../../src/app.js';
import { snapshot } from '../../src/data/snapshot.js';
import { setPool } from '../../src/data/db.js';

const BROWSER_ACCEPT = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';

let api;
before(async () => {
  api = await startServer();
});
after(() => api.close());

const get = (path, headers = {}) => fetch(api.base + path, { headers });

test('GET /api/health returns JSON by default, keeping the legacy fields', async () => {
  // Act
  const { status, body } = await api.call('GET', '/health');

  // Assert
  assert.equal(status, 200);
  assert.equal(body.status, 'ok');
  assert.equal(body.service, 'restaurant-ops-api');
  assert.ok(!Number.isNaN(Date.parse(body.time)));
  assert.equal(typeof body.uptimeSeconds, 'number');
  assert.deepEqual(body.persistence, { enabled: false, store: 'memory' });
  assert.ok(body.endpoints > 50);
});

test('plain fetch / curl (Accept: */*) still gets JSON', async () => {
  // Act
  const res = await get('/health', { accept: '*/*' });

  // Assert
  assert.match(res.headers.get('content-type'), /application\/json/);
  assert.equal((await res.json()).status, 'ok');
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.match(res.headers.get('vary'), /Accept/);
});

test('a browser gets the HTML status page with endpoint rows and a nonce-locked script', async () => {
  // Act
  const res = await get('/health', { accept: BROWSER_ACCEPT });
  const html = await res.text();

  // Assert
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  assert.match(html, /<title>API status · restaurant-ops-api<\/title>/);
  const rows = html.match(/<details class="ep"/g) || [];
  const { body } = await api.call('GET', '/health/endpoints');
  assert.equal(rows.length, body.count, 'one row per endpoint');
  assert.match(html, /data-id="GET \/api\/menu"/);
  assert.match(html, /data-id="DELETE \/api\/customers\/:id"[^>]*data-status="skipped"/);
  const nonce = res.headers.get('content-security-policy').match(/'nonce-([^']+)'/)[1];
  assert.ok(html.includes(`<script nonce="${nonce}">`));
  assert.doesNotMatch(html, /<script(?! nonce)/, 'no other scripts');
});

test('?format=json overrides a browser Accept header', async () => {
  // Act
  const res = await get('/health?format=json', { accept: BROWSER_ACCEPT });

  // Assert
  assert.match(res.headers.get('content-type'), /application\/json/);
  assert.equal((await res.json()).status, 'ok');
});

test('the status page leaks no secrets or live records', async () => {
  // Arrange
  process.env.HEALTH_TEST_SECRET = 'super-secret-value-123';

  // Act
  const html = await (await get('/health', { accept: BROWSER_ACCEPT })).text();
  const catalogue = JSON.stringify((await api.call('GET', '/health/endpoints')).body);

  // Assert
  for (const text of [html, catalogue]) {
    assert.ok(!text.includes('super-secret-value-123'));
    assert.doesNotMatch(text, /DATABASE_URL|JWT_SECRET|postgres:\/\//);
    assert.doesNotMatch(text, /passwordHash|\$2[aby]\$/);
    assert.ok(!text.includes('Plate & Flame') && !text.includes('Plate &amp; Flame'), 'no live settings values');
  }
  delete process.env.HEALTH_TEST_SECRET;
});

test('GET /api/health/endpoints lists every module with docs and probe flags', async () => {
  // Act
  const { status, body } = await api.call('GET', '/health/endpoints');

  // Assert
  assert.equal(status, 200);
  const modules = new Set(body.endpoints.map((e) => e.module));
  for (const m of ['auth', 'customers', 'menu', 'orders', 'billing', 'tables', 'reservations', 'inventory', 'staff', 'analytics', 'notifications', 'settings']) {
    assert.ok(modules.has(m), `missing module ${m}`);
  }
  const login = body.endpoints.find((e) => e.id === 'POST /api/auth/login');
  assert.equal(login.body.email.required, true);
  assert.equal(login.probe.enabled, false);
});

test('GET /api/health/check reports public GETs up, protected GETs up-with-auth, mutations unprobed, and changes nothing', async () => {
  // Arrange
  const before = JSON.stringify(snapshot());

  // Act
  const { status, body } = await api.call('GET', '/health/check');
  const after = JSON.stringify(snapshot());

  // Assert
  assert.equal(status, 200);
  const byId = Object.fromEntries(body.results.map((r) => [r.id, r]));
  assert.equal(byId['GET /api/menu'].status, 'up');
  assert.equal(byId['GET /api/menu'].httpStatus, 200);
  assert.equal(typeof byId['GET /api/menu'].latencyMs, 'number');
  assert.equal(byId['GET /api/reservations/availability'].status, 'up', 'probe supplies the required date');
  for (const id of ['GET /api/orders', 'GET /api/customers/:id', 'GET /api/analytics/dashboard', 'GET /api/notifications']) {
    assert.equal(byId[id].status, 'auth', id);
    assert.equal(byId[id].httpStatus, 401, id);
  }
  assert.equal(byId['POST /api/orders'].status, 'skipped');
  assert.equal(byId['DELETE /api/auth/users/:id'].status, 'skipped');
  assert.equal(body.summary.down, 0);
  assert.equal(body.summary.warn, 0);
  assert.equal(body.summary.total, body.results.length);
  assert.deepEqual(body.database, { enabled: false, status: 'off' });
  assert.equal(after, before, 'probing left the store untouched');
});

test('with persistence on, /api/health opens no DB connection and /check reports a broken store as down', async () => {
  // Arrange — a pool whose connections always fail, counting every use
  const used = { connect: 0, queries: [] };
  setPool({
    connect: async () => { used.connect += 1; throw new Error('db unreachable'); },
    query: async (sql) => { used.queries.push(sql.trim().split(/\s+/)[0]); return { rows: [] }; },
  });
  const server = createApp({ logging: false, persistence: true }).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const quiet = console.error;
  console.error = () => {};

  try {
    // Act
    const health = await (await fetch(`${base}/health`)).json();
    const page = await fetch(`${base}/health`, { headers: { accept: BROWSER_ACCEPT } });
    await page.text();
    const connectsBeforeCheck = used.connect;
    const check = await (await fetch(`${base}/health/check`)).json();

    // Assert
    assert.equal(health.status, 'ok');
    assert.deepEqual(health.persistence, { enabled: true, store: 'postgres' });
    assert.equal(page.status, 200);
    assert.equal(connectsBeforeCheck, 0, 'health routes never open a transaction');
    assert.equal(check.results.find((r) => r.id === 'GET /api/menu').status, 'down');
    assert.equal(check.results.find((r) => r.id === 'GET /api/health').status, 'up', 'health itself bypasses the store');
    assert.ok(check.summary.down > 0);
    assert.equal(check.database.enabled, true);
  } finally {
    console.error = quiet;
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    setPool(undefined);
  }
});

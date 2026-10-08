/** API catalogue — lib/api-catalog.js (the endpoint list behind /api/health). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express, { Router } from 'express';
import { createApp } from '../../src/app.js';
import {
  buildCatalog, listRoutes, mountPath, probeUrl, ROUTE_DOCS, MODULES, MUTATING_METHODS,
} from '../../src/lib/api-catalog.js';
import { requireRole } from '../../src/middleware/auth.js';

const app = createApp({ logging: false, persistence: false });
const routesDir = fileURLToPath(new URL('../../src/routes/', import.meta.url));

test('every route registered in the app appears in the catalogue', () => {
  // Arrange
  const registered = listRoutes(app).map((r) => `${r.method} ${r.path}`);

  // Act
  const ids = buildCatalog(app).map((e) => e.id);

  // Assert
  assert.ok(registered.length > 50, 'the router walk found the mounted routers');
  assert.deepEqual([...ids].sort(), [...registered].sort());
  assert.equal(new Set(ids).size, ids.length, 'no duplicate entries');
});

test('the router walk agrees with a plain count of router.<verb>( calls in src/routes', () => {
  // Arrange — an independent count straight from the source files
  const declared = readdirSync(routesDir)
    .filter((f) => f.endsWith('.js'))
    .reduce((n, f) => n + (readFileSync(routesDir + f, 'utf8').match(/^router\.(get|post|put|patch|delete)\(/gm) || []).length, 0);

  // Act
  const catalogued = buildCatalog(app).length;

  // Assert
  assert.equal(catalogued, declared);
});

test('every documented route maps to a real route (no stale docs) and every real route is documented', () => {
  // Arrange
  const live = new Set(buildCatalog(app).map((e) => e.id));

  // Act
  const stale = Object.keys(ROUTE_DOCS).filter((id) => !live.has(id));
  const undocumented = buildCatalog(app).filter((e) => !e.documented).map((e) => e.id);

  // Assert
  assert.deepEqual(stale, []);
  assert.deepEqual(undocumented, []);
});

test('every entry belongs to a known module and the catalogue is grouped in module order', () => {
  // Act
  const modules = buildCatalog(app).map((e) => e.module);

  // Assert
  for (const m of modules) assert.ok(MODULES.includes(m), `unknown module ${m}`);
  const order = modules.map((m) => MODULES.indexOf(m));
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
});

test('mutating routes are never marked probe-able', () => {
  // Act
  const catalog = buildCatalog(app);

  // Assert
  const mutating = catalog.filter((e) => MUTATING_METHODS.includes(e.method));
  assert.ok(mutating.length > 0);
  for (const e of mutating) {
    assert.equal(e.probe.enabled, false, `${e.id} must not be probed`);
    assert.equal(e.probe.reason, 'Not probed (mutating)');
  }
  for (const e of catalog.filter((x) => x.probe.enabled)) assert.equal(e.method, 'GET');
  assert.equal(catalog.find((e) => e.id === 'GET /api/health/check').probe.enabled, false, 'the check does not probe itself');
});

test('roles come from requireRole guards in code; handler-only rules come from the docs', () => {
  // Act
  const byId = Object.fromEntries(buildCatalog(app).map((e) => [e.id, e]));

  // Assert
  assert.deepEqual(byId['GET /api/auth/users'].roles, ['manager', 'admin']);
  assert.equal(byId['GET /api/auth/users'].rolesSource, 'guard');
  assert.deepEqual(byId['DELETE /api/auth/users/:id'].roles, ['admin'], 'requireAdmin = authenticate + requireRole(admin)');
  assert.deepEqual(byId['POST /api/billing/:id/refund'].roles, ['manager', 'admin']);
  assert.equal(byId['PATCH /api/customers/me'].rolesSource, 'handler');
  assert.equal(byId['GET /api/menu'].auth, 'optional');
  assert.equal(byId['GET /api/auth/roles'].auth, 'none');
  assert.equal(byId['GET /api/orders/mine'].auth, 'required', 'authenticate mounted on /api/orders');
  assert.equal(byId['GET /api/reservations/mine'].auth, 'required', 'handler rejects guests');
});

test('documented handler roles never contradict a requireRole guard', () => {
  // Act
  const conflicts = listRoutes(app).filter((r) => {
    const doc = ROUTE_DOCS[`${r.method} ${r.path}`];
    return r.guardRoles && doc?.roles && JSON.stringify(doc.roles) !== JSON.stringify(r.guardRoles);
  });

  // Assert
  assert.deepEqual(conflicts, []);
});

test('a route without docs is still listed, flagged undocumented', () => {
  // Arrange
  const extra = express();
  const router = Router();
  router.get('/secret-new-thing', requireRole('admin'), (req, res) => res.json({}));
  router.post('/', (req, res) => res.json({}));
  extra.use('/api/widgets', router);

  // Act
  const catalog = buildCatalog(extra);

  // Assert
  assert.equal(catalog.length, 2);
  const get = catalog.find((e) => e.method === 'GET');
  assert.equal(get.path, '/api/widgets/secret-new-thing');
  assert.equal(get.documented, false);
  assert.match(get.summary, /undocumented/i);
  assert.deepEqual(get.roles, ['admin']);
  assert.equal(catalog.find((e) => e.method === 'POST').probe.enabled, false);
});

test('mountPath recovers the prefix from an Express 4 mount layer', () => {
  // Arrange
  const layers = app._router.stack.filter((l) => l.name === 'router');

  // Act
  const prefixes = layers.map(mountPath);

  // Assert
  assert.ok(prefixes.includes('/api/auth'));
  assert.ok(prefixes.includes('/api/notifications'));
  assert.ok(prefixes.every((p) => typeof p === 'string' && p.startsWith('/api/')));
});

test('probeUrl fills path params with a placeholder and adds required query params', () => {
  // Arrange
  const byId = Object.fromEntries(buildCatalog(app).map((e) => [e.id, e]));

  // Act
  const receipt = probeUrl(byId['GET /api/billing/:id/receipt']);
  const availability = probeUrl(byId['GET /api/reservations/availability']);

  // Assert
  assert.equal(receipt, '/api/billing/__probe__/receipt');
  assert.match(availability, /^\/api\/reservations\/availability\?date=\d{4}-\d{2}-\d{2}&partySize=2$/);
});

test('example responses are static shapes, not secrets', () => {
  // Arrange
  const text = JSON.stringify(ROUTE_DOCS);

  // Assert
  assert.doesNotMatch(text, /postgres(ql)?:\/\//i);
  assert.doesNotMatch(text, /passwordHash/);
  assert.doesNotMatch(text, /\$2[aby]\$/, 'no bcrypt hashes');
  assert.doesNotMatch(text, /eyJ[A-Za-z0-9_-]{10,}/, 'no real JWTs');
});

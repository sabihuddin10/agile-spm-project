/** Status page renderer — lib/health-page.js. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esc, renderHealthPage } from '../../src/lib/health-page.js';

const entry = (overrides = {}) => ({
  id: 'GET /api/things', module: 'things', method: 'GET', path: '/api/things', params: [], documented: true,
  summary: 'Things.', auth: 'none', roles: [], rolesSource: null, access: null, query: null, body: null,
  response: { status: 200, example: { things: [] } }, errors: [], probe: { enabled: true }, ...overrides,
});

const render = (catalog) => renderHealthPage({
  catalog, service: 'svc', uptimeSeconds: 61, persistence: false, nonce: 'abc', generatedAt: '2026-10-08T00:00:00.000Z',
});

test('esc escapes HTML-significant characters', () => {
  // Act
  const out = esc(`<a href="x" onclick='y'>&</a>`);

  // Assert
  assert.equal(out, '&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;');
  assert.equal(esc(null), '');
});

test('every interpolated catalogue string is escaped', () => {
  // Arrange
  const evil = '<img src=x onerror=alert(1)>';
  const catalog = [entry({
    id: `GET /api/${evil}`, path: `/api/${evil}`, summary: evil, access: evil, roles: [evil], auth: 'required', rolesSource: 'guard',
    query: { [evil]: { type: evil, required: false, note: evil } }, response: { status: 200, example: { [evil]: evil } }, errors: [evil],
  })];

  // Act
  const html = render(catalog);

  // Assert
  assert.ok(!html.includes(evil), 'raw markup never reaches the page');
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
});

test('rows group by module, flag undocumented routes and mark mutating ones not probed', () => {
  // Arrange
  const catalog = [
    entry(),
    entry({ id: 'POST /api/things', method: 'POST', documented: false, summary: 'Undocumented', probe: { enabled: false, reason: 'Not probed (mutating)' } }),
  ];

  // Act
  const html = render(catalog);

  // Assert
  assert.equal((html.match(/<section class="module"/g) || []).length, 1);
  assert.match(html, /data-id="POST \/api\/things"[^>]*data-status="skipped"[^>]*data-undocumented/);
  assert.match(html, /<span class="flag">undocumented<\/span>/);
  assert.match(html, /Not probed \(mutating\): calling it could change data/);
  assert.match(html, /<script nonce="abc">/);
  assert.match(html, /prefers-color-scheme:dark/);
});

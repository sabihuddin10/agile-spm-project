/** Security headers — middleware/security-headers.js and the app wiring in app.js. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from '../helpers.js';

let api;
before(async () => {
  api = await startServer();
});
after(() => api.close());

test('every API answer carries the baseline security headers', async () => {
  // Arrange
  const paths = ['/menu', '/health', '/does-not-exist'];

  for (const path of paths) {
    // Act
    const res = await api.call('GET', path);

    // Assert
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff', path);
    assert.equal(res.headers.get('referrer-policy'), 'no-referrer', path);
    assert.equal(res.headers.get('cross-origin-resource-policy'), 'same-site', path);
  }
});

test('the server no longer announces that it runs Express', async () => {
  // Arrange / Act
  const res = await api.call('GET', '/menu');

  // Assert
  assert.equal(res.headers.get('x-powered-by'), null);
});

test('error answers carry the headers too', async () => {
  // Arrange / Act
  const res = await api.call('POST', '/auth/login', { body: { email: 'nobody@rest.test', password: 'wrong-password-1' } });

  // Assert
  assert.ok(res.status >= 400);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
});

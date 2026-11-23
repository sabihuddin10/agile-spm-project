/** Token signing/verification — lib/jwt.js. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { signToken, signingSecret, verifyToken } from '../../src/lib/jwt.js';

const SECRET = process.env.JWT_SECRET || 'dev-insecure-secret-change-me';

test('a signed token verifies back to the same subject and role', () => {
  // Arrange
  const user = { id: 'usr_waiter', role: 'waiter' };

  // Act
  const token = signToken(user);
  const payload = verifyToken(token);

  // Assert
  assert.equal(payload.sub, 'usr_waiter');
  assert.equal(payload.role, 'waiter');
});

test('an invalid or malformed token fails to verify', () => {
  // Arrange / Act / Assert
  assert.equal(verifyToken('not-a-real-token'), null);
  assert.equal(verifyToken(''), null);
});

test('a token signed with a different secret fails to verify', () => {
  // Arrange
  const foreign = jwt.sign({ sub: 'usr_admin', role: 'admin' }, 'a-different-secret');

  // Act
  const payload = verifyToken(foreign);

  // Assert
  assert.equal(payload, null);
});

test('a tampered token fails to verify', () => {
  // Arrange
  const token = signToken({ id: 'usr_manager', role: 'manager' });
  const tampered = token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a');

  // Act
  const payload = verifyToken(tampered);

  // Assert
  assert.equal(payload, null);
});

test('an expired token fails to verify', () => {
  // Arrange
  const expired = jwt.sign({ sub: 'usr_customer', role: 'customer' }, SECRET, { expiresIn: -10 });

  // Act
  const payload = verifyToken(expired);

  // Assert
  assert.equal(payload, null);
});

// ---- production configuration (bolt 008): the API must not start with a missing or built-in secret

const DEV_SECRET = 'dev-insecure-secret-change-me';

/** Runs `fn` with NODE_ENV and JWT_SECRET set (undefined removes them), then restores both. */
function withEnv({ NODE_ENV, JWT_SECRET }, fn) {
  const saved = { NODE_ENV: process.env.NODE_ENV, JWT_SECRET: process.env.JWT_SECRET };
  const set = (name, value) => (value === undefined ? delete process.env[name] : (process.env[name] = value));
  set('NODE_ENV', NODE_ENV);
  set('JWT_SECRET', JWT_SECRET);
  try {
    return fn();
  } finally {
    set('NODE_ENV', saved.NODE_ENV);
    set('JWT_SECRET', saved.JWT_SECRET);
  }
}

test('in production a missing, blank or built-in JWT_SECRET is refused before the API starts', () => {
  // Arrange
  const unusable = [undefined, '', '   ', DEV_SECRET, `  ${DEV_SECRET}  `];

  for (const JWT_SECRET of unusable) {
    // Act / Assert
    assert.throws(
      () => withEnv({ NODE_ENV: 'production', JWT_SECRET }, signingSecret),
      /JWT_SECRET must be configured for production/,
      JSON.stringify(JWT_SECRET),
    );
  }
});

test('the production error names the setting and never reveals a secret value', () => {
  // Arrange
  let message = '';

  // Act
  try {
    withEnv({ NODE_ENV: 'production', JWT_SECRET: DEV_SECRET }, signingSecret);
  } catch (err) {
    message = err.message;
  }

  // Assert
  assert.match(message, /JWT_SECRET/);
  assert.ok(!message.includes(DEV_SECRET), 'the error must not print the secret');
});

test('in production a real JWT_SECRET is used, trimmed', () => {
  // Arrange / Act
  const secret = withEnv({ NODE_ENV: 'production', JWT_SECRET: '  a-real-random-production-secret  ' }, signingSecret);

  // Assert
  assert.equal(secret, 'a-real-random-production-secret');
});

test('outside production the built-in development secret is still available, so local use stays convenient', () => {
  // Arrange / Act / Assert
  assert.equal(withEnv({ NODE_ENV: undefined, JWT_SECRET: undefined }, signingSecret), DEV_SECRET);
  assert.equal(withEnv({ NODE_ENV: 'test', JWT_SECRET: '' }, signingSecret), DEV_SECRET);
  assert.equal(withEnv({ NODE_ENV: 'development', JWT_SECRET: 'my-own-dev-secret' }, signingSecret), 'my-own-dev-secret');
});

test('creating the app in production without a valid secret fails immediately, so no traffic is accepted', async () => {
  // Arrange
  const { createApp } = await import('../../src/app.js');

  // Act / Assert
  assert.throws(
    () => withEnv({ NODE_ENV: 'production', JWT_SECRET: undefined }, () => createApp({ logging: false, persistence: false, rateLimits: false })),
    /JWT_SECRET must be configured for production/,
  );
});

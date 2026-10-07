/** Token signing/verification — lib/jwt.js. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { signToken, verifyToken } from '../../src/lib/jwt.js';

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

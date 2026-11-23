/** Password hashing — lib/passwords.js: one place for the bcrypt work factor, and upgrading older hashes on sign-in. */
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import {
  DEFAULT_BCRYPT_COST, MAX_BCRYPT_COST, MIN_BCRYPT_COST, bcryptCost, hashPassword, needsRehash, passwordMatches,
} from '../../src/lib/passwords.js';
import { findUserByEmail } from '../../src/data/store.js';
import { startServer } from '../helpers.js';

const saved = process.env.BCRYPT_COST;
afterEach(() => {
  if (saved === undefined) delete process.env.BCRYPT_COST;
  else process.env.BCRYPT_COST = saved;
});

test('the cost defaults to 10, follows BCRYPT_COST, and a bad value can neither weaken nor cripple hashing', () => {
  // Arrange / Act / Assert
  assert.equal(bcryptCost({}), DEFAULT_BCRYPT_COST);
  assert.equal(bcryptCost({ BCRYPT_COST: '12' }), 12);
  assert.equal(bcryptCost({ BCRYPT_COST: ' 11 ' }), 11);
  assert.equal(bcryptCost({ BCRYPT_COST: '4' }), MIN_BCRYPT_COST, 'never below the default');
  assert.equal(bcryptCost({ BCRYPT_COST: '99' }), MAX_BCRYPT_COST, 'never so high that sign-in takes seconds');
  for (const junk of ['', 'abc', 'NaN', '-3x', undefined]) assert.equal(bcryptCost({ BCRYPT_COST: junk }), junk === '-3x' ? MIN_BCRYPT_COST : DEFAULT_BCRYPT_COST, String(junk));
});

test('hashPassword makes a verifiable bcrypt hash at the configured cost', () => {
  // Arrange / Act
  const hash = hashPassword('Correct-Horse-9!', { BCRYPT_COST: '11' });

  // Assert
  assert.match(hash, /^\$2[aby]\$11\$/);
  assert.equal(bcrypt.compareSync('Correct-Horse-9!', hash), true);
  assert.equal(bcrypt.compareSync('Wrong-Horse-9!', hash), false);
});

test('needsRehash is true only when the stored hash used less work than is configured', () => {
  // Arrange
  const cheap = hashPassword('Correct-Horse-9!', { BCRYPT_COST: '10' });
  const dear = hashPassword('Correct-Horse-9!', { BCRYPT_COST: '11' });

  // Act / Assert
  assert.equal(needsRehash(cheap, { BCRYPT_COST: '10' }), false);
  assert.equal(needsRehash(cheap, { BCRYPT_COST: '11' }), true);
  assert.equal(needsRehash(dear, { BCRYPT_COST: '10' }), false, 'a stronger hash is never downgraded');
  assert.equal(needsRehash('not a bcrypt hash', {}), true);
  assert.equal(needsRehash(undefined, {}), true);
});

test('passwordMatches checks a real hash, and an unknown user costs the same work and never matches', () => {
  // Arrange
  const user = { passwordHash: hashPassword('Correct-Horse-9!') };

  // Act / Assert
  assert.equal(passwordMatches(user, 'Correct-Horse-9!'), true);
  assert.equal(passwordMatches(user, 'wrong'), false);
  assert.equal(passwordMatches(undefined, 'Correct-Horse-9!'), false);
  assert.equal(passwordMatches(user, 42), false);
  assert.equal(passwordMatches(user, 'x'.repeat(500)), false);
});

test('signing in upgrades an older hash to the configured cost, and the password keeps working', async () => {
  // Arrange: the seeded customer has a cost-10 hash; ask for cost 11
  const server = await startServer();
  try {
    const before = findUserByEmail('customer@rest.test').passwordHash;
    assert.equal(bcrypt.getRounds(before), 10);
    process.env.BCRYPT_COST = '11';

    // Act
    const first = await server.call('POST', '/auth/login', { body: { email: 'customer@rest.test', password: 'password' } });
    const upgraded = findUserByEmail('customer@rest.test').passwordHash;
    const second = await server.call('POST', '/auth/login', { body: { email: 'customer@rest.test', password: 'password' } });

    // Assert
    assert.equal(first.status, 200);
    assert.equal(bcrypt.getRounds(upgraded), 11);
    assert.notEqual(upgraded, before);
    assert.equal(second.status, 200);
    assert.equal(findUserByEmail('customer@rest.test').passwordHash, upgraded, 'upgraded once, not on every sign-in');
  } finally {
    await server.close();
  }
});

test('a wrong password never upgrades or changes the stored hash', async () => {
  // Arrange
  const server = await startServer();
  try {
    const before = findUserByEmail('chef@rest.test').passwordHash;
    process.env.BCRYPT_COST = '11';

    // Act
    const res = await server.call('POST', '/auth/login', { body: { email: 'chef@rest.test', password: 'not-the-password' } });

    // Assert
    assert.equal(res.status, 401);
    assert.equal(findUserByEmail('chef@rest.test').passwordHash, before);
  } finally {
    await server.close();
  }
});

test('changing a password uses the configured cost', async () => {
  // Arrange
  const server = await startServer();
  try {
    process.env.BCRYPT_COST = '11';
    const token = await server.login('waiter2');

    // Act
    const res = await server.call('POST', '/auth/me/password', { token, body: { currentPassword: 'password', newPassword: 'Brand-New-Pass-42!' } });

    // Assert
    assert.equal(res.status, 200);
    assert.equal(bcrypt.getRounds(findUserByEmail('waiter2@rest.test').passwordHash), 11);
  } finally {
    await server.close();
  }
});

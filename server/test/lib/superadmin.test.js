/** Binding the super admin role — lib/superadmin.js (scripts/superadmin.js runs it on a database). */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { users, findUserByEmail, createUser } from '../../src/data/store.js';
import { snapshot, restore } from '../../src/data/snapshot.js';
import { bindSuperadmin } from '../../src/lib/superadmin.js';

const seed = snapshot();
beforeEach(() => restore(seed));

const holders = () => users.filter((u) => u.role === 'superadmin').map((u) => u.email);
const NEW_PASSWORD = 'Ledger-Kite-42!';

test('binding an existing account promotes it with the new password and signs out its sessions and the old holder\'s', () => {
  // Arrange
  const shahan = findUserByEmail('shahanarain33@gmail.com');
  const sabih = findUserByEmail('sabihuddin106@gmail.com');
  const [shahanVersion, sabihVersion] = [shahan.tokenVersion, sabih.tokenVersion];

  // Act
  const result = bindSuperadmin({ email: 'Shahanarain33@gmail.com ', password: NEW_PASSWORD });

  // Assert
  assert.equal(result.created, false);
  assert.equal(result.user.role, 'superadmin');
  assert.deepEqual(result.demoted, ['sabihuddin106@gmail.com']);
  assert.deepEqual(holders(), ['shahanarain33@gmail.com']);
  assert.ok(bcrypt.compareSync(NEW_PASSWORD, shahan.passwordHash), 'the typed password is set');
  assert.ok(!bcrypt.compareSync('Admin@123456', shahan.passwordHash), 'the old password no longer works');
  assert.equal(shahan.tokenVersion, shahanVersion + 1, 'its existing sessions end');
  assert.equal(sabih.role, 'admin');
  assert.equal(sabih.tokenVersion, sabihVersion + 1, "the old holder's sessions end");
});

test('an account someone else registered with the bound email loses its password and sessions to the bind', () => {
  // Arrange — e.g. a visitor registered the public email before the operator bound it
  const squatter = createUser({ name: 'Not Sabih', email: 'claimed@example.com', password: 'Squatter-Pass-1!', role: 'customer' });

  // Act
  bindSuperadmin({ email: 'claimed@example.com', password: NEW_PASSWORD });

  // Assert
  assert.equal(squatter.role, 'superadmin');
  assert.ok(!bcrypt.compareSync('Squatter-Pass-1!', squatter.passwordHash), "the squatter's password is gone");
  assert.ok(bcrypt.compareSync(NEW_PASSWORD, squatter.passwordHash));
  assert.equal(squatter.tokenVersion, 1, "the squatter's sessions end");
});

test('binding the current super admin again only replaces its password', () => {
  // Act
  const result = bindSuperadmin({ email: 'sabihuddin106@gmail.com', password: NEW_PASSWORD });

  // Assert
  assert.equal(result.created, false);
  assert.deepEqual(result.demoted, []);
  assert.deepEqual(holders(), ['sabihuddin106@gmail.com']);
  assert.ok(bcrypt.compareSync(NEW_PASSWORD, findUserByEmail('sabihuddin106@gmail.com').passwordHash));
});

test('binding a suspended account reactivates it', () => {
  // Arrange
  findUserByEmail('manager@rest.test').active = false;

  // Act
  const result = bindSuperadmin({ email: 'manager@rest.test', password: NEW_PASSWORD });

  // Assert
  assert.equal(result.user.active, true);
  assert.deepEqual(holders(), ['manager@rest.test']);
});

test('with no account for the email, it creates an active super admin with that password', () => {
  // Arrange
  const count = users.length;

  // Act
  const result = bindSuperadmin({ email: 'owner@example.com', name: 'Olive Owner', password: 'Ledger-Kite-42!' });

  // Assert
  const created = findUserByEmail('owner@example.com');
  assert.equal(result.created, true);
  assert.equal(users.length, count + 1);
  assert.equal(created.role, 'superadmin');
  assert.equal(created.active, true);
  assert.equal(created.mustChangePassword, false);
  assert.ok(bcrypt.compareSync('Ledger-Kite-42!', created.passwordHash));
  assert.ok(!('passwordHash' in result.user), 'the result never carries the hash');
  assert.deepEqual(holders(), ['owner@example.com']);
});

test('every bind needs a password that meets the policy, and creating also needs a name; nothing changes otherwise', () => {
  // Arrange
  const before = JSON.stringify(snapshot());

  // Act / Assert
  assert.throws(() => bindSuperadmin({ email: 'shahanarain33@gmail.com' }), /password/i);
  assert.throws(() => bindSuperadmin({ email: 'shahanarain33@gmail.com', password: 'weakpass' }), /Password needs/);
  assert.throws(() => bindSuperadmin({ email: 'owner@example.com', name: 'Olive Owner' }), /password/i);
  assert.throws(() => bindSuperadmin({ email: 'owner@example.com', name: 'Olive Owner', password: 'short' }), /Password needs/);
  assert.throws(() => bindSuperadmin({ email: 'owner@example.com', password: 'Ledger-Kite-42!' }), /name/i);
  assert.throws(() => bindSuperadmin({ email: 'not-an-email', name: 'Olive Owner', password: 'Ledger-Kite-42!' }), /email/i);
  assert.equal(JSON.stringify(snapshot()), before);
});

/** Account hierarchy — lib/hierarchy.js: who may manage whose staff account. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ASSIGNABLE_ROLES, canManage, hasRole, rankOf } from '../../src/lib/hierarchy.js';

const user = (id, role) => ({ id, role });

test('ranks admin above manager above chef and waiter, who are peers', () => {
  // Act / Assert
  assert.ok(rankOf('admin') > rankOf('manager'));
  assert.ok(rankOf('manager') > rankOf('chef'));
  assert.equal(rankOf('chef'), rankOf('waiter'));
  assert.equal(rankOf('customer'), 0);
});

test('every actor × target pair follows the strictly-lower rule', () => {
  // Arrange — expected[actor][target]
  const roles = ['admin', 'manager', 'chef', 'waiter'];
  const expected = {
    admin: { admin: false, manager: true, chef: true, waiter: true },
    manager: { admin: false, manager: false, chef: true, waiter: true },
    chef: { admin: false, manager: false, chef: false, waiter: false },
    waiter: { admin: false, manager: false, chef: false, waiter: false },
  };

  // Act
  const actual = Object.fromEntries(roles.map((a) => [a, Object.fromEntries(roles.map((t) => [t, canManage(user('a', a), user('t', t))]))]));

  // Assert
  assert.deepEqual(actual, expected);
});

test('the super admin ranks above admin', () => {
  // Act / Assert
  assert.ok(rankOf('superadmin') > rankOf('admin'));
});

test('the super admin manages admins and everyone below them; nobody manages the super admin', () => {
  // Arrange
  const manages = (actor, target) => canManage(user('a', actor), user('t', target));

  // Act
  const managedBySuperadmin = ['admin', 'manager', 'chef', 'waiter'].map((target) => manages('superadmin', target));
  const managingSuperadmin = ['superadmin', 'admin', 'manager', 'chef', 'waiter'].map((actor) => manages(actor, 'superadmin'));

  // Assert
  assert.deepEqual(managedBySuperadmin, [true, true, true, true]);
  assert.deepEqual(managingSuperadmin, [false, false, false, false, false]);
});

test('hasRole: the super admin holds every admin permission and nobody else inherits one', () => {
  // Arrange
  const superadmin = user('s', 'superadmin');

  // Act / Assert
  assert.equal(hasRole(superadmin, 'admin'), true);
  assert.equal(hasRole(superadmin, 'manager', 'admin'), true);
  assert.equal(hasRole(superadmin, 'waiter', 'chef'), false);
  assert.equal(hasRole(user('a', 'admin'), 'superadmin'), false);
  assert.equal(hasRole(user('m', 'manager'), 'manager', 'admin'), true);
  assert.equal(hasRole(null, 'admin'), false);
});

test('the super admin role is never assignable through the API', () => {
  // Act / Assert
  assert.deepEqual(ASSIGNABLE_ROLES, ['customer', 'waiter', 'chef', 'manager', 'admin']);
});

test('nobody manages their own account, a customer account, or a missing one through the hierarchy', () => {
  // Arrange
  const admin = user('usr_admin', 'admin');

  // Act / Assert
  assert.equal(canManage(admin, admin), false);
  assert.equal(canManage(admin, user('usr_c', 'customer')), false);
  assert.equal(canManage(admin, null), false);
  assert.equal(canManage(user('usr_c', 'customer'), user('usr_w', 'waiter')), false);
});

/** Account hierarchy — lib/hierarchy.js: who may manage whose staff account. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canManage, rankOf } from '../../src/lib/hierarchy.js';

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

test('nobody manages their own account, a customer account, or a missing one through the hierarchy', () => {
  // Arrange
  const admin = user('usr_admin', 'admin');

  // Act / Assert
  assert.equal(canManage(admin, admin), false);
  assert.equal(canManage(admin, user('usr_c', 'customer')), false);
  assert.equal(canManage(admin, null), false);
  assert.equal(canManage(user('usr_c', 'customer'), user('usr_w', 'waiter')), false);
});

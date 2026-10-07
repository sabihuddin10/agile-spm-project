/** Persistence — the whole store round-trips through a JSON snapshot. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { users, orders, settings, nextId, createUser } from '../src/data/store.js';
import { snapshot, restore } from '../src/data/snapshot.js';

test('a snapshot survives a JSON round trip unchanged', () => {
  const snap = snapshot();
  assert.deepEqual(JSON.parse(JSON.stringify(snap)), snap);
});

test('restore brings back saved state in place, keeping the store references', () => {
  const saved = JSON.parse(JSON.stringify(snapshot()));
  const usersRef = users;
  const ordersRef = orders;
  const settingsRef = settings;

  createUser({ name: 'Temp', email: 'temp@rest.test', password: 'password' });
  orders.length = 0;
  settings.taxRate = 0.99;
  nextId('cus');

  restore(saved);

  assert.equal(users, usersRef);
  assert.equal(orders, ordersRef);
  assert.equal(settings, settingsRef);
  assert.deepEqual(snapshot(), saved);
  assert.equal(users.some((u) => u.email === 'temp@rest.test'), false);
  assert.equal(settings.taxRate, saved.settings.taxRate);
});

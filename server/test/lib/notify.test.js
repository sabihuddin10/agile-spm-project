/** Notifications — lib/notify.js. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { notifications, nextId } from '../../src/data/store.js';
import { notify, notificationsFor, serializeNotification } from '../../src/lib/notify.js';

test('a notification targeted at a userId is visible only to that user', () => {
  // Arrange
  const waiter = { id: 'usr_waiter', role: 'waiter' };
  const otherWaiter = { id: 'usr_waiter2', role: 'waiter' };

  // Act
  notify({ userId: waiter.id, type: 'item_ready', title: 'Ready', message: 'Soda is ready for table 4.' });

  // Assert
  assert.ok(notificationsFor(waiter).some((n) => n.message === 'Soda is ready for table 4.'));
  assert.ok(!notificationsFor(otherWaiter).some((n) => n.message === 'Soda is ready for table 4.'));
});

test('a notification broadcast by role is visible to every user of that role', () => {
  // Arrange
  const chef = { id: 'usr_chef', role: 'chef' };
  const otherChef = { id: 'usr_chef2', role: 'chef' };
  const waiter = { id: 'usr_waiter', role: 'waiter' };

  // Act
  notify({ role: 'chef', type: 'low_stock', title: 'Low stock', message: 'Lemons is at or below its reorder level.' });

  // Assert
  assert.ok(notificationsFor(chef).some((n) => n.message.includes('Lemons')));
  assert.ok(notificationsFor(otherChef).some((n) => n.message.includes('Lemons')));
  assert.ok(!notificationsFor(waiter).some((n) => n.message.includes('Lemons')));
});

test('an email-channel notification does not appear in the in-app list', () => {
  // Arrange
  const customer = { id: 'usr_customer', role: 'customer' };

  // Act
  notify({ userId: customer.id, channel: 'email', to: 'casey@example.com', type: 'booking_confirmed', title: 'Confirmed', message: 'Your booking is confirmed.' });

  // Assert
  assert.ok(!notificationsFor(customer).some((n) => n.message === 'Your booking is confirmed.'));
});

test('notificationsFor returns newest first', () => {
  // Arrange — push two notifications with explicit, unambiguous timestamps
  // (notify() calls can otherwise land in the same millisecond).
  const waiter = { id: 'usr_waiter', role: 'waiter' };
  const first = { id: nextId('ntf'), userId: waiter.id, role: null, channel: 'in-app', readBy: [], createdAt: '2026-01-01T00:00:00.000Z', message: 'first' };
  const second = { id: nextId('ntf'), userId: waiter.id, role: null, channel: 'in-app', readBy: [], createdAt: '2026-01-01T00:00:01.000Z', message: 'second' };
  notifications.push(first, second);

  // Act
  const mine = notificationsFor(waiter);

  // Assert
  assert.ok(mine.findIndex((n) => n.id === second.id) < mine.findIndex((n) => n.id === first.id));
});

test('the notification list is capped at 1000 entries, oldest dropped first', () => {
  // Arrange — fill the store right up to the cap with a sentinel as the oldest entry
  notifications.length = 0;
  const sentinel = { id: 'sentinel', userId: 'usr_waiter', role: null, channel: 'in-app', readBy: [], createdAt: '2000-01-01T00:00:00.000Z' };
  notifications.push(sentinel);
  for (let i = 0; i < 999; i++) {
    notifications.push({ id: `filler_${i}`, userId: 'usr_waiter', role: null, channel: 'in-app', readBy: [], createdAt: '2001-01-01T00:00:00.000Z' });
  }
  assert.equal(notifications.length, 1000);

  // Act — one more notification pushes the store over the cap
  notify({ userId: 'usr_waiter', type: 'a', title: 'A', message: 'newest' });

  // Assert
  assert.equal(notifications.length, 1000);
  assert.ok(!notifications.some((n) => n.id === 'sentinel'), 'the oldest entry was dropped');
  assert.ok(notifications.some((n) => n.message === 'newest'));
});

test('serializeNotification hides readBy and exposes a read flag for the given user', () => {
  // Arrange
  const reader = { id: 'usr_waiter' };
  const nonReader = { id: 'usr_waiter2' };
  const n = { id: 'ntf_1', readBy: ['usr_waiter'], message: 'hi' };

  // Act
  const forReader = serializeNotification(n, reader);
  const forNonReader = serializeNotification(n, nonReader);

  // Assert
  assert.equal(forReader.read, true);
  assert.equal(forNonReader.read, false);
  assert.equal('readBy' in forReader, false);
});

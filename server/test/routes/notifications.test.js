/** Notifications module — routes/notifications.js (US4.4, US7.2). */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from '../helpers.js';

let api;
let waiter;
let waiter2;
let manager;
before(async () => {
  api = await startServer();
  [waiter, waiter2, manager] = await Promise.all([api.login('waiter'), api.login('waiter2'), api.login('manager')]);
});
after(() => api.close());

const list = (token) => api.call('GET', '/notifications', { token });

test('GET returns only the caller\'s notifications with the right unread count', async () => {
  // Act
  const { status, body } = await list(waiter);

  // Assert — the waiter sees waiter-role broadcasts and notes addressed to usr_waiter only
  assert.equal(status, 200);
  const titles = body.notifications.map((n) => n.title);
  assert.ok(titles.includes('New online order'), 'waiter-role broadcast');
  assert.ok(titles.includes('Ready for pickup'), 'addressed to usr_waiter');
  assert.ok(titles.includes('Order ready'), 'addressed to usr_waiter');
  assert.ok(!titles.includes('Low stock'), 'manager-only note is hidden');
  for (const n of body.notifications) {
    assert.ok(n.userId === 'usr_waiter' || (n.userId === null && n.role === 'waiter'));
    assert.equal(n.channel, 'in-app');
    assert.equal(typeof n.read, 'boolean');
    assert.equal(n.readBy, undefined, 'readBy is not exposed');
  }
  assert.equal(body.unreadCount, body.notifications.filter((n) => !n.read).length);

  // Act — the manager sees the low-stock note but none of the waiter's
  const mgr = (await list(manager)).body;
  // Assert
  const mgrTitles = mgr.notifications.map((n) => n.title);
  assert.ok(mgrTitles.includes('Low stock'));
  assert.ok(!mgrTitles.includes('Ready for pickup'));
  assert.ok(!mgrTitles.includes('New online order'));
});

test('GET returns at most 30 notifications, newest first, while counting every unread one', async () => {
  // Arrange — each public staff application notifies the manager role
  for (let i = 0; i < 32; i++) {
    const res = await api.call('POST', '/staff/applications', {
      body: { name: `Applicant ${i}`, email: `applicant${i}@example.com`, desiredRole: 'waiter' },
    });
    assert.equal(res.status, 201);
  }

  // Act
  const { body } = await list(manager);

  // Assert
  assert.equal(body.notifications.length, 30);
  assert.ok(body.unreadCount >= 33, 'unread count covers notifications beyond the first 30');
  const times = body.notifications.map((n) => n.createdAt);
  assert.deepEqual(times, [...times].sort().reverse(), 'newest first');
  assert.ok(!body.notifications.some((n) => n.title === 'Low stock'), 'the old low-stock note is pushed past the cap');
});

test('POST /:id/read marks one read, lowers the count by one and is idempotent', async () => {
  // Arrange
  const initial = (await list(waiter)).body;
  const target = initial.notifications.find((n) => !n.read);
  assert.ok(target, 'seed has an unread waiter notification');

  // Act
  const res = await api.call('POST', `/notifications/${target.id}/read`, { token: waiter });

  // Assert
  assert.equal(res.status, 200);
  assert.equal(res.body.notification.id, target.id);
  assert.equal(res.body.notification.read, true);
  const after1 = (await list(waiter)).body;
  assert.equal(after1.unreadCount, initial.unreadCount - 1);
  assert.equal(after1.notifications.find((n) => n.id === target.id).read, true);

  // Act — reading it again changes nothing
  const again = await api.call('POST', `/notifications/${target.id}/read`, { token: waiter });
  // Assert
  assert.equal(again.status, 200);
  assert.equal(again.body.notification.read, true);
  assert.equal((await list(waiter)).body.unreadCount, after1.unreadCount);
});

test('POST /:id/read is 404 for someone else\'s notification or an unknown id', async () => {
  // Arrange — a note addressed to usr_waiter, and the manager-role low-stock note
  const waiterNote = (await list(waiter)).body.notifications.find((n) => n.userId === 'usr_waiter');
  const managerBefore = (await list(manager)).body;

  // Act / Assert — the manager cannot mark the waiter's note
  const res = await api.call('POST', `/notifications/${waiterNote.id}/read`, { token: manager });
  assert.equal(res.status, 404);
  assert.equal((await list(manager)).body.unreadCount, managerBefore.unreadCount);

  // Act / Assert — waiter2 shares the role, not the personal note
  assert.equal((await api.call('POST', `/notifications/${waiterNote.id}/read`, { token: waiter2 })).status, 404);

  // Act / Assert — unknown id
  assert.equal((await api.call('POST', '/notifications/ntf_does_not_exist/read', { token: waiter })).status, 404);
});

test('POST /read-all clears the caller\'s unread count only (readBy is per user)', async () => {
  // Arrange — both waiters see the shared waiter-role broadcast unread
  const shared = (await list(waiter2)).body.notifications.find((n) => n.role === 'waiter' && n.userId === null);
  assert.ok(shared);
  assert.equal(shared.read, false);
  const waiter2Before = (await list(waiter2)).body.unreadCount;
  assert.ok(waiter2Before > 0);
  assert.ok((await list(waiter)).body.unreadCount > 0);

  // Act
  const res = await api.call('POST', '/notifications/read-all', { token: waiter });

  // Assert
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { ok: true });
  const mine = (await list(waiter)).body;
  assert.equal(mine.unreadCount, 0);
  assert.ok(mine.notifications.every((n) => n.read));
  const theirs = (await list(waiter2)).body;
  assert.equal(theirs.unreadCount, waiter2Before, 'the other waiter keeps their unread count');
  assert.equal(theirs.notifications.find((n) => n.id === shared.id).read, false);
});

test('every notifications endpoint needs a token', async () => {
  // Act
  const results = await Promise.all([
    api.call('GET', '/notifications'),
    api.call('POST', '/notifications/read-all'),
    api.call('POST', '/notifications/ntf_1/read'),
  ]);

  // Assert
  for (const res of results) assert.equal(res.status, 401);
});

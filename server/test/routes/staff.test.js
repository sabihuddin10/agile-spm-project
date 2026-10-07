/** Staff module — routes/staff.js (US9.1–US9.5). */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, localDate } from '../helpers.js';

let api;
let admin;
let manager;
before(async () => {
  api = await startServer();
  [admin, manager] = await Promise.all([api.login('admin'), api.login('manager')]);
});
after(() => api.close());

const inDays = (n) => localDate(new Date(Date.now() + n * 86400000));

test('US9.1 an approved application creates a working staff account', async () => {
  // Act
  const applied = await api.call('POST', '/staff/applications', { body: { name: 'Rita Runner', email: 'rita@example.com', desiredRole: 'waiter' } });
  // Assert
  assert.equal(applied.status, 201);
  assert.equal((await api.call('POST', '/staff/applications', { body: { name: 'Rita', email: 'rita@example.com', desiredRole: 'waiter' } })).status, 409);

  // Act / Assert — a manager cannot approve someone into the manager role
  const asManager = await api.call('POST', `/staff/applications/${applied.body.application.id}/approve`, { token: manager, body: { role: 'manager' } });
  assert.equal(asManager.status, 403, 'managers cannot create managers');

  // Act — approve as waiter
  const approved = await api.call('POST', `/staff/applications/${applied.body.application.id}/approve`, { token: manager, body: { role: 'waiter' } });
  // Assert
  assert.equal(approved.body.user.role, 'waiter');
  const token = await api.login('rita@example.com', approved.body.tempPassword);
  assert.equal((await api.call('GET', '/orders', { token })).status, 200);
});

test('US9.2 a role change updates permitted actions immediately', async () => {
  // Arrange
  const chefToken = await api.login('chef2');
  assert.equal((await api.call('GET', '/billing', { token: chefToken })).status, 403);

  // Act — promote the chef to manager
  await api.call('PATCH', '/auth/users/usr_chef2', { token: admin, body: { role: 'manager' } });
  // Assert — the existing token now has manager access
  assert.equal((await api.call('GET', '/billing', { token: chefToken })).status, 200);

  await api.call('PATCH', '/auth/users/usr_chef2', { token: admin, body: { role: 'chef' } });
});

test('US9.3 managers schedule shifts that appear on the staff member\'s schedule', async () => {
  // Arrange
  const date = inDays(10);

  // Act
  const created = await api.call('POST', '/staff/shifts', { token: manager, body: { userId: 'usr_waiter', date, start: '12:00', end: '18:00' } });
  // Assert
  assert.equal(created.status, 201);

  // Act / Assert — overlapping or inverted shifts are rejected
  const overlap = await api.call('POST', '/staff/shifts', { token: manager, body: { userId: 'usr_waiter', date, start: '17:00', end: '22:00' } });
  assert.equal(overlap.status, 400);
  assert.equal((await api.call('POST', '/staff/shifts', { token: manager, body: { userId: 'usr_waiter', date, start: '20:00', end: '19:00' } })).status, 400);

  // Act — the staff member views their own schedule
  const waiter = await api.login('waiter');
  const mine = await api.call('GET', `/staff/shifts/mine?from=${date}&to=${date}`, { token: waiter });
  // Assert
  assert.deepEqual(mine.body.shifts.map((s) => [s.start, s.end, s.hours]), [['12:00', '18:00', 6]]);
  assert.equal((await api.call('POST', '/staff/shifts', { token: waiter, body: { userId: 'usr_waiter', date, start: '08:00', end: '10:00' } })).status, 403);
});

test('US9.4 suspended or removed staff lose access on their next request', async () => {
  // Arrange
  const waiter2 = await api.login('waiter2');

  // Act — suspend
  await api.call('PATCH', '/auth/users/usr_waiter2', { token: admin, body: { active: false } });
  // Assert — access and login are both blocked
  assert.equal((await api.call('GET', '/orders', { token: waiter2 })).status, 401);
  assert.equal((await api.call('POST', '/auth/login', { body: { email: 'waiter2@rest.test', password: 'password' } })).status, 403);

  // Act — reactivate
  await api.call('PATCH', '/auth/users/usr_waiter2', { token: admin, body: { active: true } });
  // Assert
  assert.equal((await api.call('GET', '/orders', { token: waiter2 })).status, 200);

  // Act / Assert — an admin cannot remove themselves, but can remove another staff member
  assert.equal((await api.call('DELETE', '/auth/users/usr_admin', { token: admin })).status, 400, 'cannot remove yourself');
  const rita = (await api.call('GET', '/staff/roster', { token: manager })).body.staff.find((u) => u.email === 'rita@example.com');
  assert.equal((await api.call('DELETE', `/auth/users/${rita.id}`, { token: admin })).status, 200);
});

test('US9.5 performance shows per-staff activity', async () => {
  // Act
  const { body } = await api.call('GET', '/staff/performance', { token: manager });

  // Assert
  const will = body.staff.find((s) => s.name === 'Will Waiter');
  const carlos = body.staff.find((s) => s.name === 'Carlos Chef');
  assert.ok(will.ordersTaken > 0 && will.ordersServed > 0 && will.revenueHandled > 0);
  assert.ok(carlos.itemsPrepared > 0 && carlos.avgPrepMinutes > 0);
  assert.ok(will.shiftsCompleted > 0 && will.hoursWorked > 0);
});

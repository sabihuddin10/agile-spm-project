/** Sprint 9 — Staff Management (US9.1–US9.5) and Sprint 10 — Analytics (US10.1–US10.6). */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, localDate } from './helpers.js';

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
  const applied = await api.call('POST', '/staff/applications', { body: { name: 'Rita Runner', email: 'rita@example.com', desiredRole: 'waiter' } });
  assert.equal(applied.status, 201);
  assert.equal((await api.call('POST', '/staff/applications', { body: { name: 'Rita', email: 'rita@example.com', desiredRole: 'waiter' } })).status, 409);

  const asManager = await api.call('POST', `/staff/applications/${applied.body.application.id}/approve`, { token: manager, body: { role: 'manager' } });
  assert.equal(asManager.status, 403, 'managers cannot create managers');
  const approved = await api.call('POST', `/staff/applications/${applied.body.application.id}/approve`, { token: manager, body: { role: 'waiter' } });
  assert.equal(approved.body.user.role, 'waiter');
  const token = await api.login('rita@example.com', approved.body.tempPassword);
  assert.equal((await api.call('GET', '/orders', { token })).status, 200);
});

test('US9.2 a role change updates permitted actions immediately', async () => {
  const chefToken = await api.login('chef2');
  assert.equal((await api.call('GET', '/billing', { token: chefToken })).status, 403);
  await api.call('PATCH', '/auth/users/usr_chef2', { token: admin, body: { role: 'manager' } });
  assert.equal((await api.call('GET', '/billing', { token: chefToken })).status, 200);
  await api.call('PATCH', '/auth/users/usr_chef2', { token: admin, body: { role: 'chef' } });
});

test('US9.3 managers schedule shifts that appear on the staff member\'s schedule', async () => {
  const date = inDays(10);
  const created = await api.call('POST', '/staff/shifts', { token: manager, body: { userId: 'usr_waiter', date, start: '12:00', end: '18:00' } });
  assert.equal(created.status, 201);
  const overlap = await api.call('POST', '/staff/shifts', { token: manager, body: { userId: 'usr_waiter', date, start: '17:00', end: '22:00' } });
  assert.equal(overlap.status, 400);
  assert.equal((await api.call('POST', '/staff/shifts', { token: manager, body: { userId: 'usr_waiter', date, start: '20:00', end: '19:00' } })).status, 400);

  const waiter = await api.login('waiter');
  const mine = await api.call('GET', `/staff/shifts/mine?from=${date}&to=${date}`, { token: waiter });
  assert.deepEqual(mine.body.shifts.map((s) => [s.start, s.end, s.hours]), [['12:00', '18:00', 6]]);
  assert.equal((await api.call('POST', '/staff/shifts', { token: waiter, body: { userId: 'usr_waiter', date, start: '08:00', end: '10:00' } })).status, 403);
});

test('US9.4 suspended or removed staff lose access on their next request', async () => {
  const waiter2 = await api.login('waiter2');
  await api.call('PATCH', '/auth/users/usr_waiter2', { token: admin, body: { active: false } });
  assert.equal((await api.call('GET', '/orders', { token: waiter2 })).status, 401);
  assert.equal((await api.call('POST', '/auth/login', { body: { email: 'waiter2@rest.test', password: 'password' } })).status, 403);
  await api.call('PATCH', '/auth/users/usr_waiter2', { token: admin, body: { active: true } });
  assert.equal((await api.call('GET', '/orders', { token: waiter2 })).status, 200);

  assert.equal((await api.call('DELETE', '/auth/users/usr_admin', { token: admin })).status, 400, 'cannot remove yourself');
  const rita = (await api.call('GET', '/staff/roster', { token: manager })).body.staff.find((u) => u.email === 'rita@example.com');
  assert.equal((await api.call('DELETE', `/auth/users/${rita.id}`, { token: admin })).status, 200);
});

test('US9.5 performance shows per-staff activity', async () => {
  const { body } = await api.call('GET', '/staff/performance', { token: manager });
  const will = body.staff.find((s) => s.name === 'Will Waiter');
  const carlos = body.staff.find((s) => s.name === 'Carlos Chef');
  assert.ok(will.ordersTaken > 0 && will.ordersServed > 0 && will.revenueHandled > 0);
  assert.ok(carlos.itemsPrepared > 0 && carlos.avgPrepMinutes > 0);
  assert.ok(will.shiftsCompleted > 0 && will.hoursWorked > 0);
});

test('US10.1 revenue and order trends follow the selected period', async () => {
  const daily = (await api.call('GET', '/analytics/dashboard?granularity=day', { token: manager })).body;
  assert.equal(daily.trend.length, 30);
  assert.ok(daily.trend.every((b) => /^\d{4}-\d{2}-\d{2}$/.test(b.period)));
  const weekly = (await api.call('GET', '/analytics/dashboard?granularity=week', { token: manager })).body;
  assert.ok(weekly.trend.length >= 5 && weekly.trend.length <= 6);
  const total = (list) => Math.round(list.reduce((s, b) => s + b.revenue, 0) * 100);
  assert.equal(total(daily.trend), total(weekly.trend));
  assert.equal(total(daily.trend), Math.round(daily.kpis.revenue * 100));
  assert.equal((await api.call('GET', '/analytics/dashboard', { token: await api.login('waiter') })).status, 403);
});

test('US10.2–US10.6 dishes, tables, peak hours, inventory health and no-show rate', async () => {
  const d = (await api.call('GET', '/analytics/dashboard?from=' + inDays(-59) + '&to=' + inDays(0), { token: manager })).body;
  const byQty = [...d.dishes].sort((a, b) => b.qty - a.qty);
  assert.equal(byQty[0].name, 'Margherita Pizza');
  assert.ok(d.dishes.every((x) => x.revenue > 0));

  assert.ok(d.tables.length >= 8 && d.tables.every((t) => t.occupancyRate >= 0 && t.occupancyRate <= 100));
  assert.ok(d.tables.some((t) => t.turns > 0 && t.avgTurnoverMinutes > 30));
  assert.ok(d.zones.map((z) => z.zone).includes('Terrace'));

  const busiest = [...d.peakHours].sort((a, b) => b.orders - a.orders)[0];
  assert.ok([19, 20, 13].includes(busiest.hour), `peak at ${busiest.hour}:00`);

  assert.equal(d.inventory[0].status, 'low', 'riskiest stock first');
  const r = d.reservations;
  assert.equal(r.noShowRate, Math.round((r.noShows / (r.seated + r.noShows)) * 1000) / 10);
  assert.ok(r.noShowRate > 0 && r.noShowRate < 40);
});

/** Workforce module — routes/workforce.js (attendance analytics, pay, overview, wages, bonuses). */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, localDate } from '../helpers.js';

let api;
const tokens = {};
before(async () => {
  api = await startServer();
  await Promise.all(['customer', 'waiter', 'chef', 'manager', 'admin'].map(async (role) => { tokens[role] = await api.login(role); }));
});
after(() => api.close());

const get = (path, token) => api.call('GET', path, { token });
const today = localDate(new Date());
const thisMonth = today.slice(0, 7);
/** First and last day of last month. */
function lastMonth() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const last = new Date(now.getFullYear(), now.getMonth(), 0);
  return { month: localDate(first).slice(0, 7), from: localDate(first), to: localDate(last) };
}

/* ------------------------------------------------------------------ me */

test('GET /workforce/me returns my analytics for this month so far, with my pay', async () => {
  // Act
  const { status, body } = await get('/workforce/me', tokens.waiter);

  // Assert
  assert.equal(status, 200);
  assert.deepEqual(body.user, { id: 'usr_waiter', name: 'Will Waiter', role: 'waiter' });
  assert.deepEqual(body.range, { from: `${thisMonth}-01`, to: today });
  assert.deepEqual(Object.keys(body.summary).sort(), [
    'attendanceRate', 'breakMinutes', 'lateCount', 'lateMinutes', 'onTimeRate', 'paidMinutes',
    'scheduledMinutes', 'shifts', 'shiftsMissed', 'shiftsWorked', 'workedMinutes',
  ]);
  assert.equal(body.series.day.length, Number(today.slice(8)));
  assert.equal(body.series.hour.length, 24);
  assert.deepEqual(body.series.month.map((p) => p.key), [thisMonth]);
  assert.ok(body.series.week.every((p) => /^\d{4}-W\d{2}$/.test(p.key)));
  const clockIns = body.sessions.map((s) => s.clockIn);
  assert.deepEqual(clockIns, [...clockIns].sort().reverse(), 'sessions newest first');
  assert.ok(body.shifts.every((s) => ['scheduled', 'completed', 'missed'].includes(s.status)));
  assert.equal(body.pay.month, thisMonth);
  assert.equal(body.pay.hourlyWage, 12);
  assert.equal(body.pay.estimated, true);
});

test('pay for a finished month adds the waiter\'s tips and matches the formula', async () => {
  // Arrange
  const { month, from, to } = lastMonth();

  // Act
  const { status, body } = await get(`/workforce/me?from=${from}&to=${to}`, tokens.waiter);

  // Assert
  assert.equal(status, 200);
  const { pay, summary } = body;
  assert.equal(pay.month, month);
  assert.equal(pay.estimated, false);
  assert.ok(pay.tips > 0, 'seeded bills carry tips');
  assert.equal(pay.paidHours, Math.round((summary.paidMinutes / 60) * 100) / 100);
  assert.equal(pay.base, Math.round(pay.paidHours * pay.hourlyWage * 100) / 100);
  assert.equal(pay.latePenalties.length, summary.lateCount);
  assert.equal(pay.latePenaltyTotal, pay.latePenalties.length * 5);
  assert.equal(pay.net, Math.round((pay.base + pay.tips + pay.bonusTotal - pay.latePenaltyTotal) * 100) / 100);
});

test('chefs earn no tips', async () => {
  // Arrange
  const { from, to } = lastMonth();

  // Act
  const { body } = await get(`/workforce/me?from=${from}&to=${to}`, tokens.chef);

  // Assert
  assert.equal(body.pay.tips, 0);
  assert.equal(body.pay.hourlyWage, 15);
});

test('date ranges are validated', async () => {
  // Act
  const results = await Promise.all([
    'from=2026-10-09&to=2026-10-01',
    'from=2026-02-31&to=2026-03-02',
    'from=yesterday',
    'to=2026-13-01',
    'from=2025-01-01&to=2026-10-01',
  ].map(async (q) => (await get(`/workforce/me?${q}`, tokens.waiter)).status));

  // Assert
  assert.deepEqual(results, [400, 400, 400, 400, 400]);
  assert.equal((await get('/workforce/me?from=2025-10-10&to=2026-10-09', tokens.waiter)).status, 200, 'a full year is allowed');
});

/* -------------------------------------------------------------- visibility */

test('a manager sees waiters\' and chefs\' attendance without pay, never admins', async () => {
  // Act
  const waiter = await get('/workforce/users/usr_waiter', tokens.manager);
  const chef = await get('/workforce/users/usr_chef2', tokens.manager);
  const adminRes = await get('/workforce/users/usr_admin', tokens.manager);
  const self = await get('/workforce/users/usr_manager', tokens.manager);

  // Assert
  assert.equal(waiter.status, 200);
  assert.equal(waiter.body.pay, null);
  assert.ok(waiter.body.sessions.length > 0);
  assert.equal(chef.status, 200);
  assert.equal(chef.body.pay, null);
  assert.equal(adminRes.status, 403);
  assert.equal(self.status, 200);
  assert.equal(self.body.pay.hourlyWage, 20, 'their own pay is visible');
});

test('a waiter only sees themselves', async () => {
  // Act
  const other = await get('/workforce/users/usr_waiter2', tokens.waiter);
  const chef = await get('/workforce/users/usr_chef', tokens.waiter);
  const self = await get('/workforce/users/usr_waiter', tokens.waiter);
  const overview = await get('/workforce/overview', tokens.waiter);

  // Assert
  assert.deepEqual([other.status, chef.status, overview.status], [403, 403, 403]);
  assert.equal(self.status, 200);
  assert.ok(self.body.pay);
});

test('unknown people and customers are 404; customers cannot use workforce at all', async () => {
  // Act
  const unknown = await get('/workforce/users/usr_nope', tokens.admin);
  const customer = await get('/workforce/users/usr_customer', tokens.admin);
  const asCustomer = await get('/workforce/me', tokens.customer);

  // Assert
  assert.deepEqual([unknown.status, customer.status, asCustomer.status], [404, 404, 403]);
});

test('the admin sees everyone with pay', async () => {
  // Act
  const manager = await get('/workforce/users/usr_manager', tokens.admin);
  const overview = await get('/workforce/overview', tokens.admin);

  // Assert
  assert.equal(manager.status, 200);
  assert.equal(manager.body.pay.hourlyWage, 20);
  assert.equal(overview.status, 200);
  assert.equal(overview.body.month, thisMonth);
  assert.deepEqual(overview.body.rows.map((r) => r.user.id).sort(), ['usr_admin', 'usr_chef', 'usr_chef2', 'usr_manager', 'usr_waiter', 'usr_waiter2']);
  assert.ok(overview.body.rows.every((r) => r.pay && ['off', 'working', 'on_break'].includes(r.state)));
  const sum = overview.body.rows.reduce((s, r) => s + r.pay.net, 0);
  assert.equal(overview.body.totals.payroll, Math.round(sum * 100) / 100);
  assert.equal(overview.body.totals.paidMinutes, overview.body.rows.reduce((s, r) => s + r.summary.paidMinutes, 0));
});

test('the manager overview lists waiters and chefs only, with no money', async () => {
  // Arrange
  const { month } = lastMonth();

  // Act
  const { status, body } = await get(`/workforce/overview?month=${month}`, tokens.manager);

  // Assert
  assert.equal(status, 200);
  assert.equal(body.month, month);
  assert.deepEqual([...new Set(body.rows.map((r) => r.user.role))].sort(), ['chef', 'waiter']);
  assert.ok(body.rows.every((r) => r.pay === null));
  assert.equal(body.totals.payroll, null);
  assert.ok(body.totals.paidMinutes > 0);
  assert.ok(body.rows.every((r) => r.summary.shifts > 0));
});

test('the overview month is validated', async () => {
  // Act
  const results = await Promise.all(['2026-13', '2026-1', 'october', '2026-10-01'].map(async (m) => (await get(`/workforce/overview?month=${m}`, tokens.admin)).status));

  // Assert
  assert.deepEqual(results, [400, 400, 400, 400]);
});

/* ------------------------------------------------------- wages & bonuses */

test('the admin sets a wage and pay follows it; nobody else can', async () => {
  // Act
  const res = await api.call('PUT', '/workforce/users/usr_waiter2/wage', { token: tokens.admin, body: { hourlyWage: 14.5 } });
  const asManager = await api.call('PUT', '/workforce/users/usr_waiter2/wage', { token: tokens.manager, body: { hourlyWage: 99 } });
  const asSelf = await api.call('PUT', '/workforce/users/usr_waiter2/wage', { token: await api.login('waiter2'), body: { hourlyWage: 99 } });
  const pay = (await get('/workforce/users/usr_waiter2', tokens.admin)).body.pay;

  // Assert
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { hourlyWage: 14.5 });
  assert.deepEqual([asManager.status, asSelf.status], [403, 403]);
  assert.equal(pay.hourlyWage, 14.5);
  assert.equal(pay.base, Math.round(pay.paidHours * 14.5 * 100) / 100);
});

test('wages are validated', async () => {
  // Act
  const results = await Promise.all([0, -3, 1000.01, '12', null, undefined].map(async (hourlyWage) => (
    await api.call('PUT', '/workforce/users/usr_chef/wage', { token: tokens.admin, body: { hourlyWage } })
  ).status));
  const customer = await api.call('PUT', '/workforce/users/usr_customer/wage', { token: tokens.admin, body: { hourlyWage: 10 } });

  // Assert
  assert.deepEqual(results, [400, 400, 400, 400, 400, 400]);
  assert.equal(customer.status, 404);
  assert.equal((await api.call('PUT', '/workforce/users/usr_chef/wage', { token: tokens.admin, body: { hourlyWage: 1000 } })).status, 200);
  await api.call('PUT', '/workforce/users/usr_chef/wage', { token: tokens.admin, body: { hourlyWage: 15 } });
});

test('the admin adds and removes a bonus, and it shows in the person\'s own pay', async () => {
  // Arrange
  const before1 = (await get('/workforce/me', tokens.chef)).body.pay;

  // Act
  const created = await api.call('POST', '/workforce/users/usr_chef/adjustments', { token: tokens.admin, body: { amount: 30, reason: ' Eid bonus ', date: today } });
  const withBonus = (await get('/workforce/me', tokens.chef)).body.pay;

  // Assert
  assert.equal(created.status, 201);
  const { adjustment } = created.body;
  assert.deepEqual(
    { ...adjustment, id: undefined, createdAt: undefined },
    { id: undefined, userId: 'usr_chef', amount: 30, reason: 'Eid bonus', date: today, createdBy: 'usr_admin', createdAt: undefined },
  );
  assert.ok(withBonus.bonuses.some((b) => b.id === adjustment.id && b.reason === 'Eid bonus' && b.amount === 30));
  assert.equal(withBonus.bonusTotal, Math.round((before1.bonusTotal + 30) * 100) / 100);
  assert.equal(withBonus.net, Math.round((before1.net + 30) * 100) / 100);

  // Act
  const deleted = await api.call('DELETE', `/workforce/users/usr_chef/adjustments/${adjustment.id}`, { token: tokens.admin });
  const again = await api.call('DELETE', `/workforce/users/usr_chef/adjustments/${adjustment.id}`, { token: tokens.admin });
  const after1 = (await get('/workforce/me', tokens.chef)).body.pay;

  // Assert
  assert.deepEqual(deleted.body, { deleted: true, id: adjustment.id });
  assert.equal(again.status, 404);
  assert.equal(after1.bonusTotal, before1.bonusTotal);
});

test('a negative adjustment is a deduction', async () => {
  // Act
  const res = await api.call('POST', '/workforce/users/usr_waiter/adjustments', { token: tokens.admin, body: { amount: -12.5, reason: 'Uniform replacement', date: today } });
  const pay = (await get('/workforce/users/usr_waiter', tokens.admin)).body.pay;

  // Assert
  assert.equal(res.status, 201);
  assert.equal(res.body.adjustment.amount, -12.5);
  assert.ok(pay.bonuses.some((b) => b.amount === -12.5));
});

test('adjustments are validated and admin only', async () => {
  // Arrange
  const body = (fields) => ({ amount: 10, reason: 'Birthday', date: today, ...fields });
  const send = (fields, token = tokens.admin) => api.call('POST', '/workforce/users/usr_chef/adjustments', { token, body: body(fields) });

  // Act
  const results = [
    (await send({ amount: 0 })).status,
    (await send({ amount: 0.001 })).status,
    (await send({ amount: '10' })).status,
    (await send({ amount: 1e9 })).status,
    (await send({ reason: '' })).status,
    (await send({ reason: '   ' })).status,
    (await send({ reason: 'x'.repeat(201) })).status,
    (await send({ date: '2026-02-30' })).status,
    (await send({}, tokens.manager)).status,
    (await send({}, tokens.chef)).status,
  ];
  const otherPerson = await send({});
  const wrongOwner = await api.call('DELETE', `/workforce/users/usr_waiter/adjustments/${otherPerson.body.adjustment.id}`, { token: tokens.admin });

  // Assert
  assert.deepEqual(results, [400, 400, 400, 400, 400, 400, 400, 400, 403, 403]);
  assert.equal(wrongOwner.status, 404, 'an adjustment is removed only under its own person');
});

/* ------------------------------------------------------------ privacy */

test('hourlyWage never appears in account lists or the signed-in user', async () => {
  // Act
  const lists = [
    (await get('/auth/users', tokens.manager)).body.users,
    (await get('/auth/users', tokens.admin)).body.users,
    (await get('/staff/roster', tokens.manager)).body.staff,
  ];
  const selves = await Promise.all(['waiter', 'manager', 'admin'].map(async (r) => (await get('/auth/me', tokens[r])).body.user));

  // Assert
  for (const list of lists) {
    assert.ok(list.length > 0);
    for (const u of list) assert.ok(!('hourlyWage' in u), `hourlyWage leaked for ${u.id}`);
  }
  for (const u of selves) assert.ok(!('hourlyWage' in u));
});

test('a newly approved hire gets the default wage for their role', async () => {
  // Arrange
  const apps = (await get('/staff/applications?status=pending', tokens.manager)).body.applications;
  const chefApp = apps.find((a) => a.desiredRole === 'chef');

  // Act
  const approved = await api.call('POST', `/staff/applications/${chefApp.id}/approve`, { token: tokens.manager, body: {} });
  const pay = (await get(`/workforce/users/${approved.body.user.id}`, tokens.admin)).body.pay;

  // Assert
  assert.equal(approved.status, 200);
  assert.ok(!('hourlyWage' in approved.body.user));
  assert.equal(pay.hourlyWage, 15);
  assert.equal(pay.net, 0);
});

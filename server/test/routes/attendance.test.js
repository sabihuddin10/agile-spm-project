/** Attendance module — routes/attendance.js (time clock, breaks, lateness, presence). */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, localDate, localTime } from '../helpers.js';

const ROLES = ['customer', 'waiter', 'chef', 'manager', 'admin'];
const STAFF = ['waiter', 'chef', 'manager', 'admin'];
const CLOCK = ['/attendance/clock-in', '/attendance/break/start', '/attendance/break/end', '/attendance/clock-out'];

let api;
const tokens = {};
before(async () => {
  api = await startServer();
  await Promise.all(ROLES.map(async (role) => { tokens[role] = await api.login(role); }));
});
after(() => api.close());

const me = async (token) => (await api.call('GET', '/attendance/me', { token })).body;
const post = (path, token) => api.call('POST', path, { token });
/** The seed clocks some people in; start each scenario from "off". */
async function clockOff(token) {
  if ((await me(token)).state !== 'off') assert.equal((await post('/attendance/clock-out', token)).status, 200);
}

// Runs first, before any test touches the clock.
test('the seeded demo has people clocked in right now', async () => {
  // Act
  const { body } = await api.call('GET', '/attendance/presence', { token: tokens.admin });

  // Assert
  assert.ok(body.people.filter((p) => p.state !== 'off').length >= 2);
});

test('a staff member clocks in, takes a break, comes back and clocks out', async () => {
  // Arrange
  const token = tokens.waiter;
  await clockOff(token);

  // Act
  const inRes = await post('/attendance/clock-in', token);

  // Assert
  assert.equal(inRes.status, 200);
  assert.equal(inRes.body.state, 'working');
  assert.equal(inRes.body.session.clockOut, null);
  assert.equal(inRes.body.session.date, localDate(new Date()));
  assert.equal(inRes.body.since, inRes.body.session.clockIn);
  assert.equal(inRes.body.session.paidMinutes, 0);

  // Act
  const breakRes = await post('/attendance/break/start', token);

  // Assert
  assert.equal(breakRes.status, 200);
  assert.equal(breakRes.body.state, 'on_break');
  assert.equal(breakRes.body.session.breaks.length, 1);
  assert.equal(breakRes.body.session.breaks[0].end, null);
  assert.equal(breakRes.body.since, breakRes.body.session.breaks[0].start);

  // Act
  const backRes = await post('/attendance/break/end', token);

  // Assert
  assert.equal(backRes.status, 200);
  assert.equal(backRes.body.state, 'working');
  assert.ok(backRes.body.session.breaks[0].end);

  // Act
  const outRes = await post('/attendance/clock-out', token);

  // Assert — the closed session stays visible as today's latest
  assert.equal(outRes.status, 200);
  assert.equal(outRes.body.state, 'off');
  assert.ok(outRes.body.session.clockOut);
  assert.equal(outRes.body.since, outRes.body.session.clockOut);
  assert.equal(outRes.body.session.id, inRes.body.session.id);
});

test('invalid clock transitions are refused with 409 and a clear message', async () => {
  // Arrange
  const token = tokens.chef;
  await clockOff(token);

  // Act
  const outWhileOff = await post('/attendance/clock-out', token);
  const breakWhileOff = await post('/attendance/break/start', token);
  const endWhileOff = await post('/attendance/break/end', token);
  await post('/attendance/clock-in', token);
  const inTwice = await post('/attendance/clock-in', token);
  const endWhileWorking = await post('/attendance/break/end', token);
  await post('/attendance/break/start', token);
  const breakTwice = await post('/attendance/break/start', token);

  // Assert
  assert.deepEqual(
    [outWhileOff, breakWhileOff, endWhileOff, inTwice, endWhileWorking, breakTwice].map((r) => [r.status, r.body.error]),
    [
      [409, 'You are not clocked in.'],
      [409, 'You are not clocked in.'],
      [409, 'You are not clocked in.'],
      [409, 'You are already clocked in.'],
      [409, 'You are not on a break.'],
      [409, 'You are already on a break.'],
    ],
  );

  // Act — clocking out while on a break ends the break too
  const out = await post('/attendance/clock-out', token);

  // Assert
  assert.equal(out.status, 200);
  assert.equal(out.body.state, 'off');
  assert.ok(out.body.session.breaks.every((b) => b.end));
});

test('a clock-in after shift start + grace is late; the grace setting decides', async (t) => {
  // Arrange — a shift for the admin (no seeded shifts) that started 30 minutes ago
  const now = new Date();
  const start = new Date(now.getTime() - 30 * 60_000);
  if (localDate(start) !== localDate(now) || localTime(now) >= '23:58') return t.skip('too close to midnight to place a same-day shift');
  const shift = await api.call('POST', '/staff/shifts', {
    token: tokens.manager,
    body: { userId: 'usr_admin', date: localDate(now), start: localTime(start), end: '23:59' },
  });
  assert.equal(shift.status, 201);
  await clockOff(tokens.admin);

  // Act
  const late = await post('/attendance/clock-in', tokens.admin);

  // Assert
  assert.equal(late.body.session.shiftId, shift.body.shift.id);
  assert.equal(late.body.session.late, true);
  assert.ok(late.body.session.lateMinutes >= 29 && late.body.session.lateMinutes <= 31);
  assert.deepEqual(late.body.todayShift, { start: localTime(start), end: '23:59' });

  // Arrange — a 60-minute grace
  await post('/attendance/clock-out', tokens.admin);
  assert.equal((await api.call('PATCH', '/settings', { token: tokens.manager, body: { lateGraceMinutes: 60 } })).status, 200);

  // Act
  const onTime = await post('/attendance/clock-in', tokens.admin);

  // Assert
  assert.equal(onTime.body.session.late, false);
  assert.equal(onTime.body.session.lateMinutes, 0);

  // Cleanup
  await post('/attendance/clock-out', tokens.admin);
  await api.call('PATCH', '/settings', { token: tokens.manager, body: { lateGraceMinutes: 5 } });
});

test('every staff role may use the clock; customers get 403 and guests 401', async () => {
  // Arrange
  const results = [];

  // Act
  for (const path of CLOCK) {
    results.push([path, 'guest', (await post(path)).status]);
    results.push([path, 'customer', (await post(path, tokens.customer)).status]);
    for (const role of STAFF) results.push([path, role, (await post(path, tokens[role])).status]);
  }
  const customerGets = [
    (await api.call('GET', '/attendance/me', { token: tokens.customer })).status,
    (await api.call('GET', '/attendance/presence', { token: tokens.customer })).status,
  ];

  // Assert
  for (const [path, who, status] of results) {
    if (who === 'guest') assert.equal(status, 401, `${who} ${path}`);
    else if (who === 'customer') assert.equal(status, 403, `${who} ${path}`);
    else assert.ok(status === 200 || status === 409, `${who} ${path} got ${status}`);
  }
  assert.deepEqual(customerGets, [403, 403]);
});

test('presence is scoped by role: same level, managers also waiters and chefs, admin everyone', async () => {
  // Act
  const seen = {};
  for (const role of STAFF) {
    const { status, body } = await api.call('GET', '/attendance/presence', { token: tokens[role] });
    assert.equal(status, 200);
    seen[role] = body.people;
  }
  const roles = (people) => [...new Set(people.map((p) => p.role))].sort();

  // Assert
  assert.deepEqual(roles(seen.waiter), ['waiter']);
  assert.deepEqual(roles(seen.chef), ['chef']);
  assert.deepEqual(roles(seen.manager), ['chef', 'manager', 'waiter']);
  assert.deepEqual(roles(seen.admin), ['admin', 'chef', 'manager', 'waiter']);
  assert.equal(seen.admin.length, 6);
  for (const p of seen.admin) {
    assert.deepEqual(Object.keys(p).sort(), ['name', 'role', 'since', 'state', 'todayShift', 'userId']);
    assert.ok(['off', 'working', 'on_break'].includes(p.state));
    assert.ok(!('hourlyWage' in p));
  }
});

test('presence follows the clock', async () => {
  // Arrange
  await clockOff(tokens.waiter);
  const stateOf = async () => (await api.call('GET', '/attendance/presence', { token: tokens.admin })).body.people.find((p) => p.userId === 'usr_waiter');

  // Act
  const before1 = await stateOf();
  await post('/attendance/clock-in', tokens.waiter);
  const working = await stateOf();
  await post('/attendance/break/start', tokens.waiter);
  const onBreak = await stateOf();
  await post('/attendance/clock-out', tokens.waiter);

  // Assert
  assert.equal(before1.state, 'off');
  assert.equal(working.state, 'working');
  assert.equal(onBreak.state, 'on_break');
  assert.ok(onBreak.since >= working.since);
});

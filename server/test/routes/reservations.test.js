/** Reservations module — routes/reservations.js (US7.1–US7.4). */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, tableByNumber, localDate, localTime } from '../helpers.js';

let api;
let waiter;
let manager;
before(async () => {
  api = await startServer();
  [waiter, manager] = await Promise.all([api.login('waiter'), api.login('manager')]);
});
after(() => api.close());

const inDays = (n) => localDate(new Date(Date.now() + n * 86400000));

test('US7.1 bookings start as requested; a full slot is rejected with alternatives', async () => {
  // Arrange
  const date = inDays(4);

  // Act
  const first = await api.call('POST', '/reservations', { body: { customerName: 'Party One', email: 'one@example.com', partySize: 8, date, time: '19:00' } });
  // Assert
  assert.equal(first.status, 201);
  assert.equal(first.body.reservation.status, 'requested');

  // Act — a second party at the same busy slot
  const full = await api.call('POST', '/reservations', { body: { customerName: 'Party Two', email: 'two@example.com', partySize: 8, date, time: '19:30' } });
  // Assert — rejected, with real alternatives
  assert.equal(full.status, 409);
  assert.ok(full.body.alternatives.length > 0);
  for (const alt of full.body.alternatives) {
    const retry = await api.call('GET', `/reservations/availability?date=${alt.date}&partySize=8`);
    assert.ok(retry.body.slots.find((s) => s.time === alt.time).available);
  }

  // Act / Assert — an oversized party is rejected outright
  assert.equal((await api.call('POST', '/reservations', { body: { customerName: 'Huge', email: 'h@example.com', partySize: 20, date, time: '19:00' } })).status, 400);
});

test('US7.2 confirming a booking notifies the customer', async () => {
  // Arrange
  const customer = await api.login('customer');
  const created = await api.call('POST', '/reservations', { token: customer, body: { partySize: 2, date: inDays(6), time: '18:30' } });
  assert.equal(created.body.reservation.customerName, 'Casey Customer');

  // Act
  const confirmed = await api.call('PATCH', `/reservations/${created.body.reservation.id}`, { token: waiter, body: { status: 'confirmed' } });

  // Assert
  assert.equal(confirmed.body.reservation.status, 'confirmed');
  assert.ok(confirmed.body.reservation.notifiedAt);
  const notes = (await api.call('GET', '/notifications', { token: customer })).body.notifications;
  assert.match(notes[0].message, /confirmed/);
});

test('US7.3 an assigned table shows reserved around the booked time', async () => {
  // Arrange
  const soon = new Date(Date.now() + 30 * 60000);
  const created = await api.call('POST', '/reservations', { body: { customerName: 'Walk Soon', email: 'soon@example.com', partySize: 2, date: localDate(soon), time: localTime(soon) } });
  const t1 = await tableByNumber(api.call, waiter, 1);

  // Act / Assert — a table too small for the party is refused
  const small = await api.call('PATCH', `/reservations/${created.body.reservation.id}`, { token: waiter, body: { tableId: t1.id, partySize: 4 } });
  assert.equal(small.status, 400, 'table too small for the party');

  // Act — assign and confirm
  await api.call('PATCH', `/reservations/${created.body.reservation.id}`, { token: waiter, body: { tableId: t1.id, status: 'confirmed' } });
  // Assert
  assert.equal((await tableByNumber(api.call, waiter, 1)).status, 'reserved');

  // Act — the party is seated
  const seated = await api.call('PATCH', `/reservations/${created.body.reservation.id}`, { token: waiter, body: { status: 'seated' } });
  // Assert
  assert.equal(seated.body.reservation.status, 'seated');
  assert.equal((await tableByNumber(api.call, waiter, 1)).status, 'occupied');
});

test('US7.4 no-shows only after the grace period; cancellations release the table', async () => {
  // Arrange
  const { body } = await api.call('GET', '/reservations', { token: waiter });
  const late = body.reservations.find((r) => r.late);
  const onTime = body.reservations.find((r) => r.status === 'confirmed' && !r.late && r.tableId);
  assert.ok(late && onTime);

  // Act / Assert — a booking within its grace period cannot be marked no-show
  assert.equal((await api.call('PATCH', `/reservations/${onTime.id}`, { token: waiter, body: { status: 'no_show' } })).status, 409);

  // Act — a late booking can be
  const noShow = await api.call('PATCH', `/reservations/${late.id}`, { token: manager, body: { status: 'no_show' } });
  // Assert — the table is released
  assert.equal(noShow.body.reservation.status, 'no_show');
  assert.equal((await api.call('GET', '/tables', { token: waiter })).body.tables.find((t) => t.id === late.tableId).status, 'free');

  // Act / Assert — cancelling requires auth and releases the table
  assert.equal((await api.call('POST', `/reservations/${onTime.id}/cancel`)).status, 401);
  const cancelled = await api.call('POST', `/reservations/${onTime.id}/cancel`, { token: waiter });
  assert.equal(cancelled.body.reservation.status, 'cancelled');
  assert.equal((await api.call('GET', '/tables', { token: waiter })).body.tables.find((t) => t.id === onTime.tableId).status, 'free');
});

test("a customer's /reservations/mine lists only their own bookings, newest first", async () => {
  // Arrange
  const customer = await api.login('customer');
  const me = (await api.call('GET', '/customers/me', { token: customer })).body.customer;
  const all = (await api.call('GET', '/reservations', { token: manager })).body.reservations;

  // Act
  const res = await api.call('GET', '/reservations/mine', { token: customer });

  // Assert
  assert.equal(res.status, 200);
  const mine = res.body.reservations;
  assert.ok(mine.length > 0, 'the seeded customer has a booking');
  assert.ok(mine.every((r) => r.customerId === me.id), 'no other guest\'s bookings leak');
  assert.ok(all.some((r) => r.customerId !== me.id), 'other guests do have bookings');
  const keys = mine.map((r) => r.date + r.time);
  assert.deepEqual(keys, [...keys].sort().reverse());
});

test('/reservations/mine is empty for staff and 401 without a login', async () => {
  // Act
  const staff = await api.call('GET', '/reservations/mine', { token: waiter });
  const anonymous = await api.call('GET', '/reservations/mine');

  // Assert
  assert.equal(staff.status, 200);
  assert.deepEqual(staff.body.reservations, []);
  assert.equal(anonymous.status, 401);
});

test('the upcoming list keeps last night\'s late guests after midnight, but not finished bookings', async () => {
  // Arrange — two of yesterday's late-evening bookings: one still awaiting the guest, one already seated
  const { reservations } = await import('../../src/data/store.js');
  const yesterday = inDays(-1);
  const base = { phone: '', specialRequests: '', tableId: null, customerId: null, partySize: 2, date: yesterday, time: '23:30', createdAt: new Date().toISOString() };
  reservations.push(
    { ...base, id: 'res_lastnight_waiting', customerName: 'Late Larry', email: 'larry@example.com', status: 'confirmed' },
    { ...base, id: 'res_lastnight_seated', customerName: 'Seated Sam', email: 'sam@example.com', status: 'seated' },
  );

  // Act
  const { body } = await api.call('GET', '/reservations', { token: waiter });

  // Assert
  const ids = body.reservations.map((r) => r.id);
  assert.ok(ids.includes('res_lastnight_waiting'), 'a late confirmed booking from last night still needs action');
  assert.equal(body.reservations.find((r) => r.id === 'res_lastnight_waiting').late, true);
  assert.ok(!ids.includes('res_lastnight_seated'), 'finished bookings from yesterday stay in Past');
});

test('booking fields are type-checked: real dates, valid email and phone, short name and requests', async () => {
  // Arrange
  const date = inDays(6);
  const base = { customerName: 'Type Check', email: 'type@example.com', partySize: 2, date, time: '18:00' };
  const book = (extra) => api.call('POST', '/reservations', { body: { ...base, ...extra } });

  // Act
  const arrayDate = await book({ date: [date] });
  const impossibleDate = await book({ date: '2031-02-31' });
  const badEmail = await book({ email: 'not-an-email' });
  const badPhone = await book({ phone: 'call me' });
  const longName = await book({ customerName: 'x'.repeat(81) });
  const longRequests = await book({ specialRequests: 'x'.repeat(501) });
  const boolParty = await book({ partySize: true });
  const ok = await book({ phone: '+44 20 7946 0958' });

  // Assert
  for (const res of [arrayDate, impossibleDate, badEmail, badPhone, longName, longRequests, boolParty]) assert.equal(res.status, 400);
  assert.equal(ok.status, 201);
  assert.equal(ok.body.reservation.date, date);
  assert.equal(ok.body.reservation.status, 'requested');
});

test('a guest cannot choose the status, table or id of a new booking', async () => {
  // Act
  const res = await api.call('POST', '/reservations', {
    body: { customerName: 'Sneaky Guest', email: 'sneaky@example.com', partySize: 2, date: inDays(7), time: '18:30', status: 'confirmed', tableId: 'tab_1', id: 'res_hijack', customerId: 'cus_1' },
  });

  // Assert
  assert.equal(res.status, 201);
  assert.equal(res.body.reservation.status, 'requested');
  assert.equal(res.body.reservation.tableId, null);
  assert.notEqual(res.body.reservation.id, 'res_hijack');
  assert.equal(res.body.reservation.customerId, null);
});

test('staff booking edits reject a non-string table and over-long requests', async () => {
  // Arrange
  const created = await api.call('POST', '/reservations', { body: { customerName: 'Edit Check', email: 'edit@example.com', partySize: 2, date: inDays(8), time: '19:00' } });
  const id = created.body.reservation.id;

  // Act
  const objectTable = await api.call('PATCH', `/reservations/${id}`, { token: manager, body: { tableId: { $ne: null } } });
  const longRequests = await api.call('PATCH', `/reservations/${id}`, { token: manager, body: { specialRequests: 'x'.repeat(501) } });

  // Assert
  assert.equal(objectTable.status, 400);
  assert.equal(longRequests.status, 400);
});

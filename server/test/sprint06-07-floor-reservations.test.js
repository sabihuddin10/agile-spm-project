/** Sprint 6 — Table Management (US6.1–US6.4) and Sprint 7 — Reservations (US7.1–US7.4). */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, menuItem, tableByNumber, localDate, localTime } from './helpers.js';

let api;
let waiter;
let manager;
before(async () => {
  api = await startServer();
  [waiter, manager] = await Promise.all([api.login('waiter'), api.login('manager')]);
});
after(() => api.close());

const inDays = (n) => localDate(new Date(Date.now() + n * 86400000));

test('US6.1 managers add tables with a zone; waiters cannot change the layout', async () => {
  const created = await api.call('POST', '/tables', { token: manager, body: { number: 21, seats: 4, zone: 'Patio' } });
  assert.equal(created.status, 201);
  const { body } = await api.call('GET', '/tables', { token: waiter });
  assert.ok(body.zones.includes('Patio'));
  assert.equal(body.tables.find((t) => t.number === 21).zone, 'Patio');
  assert.equal((await api.call('PATCH', `/tables/${created.body.table.id}`, { token: waiter, body: { seats: 8 } })).status, 403);
  assert.equal((await api.call('POST', '/tables', { token: manager, body: { number: 21, seats: 2, zone: 'Patio' } })).status, 409);
});

test('US6.2 the floor plan reports live status, orders and bookings', async () => {
  const { body } = await api.call('GET', '/tables', { token: waiter });
  const t4 = body.tables.find((t) => t.number === 4);
  assert.equal(t4.status, 'occupied');
  assert.ok(t4.activeOrders.length > 0);
  assert.equal(body.tables.find((t) => t.number === 7).status, 'reserved', 'held for the booking arriving soon');
});

test('US6.4 a table frees itself when its order closes, unless held', async () => {
  const soda = await menuItem(api.call, 'Soda');
  const chef = await api.login('chef');
  async function closeOrderOn(tableNumber) {
    const table = await tableByNumber(api.call, waiter, tableNumber);
    const { body } = await api.call('POST', '/orders', { token: waiter, body: { type: 'dine-in', tableId: table.id, items: [{ menuItemId: soda.id, qty: 1 }] } });
    assert.equal((await tableByNumber(api.call, waiter, tableNumber)).status, 'occupied');
    await api.call('POST', `/orders/${body.order.id}/status`, { token: chef, body: { status: 'ready' } });
    await api.call('POST', `/orders/${body.order.id}/status`, { token: waiter, body: { status: 'served' } });
    await api.call('POST', `/billing/${body.order.id}/pay`, { token: waiter, body: { method: 'card' } });
    return table;
  }
  await closeOrderOn(1);
  assert.equal((await tableByNumber(api.call, waiter, 1)).status, 'free');

  const t5 = await tableByNumber(api.call, waiter, 5);
  await api.call('PATCH', `/tables/${t5.id}`, { token: waiter, body: { held: true } });
  await closeOrderOn(5);
  assert.equal((await tableByNumber(api.call, waiter, 5)).status, 'occupied');
});

test('US7.1 bookings start as requested; a full slot is rejected with alternatives', async () => {
  const date = inDays(4);
  const first = await api.call('POST', '/reservations', { body: { customerName: 'Party One', email: 'one@example.com', partySize: 8, date, time: '19:00' } });
  assert.equal(first.status, 201);
  assert.equal(first.body.reservation.status, 'requested');

  const full = await api.call('POST', '/reservations', { body: { customerName: 'Party Two', email: 'two@example.com', partySize: 8, date, time: '19:30' } });
  assert.equal(full.status, 409);
  assert.ok(full.body.alternatives.length > 0);
  for (const alt of full.body.alternatives) {
    const retry = await api.call('GET', `/reservations/availability?date=${alt.date}&partySize=8`);
    assert.ok(retry.body.slots.find((s) => s.time === alt.time).available);
  }
  assert.equal((await api.call('POST', '/reservations', { body: { customerName: 'Huge', email: 'h@example.com', partySize: 20, date, time: '19:00' } })).status, 400);
});

test('US7.2 confirming a booking notifies the customer', async () => {
  const customer = await api.login('customer');
  const created = await api.call('POST', '/reservations', { token: customer, body: { partySize: 2, date: inDays(6), time: '18:30' } });
  assert.equal(created.body.reservation.customerName, 'Casey Customer');
  const confirmed = await api.call('PATCH', `/reservations/${created.body.reservation.id}`, { token: waiter, body: { status: 'confirmed' } });
  assert.equal(confirmed.body.reservation.status, 'confirmed');
  assert.ok(confirmed.body.reservation.notifiedAt);
  const notes = (await api.call('GET', '/notifications', { token: customer })).body.notifications;
  assert.match(notes[0].message, /confirmed/);
});

test('US7.3 an assigned table shows reserved around the booked time', async () => {
  const soon = new Date(Date.now() + 30 * 60000);
  const created = await api.call('POST', '/reservations', { body: { customerName: 'Walk Soon', email: 'soon@example.com', partySize: 2, date: localDate(soon), time: localTime(soon) } });
  const t1 = await tableByNumber(api.call, waiter, 1);
  const small = await api.call('PATCH', `/reservations/${created.body.reservation.id}`, { token: waiter, body: { tableId: t1.id, partySize: 4 } });
  assert.equal(small.status, 400, 'table too small for the party');
  await api.call('PATCH', `/reservations/${created.body.reservation.id}`, { token: waiter, body: { tableId: t1.id, status: 'confirmed' } });
  assert.equal((await tableByNumber(api.call, waiter, 1)).status, 'reserved');

  const seated = await api.call('PATCH', `/reservations/${created.body.reservation.id}`, { token: waiter, body: { status: 'seated' } });
  assert.equal(seated.body.reservation.status, 'seated');
  assert.equal((await tableByNumber(api.call, waiter, 1)).status, 'occupied');
});

test('US7.4 no-shows only after the grace period; cancellations release the table', async () => {
  const { body } = await api.call('GET', '/reservations', { token: waiter });
  const late = body.reservations.find((r) => r.late);
  const onTime = body.reservations.find((r) => r.status === 'confirmed' && !r.late && r.tableId);
  assert.ok(late && onTime);

  assert.equal((await api.call('PATCH', `/reservations/${onTime.id}`, { token: waiter, body: { status: 'no_show' } })).status, 409);
  const noShow = await api.call('PATCH', `/reservations/${late.id}`, { token: manager, body: { status: 'no_show' } });
  assert.equal(noShow.body.reservation.status, 'no_show');
  assert.equal((await api.call('GET', '/tables', { token: waiter })).body.tables.find((t) => t.id === late.tableId).status, 'free');

  assert.equal((await api.call('POST', `/reservations/${onTime.id}/cancel`)).status, 401);
  const cancelled = await api.call('POST', `/reservations/${onTime.id}/cancel`, { token: waiter });
  assert.equal(cancelled.body.reservation.status, 'cancelled');
  assert.equal((await api.call('GET', '/tables', { token: waiter })).body.tables.find((t) => t.id === onTime.tableId).status, 'free');
});

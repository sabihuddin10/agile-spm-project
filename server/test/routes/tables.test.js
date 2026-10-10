/** Tables / floor-plan module — routes/tables.js (US6.1, US6.2, US6.4). */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, menuItem, tableByNumber } from '../helpers.js';

let api;
let waiter;
let manager;
before(async () => {
  api = await startServer();
  [waiter, manager] = await Promise.all([api.login('waiter'), api.login('manager')]);
});
after(() => api.close());

test('US6.1 managers add tables with a zone; waiters cannot change the layout', async () => {
  // Act
  const created = await api.call('POST', '/tables', { token: manager, body: { number: 21, seats: 4, zone: 'Patio' } });
  // Assert
  assert.equal(created.status, 201);

  const { body } = await api.call('GET', '/tables', { token: waiter });
  assert.ok(body.zones.includes('Patio'));
  assert.equal(body.tables.find((t) => t.number === 21).zone, 'Patio');

  // Act / Assert — waiters cannot edit the layout; duplicate numbers are refused
  assert.equal((await api.call('PATCH', `/tables/${created.body.table.id}`, { token: waiter, body: { seats: 8 } })).status, 403);
  assert.equal((await api.call('POST', '/tables', { token: manager, body: { number: 21, seats: 2, zone: 'Patio' } })).status, 409);
});

test('US6.2 the floor plan reports live status, orders and bookings', async () => {
  // Act
  const { body } = await api.call('GET', '/tables', { token: waiter });

  // Assert
  const t4 = body.tables.find((t) => t.number === 4);
  assert.equal(t4.status, 'occupied');
  assert.ok(t4.activeOrders.length > 0);
  assert.equal(body.tables.find((t) => t.number === 7).status, 'reserved', 'held for the booking arriving soon');
});

test('US6.4 a table frees itself when its order closes, unless held', async () => {
  // Arrange
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

  // Act — close an order on an ordinary table
  await closeOrderOn(1);
  // Assert
  assert.equal((await tableByNumber(api.call, waiter, 1)).status, 'free');

  // Act — close an order on a held table
  const t5 = await tableByNumber(api.call, waiter, 5);
  await api.call('PATCH', `/tables/${t5.id}`, { token: waiter, body: { held: true } });
  await closeOrderOn(5);
  // Assert — a held table stays occupied
  assert.equal((await tableByNumber(api.call, waiter, 5)).status, 'occupied');
});

test('/tables/public needs no login and exposes only id, number, seats and zone', async () => {
  // Arrange
  const floor = (await api.call('GET', '/tables', { token: waiter })).body.tables;

  // Act
  const res = await api.call('GET', '/tables/public');

  // Assert
  assert.equal(res.status, 200);
  assert.equal(res.body.tables.length, floor.length);
  for (const table of res.body.tables) {
    assert.deepEqual(Object.keys(table).sort(), ['id', 'number', 'seats', 'zone']);
  }
  const numbers = res.body.tables.map((t) => t.number);
  assert.deepEqual(numbers, [...numbers].sort((a, b) => a - b));
});

test('DELETE /tables/:id a manager removes a free table from the floor plan', async () => {
  // Arrange
  const created = await api.call('POST', '/tables', { token: manager, body: { number: 31, seats: 2, zone: 'Patio' } });
  const id = created.body.table.id;

  // Act
  const res = await api.call('DELETE', `/tables/${id}`, { token: manager });

  // Assert
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { deleted: true, id });
  const { body } = await api.call('GET', '/tables', { token: manager });
  assert.ok(!body.tables.some((t) => t.id === id));
});

test('DELETE /tables/:id is refused with 409 while the table has an active order', async () => {
  // Arrange
  const soda = await menuItem(api.call, 'Soda');
  const created = await api.call('POST', '/tables', { token: manager, body: { number: 32, seats: 4, zone: 'Patio' } });
  const id = created.body.table.id;
  const order = await api.call('POST', '/orders', { token: waiter, body: { type: 'dine-in', tableId: id, items: [{ menuItemId: soda.id, qty: 1 }] } });
  assert.equal(order.status, 201);

  // Act
  const res = await api.call('DELETE', `/tables/${id}`, { token: manager });

  // Assert
  assert.equal(res.status, 409);
  assert.equal(res.body.error, 'This table has active orders.');
  assert.ok(await tableByNumber(api.call, manager, 32), 'the table is still on the floor plan');
});

test('DELETE /tables/:id returns 404 for an unknown table', async () => {
  // Act
  const res = await api.call('DELETE', '/tables/tbl_does_not_exist', { token: manager });

  // Assert
  assert.equal(res.status, 404);
  assert.equal(res.body.error, 'Table not found.');
});

test('DELETE /tables/:id is refused for a waiter', async () => {
  // Arrange
  const created = await api.call('POST', '/tables', { token: manager, body: { number: 33, seats: 2, zone: 'Patio' } });
  const id = created.body.table.id;

  // Act
  const res = await api.call('DELETE', `/tables/${id}`, { token: waiter });

  // Assert
  assert.equal(res.status, 403);
  assert.ok(await tableByNumber(api.call, manager, 33), 'the table is still on the floor plan');
});

test('only active floor staff can be assigned to look after a table', async () => {
  // Arrange
  const table = await tableByNumber(api.call, waiter, 2);

  // Act
  const chef = await api.call('PATCH', `/tables/${table.id}`, { token: manager, body: { waiterId: 'usr_chef' } });
  const otherWaiter = await api.call('PATCH', `/tables/${table.id}`, { token: waiter, body: { waiterId: 'usr_waiter2' } });

  // Assert
  assert.equal(chef.status, 400);
  assert.match(chef.body.error, /floor staff/);
  assert.equal(otherWaiter.status, 200);
  assert.equal(otherWaiter.body.table.waiterId, 'usr_waiter2');
});

test('table fields are type-checked: whole-number table numbers, finite seats, short zones, real booleans', async () => {
  // Arrange
  const token = await api.login('manager');
  const table = await tableByNumber(api.call, token, 2);

  // Act
  const boolNumber = await api.call('POST', '/tables', { token, body: { number: true, seats: 2 } });
  const infiniteSeats = await api.call('POST', '/tables', { token, body: { number: 901, seats: 'Infinity' } });
  const longZone = await api.call('POST', '/tables', { token, body: { number: 902, seats: 2, zone: 'z'.repeat(41) } });
  const objectZone = await api.call('POST', '/tables', { token, body: { number: 903, seats: 2, zone: { name: 'Patio' } } });
  const stringHeld = await api.call('PATCH', `/tables/${table.id}`, { token, body: { held: 'false', seats: 3 } });
  const after = await tableByNumber(api.call, token, 2);

  // Assert
  for (const res of [boolNumber, infiniteSeats, longZone, objectZone, stringHeld]) assert.equal(res.status, 400);
  assert.equal(after.seats, table.seats, 'the rejected edit changed nothing');
  assert.equal(after.held, table.held);
});

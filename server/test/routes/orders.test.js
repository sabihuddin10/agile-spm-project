/** Orders & kitchen module — routes/orders.js (US3.1–US3.5, US4.1–US4.5). */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, menuItem, tableByNumber } from '../helpers.js';

let api;
let waiter;
let chef;
let customer;
before(async () => {
  api = await startServer();
  [waiter, chef, customer] = await Promise.all([api.login('waiter'), api.login('chef'), api.login('customer')]);
});
after(() => api.close());

test('US3.1 a customer places an order with status placed and correct totals', async () => {
  // Arrange
  const bowl = await menuItem(api.call, 'Vegan Bowl');
  const table = await tableByNumber(api.call, waiter, 1);

  // Act
  const res = await api.call('POST', '/orders', {
    token: customer,
    body: { type: 'dine-in', tableId: table.id, paymentMethod: 'cash', items: [{ menuItemId: bowl.id, qty: 2 }] },
  });

  // Assert
  assert.equal(res.status, 201);
  const o = res.body.order;
  assert.equal(o.status, 'placed');
  assert.equal(o.subtotal, 30);
  assert.equal(o.serviceCharge, 1.5);
  assert.equal(o.tax, 3);
  assert.equal(o.total, 34.5);
  assert.equal((await tableByNumber(api.call, waiter, 1)).status, 'occupied');
});

test('US3.1 customers cannot charge orders or points to someone else', async () => {
  // Arrange
  const soda = await menuItem(api.call, 'Soda');

  // Act
  const res = await api.call('POST', '/orders', {
    token: customer,
    body: { type: 'online', customerId: 'cus_3', pointsUsed: 9999, paymentMethod: 'cash', items: [{ menuItemId: soda.id, qty: 1 }] },
  });

  // Assert
  assert.equal(res.body.order.customer.name, 'Casey Customer');
  assert.ok(res.body.order.pointsUsed <= 25, 'points capped at the subtotal');
});

test('US3.2 waiters confirm placed orders; items are editable only before confirmation', async () => {
  // Arrange
  const lemonade = await menuItem(api.call, 'Lemonade');
  const { body } = await api.call('POST', '/orders', { token: customer, body: { type: 'online', paymentMethod: 'cash', items: [{ menuItemId: lemonade.id, qty: 1 }] } });
  const id = body.order.id;

  // Act — edit the items before confirmation
  const edited = await api.call('PUT', `/orders/${id}/items`, { token: waiter, body: { items: [{ menuItemId: lemonade.id, qty: 3, modifiers: [{ group: 'Size', label: 'Large' }] }] } });
  // Assert
  assert.equal(edited.body.order.subtotal, 15);

  // Act / Assert — only staff (not chefs) confirm orders
  assert.equal((await api.call('POST', `/orders/${id}/status`, { token: chef, body: { status: 'confirmed' } })).status, 403);
  const confirmed = await api.call('POST', `/orders/${id}/status`, { token: waiter, body: { status: 'confirmed' } });
  assert.equal(confirmed.body.order.status, 'confirmed');
  assert.ok(confirmed.body.order.items.every((i) => i.status === 'queued'));

  // Act / Assert — items are locked once confirmed
  const late = await api.call('PUT', `/orders/${id}/items`, { token: waiter, body: { items: [{ menuItemId: lemonade.id, qty: 1 }] } });
  assert.equal(late.status, 409);
});

test('US3.3 / US3.4 lifecycle moves through item states; invalid jumps are refused', async () => {
  // Arrange
  const pizza = await menuItem(api.call, 'Margherita Pizza');
  const bread = await menuItem(api.call, 'Garlic Bread');
  const { body } = await api.call('POST', '/orders', { token: waiter, body: { type: 'dine-in', items: [{ menuItemId: pizza.id, qty: 1 }, { menuItemId: bread.id, qty: 1 }] } });
  const o = body.order;

  // Assert — staff orders skip straight to the kitchen
  assert.equal(o.status, 'confirmed', 'staff orders go straight to the kitchen');
  // Act / Assert — cannot serve before items are ready
  assert.equal((await api.call('POST', `/orders/${o.id}/status`, { token: waiter, body: { status: 'served' } })).status, 409);

  // Act — one item ready
  let r = await api.call('PATCH', `/orders/${o.id}/items/${o.items[1].id}`, { token: chef, body: { status: 'ready' } });
  // Assert
  assert.equal(r.body.order.status, 'preparing', 'one item ready → order still in progress');
  assert.deepEqual(r.body.order.items.map((i) => i.status), ['queued', 'ready']);

  // Act — the remaining item moves to ready
  r = await api.call('PATCH', `/orders/${o.id}/items/${o.items[0].id}`, { token: chef, body: { status: 'preparing' } });
  r = await api.call('PATCH', `/orders/${o.id}/items/${o.items[0].id}`, { token: chef, body: { status: 'ready' } });
  // Assert
  assert.equal(r.body.order.status, 'ready');

  // Act — serve
  r = await api.call('POST', `/orders/${o.id}/status`, { token: waiter, body: { status: 'served' } });
  // Assert
  assert.equal(r.body.order.status, 'served');
});

test('US3.5 / US6.3 a dine-in order is attached to a table', async () => {
  // Arrange
  const soda = await menuItem(api.call, 'Soda');
  const { body } = await api.call('POST', '/orders', { token: waiter, body: { type: 'dine-in', items: [{ menuItemId: soda.id, qty: 1 }] } });
  assert.equal(body.order.tableId, null);
  const table = await tableByNumber(api.call, waiter, 8);

  // Act — assign the table
  const r = await api.call('PATCH', `/orders/${body.order.id}/table`, { token: waiter, body: { tableId: table.id } });

  // Assert
  assert.equal(r.body.order.tableNumber, 8);
  const after8 = await tableByNumber(api.call, waiter, 8);
  assert.equal(after8.status, 'occupied');
  assert.ok(after8.activeOrders.some((x) => x.id === body.order.id));

  // Act / Assert — an online order cannot be seated at a table
  const online = await api.call('POST', '/orders', { token: waiter, body: { type: 'online', items: [{ menuItemId: soda.id, qty: 1 }] } });
  assert.equal((await api.call('PATCH', `/orders/${online.body.order.id}/table`, { token: waiter, body: { tableId: table.id } })).status, 400);
});

test('US4.1 the KDS lists confirmed orders, rush first then oldest first', async () => {
  // Act
  const { body } = await api.call('GET', '/orders/kitchen', { token: chef });

  // Assert
  assert.ok(body.queue.every((o) => ['confirmed', 'preparing'].includes(o.status)));
  assert.ok(!body.queue.some((o) => o.status === 'placed'));
  const normal = body.queue.filter((o) => o.priority === 'normal').map((o) => o.kitchenRank);
  assert.deepEqual(normal, [...normal].sort((a, b) => a - b));
  const firstNormal = body.queue.findIndex((o) => o.priority === 'normal');
  assert.ok(body.queue.slice(firstNormal).every((o) => o.priority === 'normal'));
  assert.equal(body.delayMinutes, 15);
});

test('US4.2 / US4.3 / US4.4 chef marks items in prep and ready; the waiter is notified', async () => {
  // Arrange
  const fries = await menuItem(api.call, 'Fries');
  const soda = await menuItem(api.call, 'Soda');
  const { body } = await api.call('POST', '/orders', { token: waiter, body: { type: 'dine-in', items: [{ menuItemId: fries.id, qty: 1 }, { menuItemId: soda.id, qty: 1 }] } });
  const [friesLine, sodaLine] = body.order.items;
  const before = (await api.call('GET', '/notifications', { token: waiter })).body.unreadCount;

  // Act / Assert — only the chef can move items into prep
  assert.equal((await api.call('PATCH', `/orders/${body.order.id}/items/${friesLine.id}`, { token: waiter, body: { status: 'preparing' } })).status, 403);
  let r = await api.call('PATCH', `/orders/${body.order.id}/items/${friesLine.id}`, { token: chef, body: { status: 'preparing' } });
  assert.equal(r.body.order.items[0].status, 'preparing');

  // Act — the soda becomes ready
  r = await api.call('PATCH', `/orders/${body.order.id}/items/${sodaLine.id}`, { token: chef, body: { status: 'ready' } });
  // Assert — the waiter is notified
  const notes = (await api.call('GET', '/notifications', { token: waiter })).body;
  assert.equal(notes.unreadCount, before + 1);
  assert.match(notes.notifications[0].message, /Soda is ready/);

  // Act — the fries become ready too
  await api.call('PATCH', `/orders/${body.order.id}/items/${friesLine.id}`, { token: chef, body: { status: 'ready' } });
  // Assert — the whole order appears in the ready-for-pickup list
  const kds = (await api.call('GET', '/orders/kitchen', { token: chef })).body;
  assert.ok(kds.ready.some((o) => o.id === body.order.id), 'appears in the ready-for-pickup list');
});

test('US4.5 orders can be rushed and moved within the queue', async () => {
  // Arrange
  const soda = await menuItem(api.call, 'Soda');
  const a = (await api.call('POST', '/orders', { token: waiter, body: { type: 'online', items: [{ menuItemId: soda.id, qty: 1 }] } })).body.order;
  const b = (await api.call('POST', '/orders', { token: waiter, body: { type: 'online', items: [{ menuItemId: soda.id, qty: 1 }] } })).body.order;
  const position = async (id) => (await api.call('GET', '/orders/kitchen', { token: chef })).body.queue.findIndex((o) => o.id === id);
  assert.ok((await position(a.id)) < (await position(b.id)));

  // Act — move b up
  await api.call('POST', `/orders/${b.id}/kitchen`, { token: chef, body: { action: 'up' } });
  // Assert
  assert.ok((await position(b.id)) < (await position(a.id)));

  // Act — rush a
  await api.call('POST', `/orders/${a.id}/kitchen`, { token: chef, body: { action: 'rush' } });
  // Assert
  const queue = (await api.call('GET', '/orders/kitchen', { token: chef })).body.queue;
  assert.equal(queue.find((o) => o.id === a.id).priority, 'rush');
  assert.ok(queue.findIndex((o) => o.id === a.id) < queue.findIndex((o) => o.priority === 'normal'));

  // Act / Assert — a waiter cannot reorder the kitchen queue
  assert.equal((await api.call('POST', `/orders/${a.id}/kitchen`, { token: waiter, body: { action: 'up' } })).status, 403);
});

test("a customer's /orders/mine lists only their own orders, newest first", async () => {
  // Arrange
  const me = (await api.call('GET', '/customers/me', { token: customer })).body.customer;
  const all = (await api.call('GET', '/orders?scope=all', { token: waiter })).body.orders;

  // Act
  const res = await api.call('GET', '/orders/mine', { token: customer });

  // Assert
  assert.equal(res.status, 200);
  const mine = res.body.orders;
  assert.ok(mine.length > 0, 'the seeded customer has orders');
  assert.ok(mine.length <= 50);
  assert.ok(mine.every((o) => o.customerId === me.id), 'no other customer\'s orders leak');
  assert.ok(all.some((o) => o.customerId && o.customerId !== me.id), 'other customers do have orders');
  const times = mine.map((o) => o.createdAt);
  assert.deepEqual(times, [...times].sort().reverse());
});

test('/orders/mine is empty for staff and requires a login', async () => {
  // Act
  const staff = await api.call('GET', '/orders/mine', { token: waiter });
  const anonymous = await api.call('GET', '/orders/mine');

  // Assert
  assert.equal(staff.status, 200);
  assert.deepEqual(staff.body.orders, []);
  assert.equal(anonymous.status, 401);
});

test('cancelling a paid order refunds it, so a waiter may only cancel unpaid orders', async () => {
  // Arrange — a prepaid online order the waiter has confirmed (paid but still open),
  // and an unpaid dine-in order
  const pizza = await menuItem(api.call, 'Margherita Pizza');
  const prepaid = await api.call('POST', '/orders', { token: customer, body: { type: 'online', fulfillment: 'pickup', paymentMethod: 'card', items: [{ menuItemId: pizza.id, qty: 1 }] } });
  const paidId = prepaid.body.order.id;
  await api.call('POST', `/orders/${paidId}/status`, { token: waiter, body: { status: 'confirmed' } });
  const unpaid = await api.call('POST', '/orders', { token: waiter, body: { type: 'dine-in', items: [{ menuItemId: pizza.id, qty: 1 }] } });
  const unpaidId = unpaid.body.order.id;
  const manager = await api.login('manager');

  // Act
  const waiterOnPaid = await api.call('POST', `/orders/${paidId}/status`, { token: waiter, body: { status: 'cancelled', reason: 'Guest left' } });
  const waiterOnUnpaid = await api.call('POST', `/orders/${unpaidId}/status`, { token: waiter, body: { status: 'cancelled', reason: 'Guest left' } });
  const managerOnPaid = await api.call('POST', `/orders/${paidId}/status`, { token: manager, body: { status: 'cancelled', reason: 'Guest complaint' } });

  // Assert
  assert.equal(waiterOnPaid.status, 403);
  assert.match(waiterOnPaid.body.error, /manager/);
  assert.equal(waiterOnUnpaid.status, 200);
  assert.equal(waiterOnUnpaid.body.order.status, 'cancelled');
  assert.equal(managerOnPaid.status, 200);
  assert.equal(managerOnPaid.body.order.paymentStatus, 'refunded');
});

test("a customer may still cancel their own prepaid order before the kitchen takes it", async () => {
  // Arrange — an online card order is paid when placed
  const pizza = await menuItem(api.call, 'Margherita Pizza');
  const placed = await api.call('POST', '/orders', { token: customer, body: { type: 'online', fulfillment: 'pickup', paymentMethod: 'card', items: [{ menuItemId: pizza.id, qty: 1 }] } });
  assert.equal(placed.body.order.paymentStatus, 'paid');

  // Act
  const res = await api.call('POST', `/orders/${placed.body.order.id}/status`, { token: customer, body: { status: 'cancelled' } });

  // Assert
  assert.equal(res.status, 200);
  assert.equal(res.body.order.paymentStatus, 'refunded');
});

test('a status of "__proto__" or "constructor" is an invalid status (400), not a server error', async () => {
  // Arrange
  const token = await api.login('waiter');
  const fries = await menuItem(api.call, 'Fries');
  const { body } = await api.call('POST', '/orders', { token, body: { type: 'dine-in', items: [{ menuItemId: fries.id, qty: 1 }] } });
  const order = body.order;

  for (const status of ['__proto__', 'constructor', 'toString', ['confirmed']]) {
    // Act
    const whole = await api.call('POST', `/orders/${order.id}/status`, { token, body: { status } });
    const item = await api.call('PATCH', `/orders/${order.id}/items/${order.items[0].id}`, { token, body: { status } });

    // Assert
    assert.equal(whole.status, 400, `order status ${status}`);
    assert.equal(item.status, 400, `item status ${status}`);
  }
});

test('order lines are type-checked: quantity 1–99 whole numbers, modifiers a list, notes at most 500 characters', async () => {
  // Arrange
  const token = await api.login('waiter');
  const fries = await menuItem(api.call, 'Fries');
  const place = (item, extra = {}) => api.call('POST', '/orders', { token, body: { type: 'dine-in', items: [{ menuItemId: fries.id, ...item }], ...extra } });

  // Act
  const huge = await place({ qty: 1000000 });
  const fraction = await place({ qty: 1.5 });
  const text = await place({ qty: 'lots' });
  const modifiers = await place({ qty: 1, modifiers: 'Large' });
  const notes = await place({ qty: 1 }, { notes: 'x'.repeat(501) });
  const tooManyLines = await api.call('POST', '/orders', { token, body: { type: 'dine-in', items: Array(51).fill({ menuItemId: fries.id, qty: 1 }) } });
  const ok = await place({ qty: '2' });

  // Assert
  for (const res of [huge, fraction, text, modifiers, notes, tooManyLines]) assert.equal(res.status, 400);
  assert.equal(ok.status, 201);
  assert.equal(ok.body.order.items[0].qty, 2);
});

test('a customer cannot set the price, payment status or owner of their order', async () => {
  // Arrange
  const token = await api.login('customer');
  const fries = await menuItem(api.call, 'Fries');

  // Act
  const res = await api.call('POST', '/orders', {
    token,
    body: {
      type: 'online', fulfillment: 'pickup', paymentMethod: 'cash', customerId: 'cus_someone_else',
      total: 0, paymentStatus: 'paid', status: 'served',
      items: [{ menuItemId: fries.id, qty: 1, unitPrice: 0, name: 'Free fries' }],
    },
  });

  // Assert
  assert.equal(res.status, 201);
  assert.equal(res.body.order.items[0].unitPrice, fries.price);
  assert.equal(res.body.order.items[0].name, 'Fries');
  assert.equal(res.body.order.paymentStatus, 'unpaid');
  assert.equal(res.body.order.status, 'placed');
  assert.notEqual(res.body.order.customerId, 'cus_someone_else');
});

/** Sprint 3 — Order Management (US3.1–US3.5) and Sprint 4 — Kitchen Workflow (US4.1–US4.5). */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, menuItem, tableByNumber } from './helpers.js';

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
  const bowl = await menuItem(api.call, 'Vegan Bowl');
  const table = await tableByNumber(api.call, waiter, 1);
  const res = await api.call('POST', '/orders', {
    token: customer,
    body: { type: 'dine-in', tableId: table.id, paymentMethod: 'cash', items: [{ menuItemId: bowl.id, qty: 2 }] },
  });
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
  const soda = await menuItem(api.call, 'Soda');
  const res = await api.call('POST', '/orders', {
    token: customer,
    body: { type: 'online', customerId: 'cus_3', pointsUsed: 9999, paymentMethod: 'cash', items: [{ menuItemId: soda.id, qty: 1 }] },
  });
  assert.equal(res.body.order.customer.name, 'Casey Customer');
  assert.ok(res.body.order.pointsUsed <= 25, 'points capped at the subtotal');
});

test('US3.2 waiters confirm placed orders; items are editable only before confirmation', async () => {
  const lemonade = await menuItem(api.call, 'Lemonade');
  const { body } = await api.call('POST', '/orders', { token: customer, body: { type: 'online', paymentMethod: 'cash', items: [{ menuItemId: lemonade.id, qty: 1 }] } });
  const id = body.order.id;

  const edited = await api.call('PUT', `/orders/${id}/items`, { token: waiter, body: { items: [{ menuItemId: lemonade.id, qty: 3, modifiers: [{ group: 'Size', label: 'Large' }] }] } });
  assert.equal(edited.body.order.subtotal, 15);

  assert.equal((await api.call('POST', `/orders/${id}/status`, { token: chef, body: { status: 'confirmed' } })).status, 403);
  const confirmed = await api.call('POST', `/orders/${id}/status`, { token: waiter, body: { status: 'confirmed' } });
  assert.equal(confirmed.body.order.status, 'confirmed');
  assert.ok(confirmed.body.order.items.every((i) => i.status === 'queued'));

  const late = await api.call('PUT', `/orders/${id}/items`, { token: waiter, body: { items: [{ menuItemId: lemonade.id, qty: 1 }] } });
  assert.equal(late.status, 409);
});

test('US3.3 / US3.4 lifecycle moves through item states; invalid jumps are refused', async () => {
  const pizza = await menuItem(api.call, 'Margherita Pizza');
  const bread = await menuItem(api.call, 'Garlic Bread');
  const { body } = await api.call('POST', '/orders', { token: waiter, body: { type: 'dine-in', items: [{ menuItemId: pizza.id, qty: 1 }, { menuItemId: bread.id, qty: 1 }] } });
  const o = body.order;
  assert.equal(o.status, 'confirmed', 'staff orders go straight to the kitchen');
  assert.equal((await api.call('POST', `/orders/${o.id}/status`, { token: waiter, body: { status: 'served' } })).status, 409);

  let r = await api.call('PATCH', `/orders/${o.id}/items/${o.items[1].id}`, { token: chef, body: { status: 'ready' } });
  assert.equal(r.body.order.status, 'preparing', 'one item ready → order still in progress');
  assert.deepEqual(r.body.order.items.map((i) => i.status), ['queued', 'ready']);

  r = await api.call('PATCH', `/orders/${o.id}/items/${o.items[0].id}`, { token: chef, body: { status: 'preparing' } });
  r = await api.call('PATCH', `/orders/${o.id}/items/${o.items[0].id}`, { token: chef, body: { status: 'ready' } });
  assert.equal(r.body.order.status, 'ready');
  r = await api.call('POST', `/orders/${o.id}/status`, { token: waiter, body: { status: 'served' } });
  assert.equal(r.body.order.status, 'served');
});

test('US3.5 / US6.3 a dine-in order is attached to a table', async () => {
  const soda = await menuItem(api.call, 'Soda');
  const { body } = await api.call('POST', '/orders', { token: waiter, body: { type: 'dine-in', items: [{ menuItemId: soda.id, qty: 1 }] } });
  assert.equal(body.order.tableId, null);
  const table = await tableByNumber(api.call, waiter, 8);
  const r = await api.call('PATCH', `/orders/${body.order.id}/table`, { token: waiter, body: { tableId: table.id } });
  assert.equal(r.body.order.tableNumber, 8);
  const after8 = await tableByNumber(api.call, waiter, 8);
  assert.equal(after8.status, 'occupied');
  assert.ok(after8.activeOrders.some((x) => x.id === body.order.id));

  const online = await api.call('POST', '/orders', { token: waiter, body: { type: 'online', items: [{ menuItemId: soda.id, qty: 1 }] } });
  assert.equal((await api.call('PATCH', `/orders/${online.body.order.id}/table`, { token: waiter, body: { tableId: table.id } })).status, 400);
});

test('US4.1 the KDS lists confirmed orders, rush first then oldest first', async () => {
  const { body } = await api.call('GET', '/orders/kitchen', { token: chef });
  assert.ok(body.queue.every((o) => ['confirmed', 'preparing'].includes(o.status)));
  assert.ok(!body.queue.some((o) => o.status === 'placed'));
  const normal = body.queue.filter((o) => o.priority === 'normal').map((o) => o.kitchenRank);
  assert.deepEqual(normal, [...normal].sort((a, b) => a - b));
  const firstNormal = body.queue.findIndex((o) => o.priority === 'normal');
  assert.ok(body.queue.slice(firstNormal).every((o) => o.priority === 'normal'));
  assert.equal(body.delayMinutes, 15);
});

test('US4.2 / US4.3 / US4.4 chef marks items in prep and ready; the waiter is notified', async () => {
  const fries = await menuItem(api.call, 'Fries');
  const soda = await menuItem(api.call, 'Soda');
  const { body } = await api.call('POST', '/orders', { token: waiter, body: { type: 'dine-in', items: [{ menuItemId: fries.id, qty: 1 }, { menuItemId: soda.id, qty: 1 }] } });
  const [friesLine, sodaLine] = body.order.items;
  const before = (await api.call('GET', '/notifications', { token: waiter })).body.unreadCount;

  assert.equal((await api.call('PATCH', `/orders/${body.order.id}/items/${friesLine.id}`, { token: waiter, body: { status: 'preparing' } })).status, 403);
  let r = await api.call('PATCH', `/orders/${body.order.id}/items/${friesLine.id}`, { token: chef, body: { status: 'preparing' } });
  assert.equal(r.body.order.items[0].status, 'preparing');
  r = await api.call('PATCH', `/orders/${body.order.id}/items/${sodaLine.id}`, { token: chef, body: { status: 'ready' } });
  const notes = (await api.call('GET', '/notifications', { token: waiter })).body;
  assert.equal(notes.unreadCount, before + 1);
  assert.match(notes.notifications[0].message, /Soda is ready/);

  await api.call('PATCH', `/orders/${body.order.id}/items/${friesLine.id}`, { token: chef, body: { status: 'ready' } });
  const kds = (await api.call('GET', '/orders/kitchen', { token: chef })).body;
  assert.ok(kds.ready.some((o) => o.id === body.order.id), 'appears in the ready-for-pickup list');
});

test('US4.5 orders can be rushed and moved within the queue', async () => {
  const soda = await menuItem(api.call, 'Soda');
  const a = (await api.call('POST', '/orders', { token: waiter, body: { type: 'online', items: [{ menuItemId: soda.id, qty: 1 }] } })).body.order;
  const b = (await api.call('POST', '/orders', { token: waiter, body: { type: 'online', items: [{ menuItemId: soda.id, qty: 1 }] } })).body.order;
  const position = async (id) => (await api.call('GET', '/orders/kitchen', { token: chef })).body.queue.findIndex((o) => o.id === id);

  assert.ok((await position(a.id)) < (await position(b.id)));
  await api.call('POST', `/orders/${b.id}/kitchen`, { token: chef, body: { action: 'up' } });
  assert.ok((await position(b.id)) < (await position(a.id)));

  await api.call('POST', `/orders/${a.id}/kitchen`, { token: chef, body: { action: 'rush' } });
  const queue = (await api.call('GET', '/orders/kitchen', { token: chef })).body.queue;
  assert.equal(queue.find((o) => o.id === a.id).priority, 'rush');
  assert.ok(queue.findIndex((o) => o.id === a.id) < queue.findIndex((o) => o.priority === 'normal'));
  assert.equal((await api.call('POST', `/orders/${a.id}/kitchen`, { token: waiter, body: { action: 'up' } })).status, 403);
});

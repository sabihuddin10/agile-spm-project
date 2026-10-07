/** Order lifecycle rules — lib/orders.js. */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { orders, tables, customers, inventory, menuItems, stockMovements, notifications } from '../../src/data/store.js';
import {
  isActive,
  tableNumber,
  userName,
  orderLabel,
  serializeOrder,
  syncOrderStatus,
  confirmOrder,
  closeOrder,
  cancelOrder,
  markPaid,
  markUnpaid,
  occupyTable,
  releaseTable,
  recordMovement,
  adjustStock,
  deductStock,
  kitchenQueue,
  moveInQueue,
  waiterTarget,
  notifyItemReady,
} from '../../src/lib/orders.js';

// This file tests lib/orders.js in isolation from the seeded demo data
// (60 days of history plus a handful of "live" orders/tables). Starting
// from a clean slate makes every test's expectations self-contained.
before(() => {
  orders.length = 0;
  for (const t of tables) Object.assign(t, { status: 'free', held: false, reservedFor: null, waiterId: null });
});

let seq = 0;
function makeOrder(overrides = {}) {
  seq += 1;
  return {
    id: `test_ord_${seq}`,
    number: 9000 + seq,
    type: 'dine-in',
    fulfillment: 'dine-in',
    status: 'confirmed',
    tableId: null,
    customerId: null,
    waiterId: null,
    servedBy: null,
    paymentStatus: 'unpaid',
    paymentMethod: null,
    total: 20,
    pointsUsed: 0,
    pointsEarned: 0,
    stockDeducted: false,
    priority: 'normal',
    kitchenRank: seq * 100,
    items: [],
    ...overrides,
  };
}

/* ------------------------------------------------------------- helpers */

test('isActive is true for every in-progress status and false once closed/cancelled', () => {
  // Arrange / Act / Assert
  for (const status of ['placed', 'confirmed', 'preparing', 'ready', 'served']) {
    assert.equal(isActive({ status }), true, status);
  }
  for (const status of ['closed', 'cancelled']) {
    assert.equal(isActive({ status }), false, status);
  }
});

test('tableNumber resolves a real table id and is null otherwise', () => {
  // Arrange / Act / Assert
  assert.equal(tableNumber(tables[0].id), tables[0].number);
  assert.equal(tableNumber(null), null);
  assert.equal(tableNumber('tab_does_not_exist'), null);
});

test('userName resolves a real user id and is null otherwise', () => {
  // Arrange / Act / Assert
  assert.equal(userName('usr_admin'), 'Alex Admin');
  assert.equal(userName(null), null);
  assert.equal(userName('usr_does_not_exist'), null);
});

test('orderLabel prefers the table number, falling back to the order number', () => {
  // Arrange
  const seated = makeOrder({ tableId: tables[0].id });
  const takeaway = makeOrder({ tableId: null, number: 42, fulfillment: 'pickup' });

  // Act / Assert
  assert.equal(orderLabel(seated), `Table ${tables[0].number}`);
  assert.equal(orderLabel(takeaway), 'Order #42 (pickup)');
});

test('serializeOrder adds table/staff names and the customer summary', () => {
  // Arrange
  const customer = customers[0];
  const order = makeOrder({
    tableId: tables[1].id,
    waiterId: 'usr_waiter',
    customerId: customer.id,
    items: [{ name: 'Soda', qty: 1, preparedBy: 'usr_chef' }],
  });

  // Act
  const serialized = serializeOrder(order);

  // Assert
  assert.equal(serialized.tableNumber, tables[1].number);
  assert.equal(serialized.waiterName, 'Will Waiter');
  assert.deepEqual(serialized.customer, { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone, preferences: customer.preferences });
  assert.equal(serialized.items[0].preparedByName, 'Carlos Chef');
});

/* ------------------------------------------------------------ lifecycle */

test('syncOrderStatus does nothing before an order has reached the kitchen', () => {
  // Arrange
  const order = makeOrder({ status: 'placed', items: [{ status: 'pending' }] });

  // Act
  syncOrderStatus(order);

  // Assert
  assert.equal(order.status, 'placed');
});

test('syncOrderStatus moves to preparing once any item has started', () => {
  // Arrange
  const order = makeOrder({ status: 'confirmed', items: [{ status: 'queued' }, { status: 'preparing' }] });

  // Act
  syncOrderStatus(order);

  // Assert
  assert.equal(order.status, 'preparing');
});

test('syncOrderStatus moves to ready once every item is ready and notifies the waiter', () => {
  // Arrange
  const order = makeOrder({ status: 'preparing', waiterId: 'usr_waiter', items: [{ status: 'ready' }, { status: 'ready' }] });
  const before = notifications.length;

  // Act
  syncOrderStatus(order);

  // Assert
  assert.equal(order.status, 'ready');
  assert.ok(order.readyAt);
  assert.ok(notifications.length > before);
  assert.ok(notifications.at(-1).userId === 'usr_waiter' || notifications.at(-1).role === 'waiter');
});

test('syncOrderStatus moves to served and stays served when unpaid', () => {
  // Arrange
  const order = makeOrder({ status: 'ready', paymentStatus: 'unpaid', items: [{ status: 'served' }] });

  // Act
  syncOrderStatus(order, { id: 'usr_waiter' });

  // Assert
  assert.equal(order.status, 'served');
  assert.equal(order.servedBy, 'usr_waiter');
  assert.ok(order.servedAt);
});

test('syncOrderStatus auto-closes an already-paid order once it is served', () => {
  // Arrange
  const order = makeOrder({ status: 'ready', paymentStatus: 'paid', items: [{ status: 'served' }] });

  // Act
  syncOrderStatus(order, { id: 'usr_waiter' });

  // Assert
  assert.equal(order.status, 'closed');
  assert.ok(order.closedAt);
});

test('confirmOrder queues items, assigns a waiter and occupies the table', () => {
  // Arrange
  const order = makeOrder({ status: 'placed', tableId: tables[2].id, waiterId: null, items: [{ status: 'pending' }, { status: 'pending' }] });

  // Act
  confirmOrder(order, { id: 'usr_waiter2', role: 'waiter' });

  // Assert
  assert.equal(order.status, 'confirmed');
  assert.ok(order.confirmedAt);
  assert.ok(order.kitchenRank);
  assert.equal(order.waiterId, 'usr_waiter2');
  assert.ok(order.items.every((i) => i.status === 'queued'));
  assert.equal(tables[2].status, 'occupied');
});

test('confirmOrder never overwrites an already-assigned waiter', () => {
  // Arrange
  const order = makeOrder({ status: 'placed', waiterId: 'usr_waiter', items: [] });

  // Act
  confirmOrder(order, { id: 'usr_waiter2', role: 'waiter' });

  // Assert
  assert.equal(order.waiterId, 'usr_waiter');
});

test('confirmOrder does not assign a customer actor as the waiter', () => {
  // Arrange
  const order = makeOrder({ status: 'placed', waiterId: null, items: [] });

  // Act
  confirmOrder(order, { id: 'usr_customer', role: 'customer' });

  // Assert
  assert.equal(order.waiterId, null);
});

test('closeOrder is idempotent', () => {
  // Arrange
  const order = makeOrder({ status: 'served', items: [] });
  closeOrder(order);
  const closedAt = order.closedAt;
  const movementsBefore = stockMovements.length;

  // Act — closing an already-closed order again
  closeOrder(order);

  // Assert
  assert.equal(order.status, 'closed');
  assert.equal(order.closedAt, closedAt);
  assert.equal(stockMovements.length, movementsBefore);
});

test('cancelOrder refunds unused points but leaves an unpaid order unpaid', () => {
  // Arrange
  const customer = customers[4];
  const before = customer.loyaltyPoints;
  const order = makeOrder({ customerId: customer.id, pointsUsed: 10, paymentStatus: 'unpaid' });

  // Act
  cancelOrder(order, { id: 'usr_waiter' }, 'Customer changed their mind');

  // Assert
  assert.equal(order.status, 'cancelled');
  assert.ok(order.cancelledAt);
  assert.equal(order.paymentStatus, 'unpaid');
  assert.equal(customer.loyaltyPoints, before + 10);
});

test('cancelOrder refunds a paid order and claws back the points it earned', () => {
  // Arrange
  const customer = customers[4];
  const before = customer.loyaltyPoints;
  const order = makeOrder({ customerId: customer.id, pointsEarned: 5, paymentStatus: 'paid', total: 42 });

  // Act
  cancelOrder(order, { id: 'usr_manager' }, 'Cold food');

  // Assert
  assert.equal(order.paymentStatus, 'refunded');
  assert.equal(order.refund.amount, 42);
  assert.equal(order.refund.reason, 'Cold food');
  assert.equal(customer.loyaltyPoints, before - 5);
});

test('markPaid awards points once and auto-closes a served order', () => {
  // Arrange
  const customer = customers[5];
  const before = customer.loyaltyPoints;
  const order = makeOrder({ status: 'served', customerId: customer.id, total: 30, paymentStatus: 'unpaid' });

  // Act
  markPaid(order, 'card');
  const afterFirstPay = customer.loyaltyPoints;
  markPaid(order, 'cash'); // calling it again must not double-award points

  // Assert
  assert.equal(order.paymentStatus, 'paid');
  assert.equal(order.paymentMethod, 'cash', 'a later call still updates the method');
  assert.equal(order.pointsEarned, 30);
  assert.equal(afterFirstPay, before + 30);
  assert.equal(customer.loyaltyPoints, afterFirstPay, 'points are not re-awarded on the second call');
  assert.equal(order.status, 'closed');
});

test('markUnpaid reverses the points and re-opens a closed order', () => {
  // Arrange
  const customer = customers[5];
  const order = makeOrder({ status: 'served', customerId: customer.id, total: 18, paymentStatus: 'unpaid', tableId: tables[3].id });
  markPaid(order, 'card');
  const afterPay = customer.loyaltyPoints;

  // Act
  markUnpaid(order);

  // Assert
  assert.equal(order.paymentStatus, 'unpaid');
  assert.equal(order.paidAt, null);
  assert.equal(order.pointsEarned, 0);
  assert.equal(customer.loyaltyPoints, afterPay - 18);
  assert.equal(order.status, 'served');
  assert.equal(order.closedAt, null);
  assert.equal(tables[3].status, 'occupied');
});

/* ---------------------------------------------------------------- tables */

test('occupyTable marks the table occupied and assigns a waiter only once', () => {
  // Arrange
  const table = tables[4];

  // Act
  occupyTable(table.id, 'usr_waiter');
  occupyTable(table.id, 'usr_waiter2'); // must not override the first waiter

  // Assert
  assert.equal(table.status, 'occupied');
  assert.equal(table.waiterId, 'usr_waiter');
});

test('releaseTable frees a table once no other active order needs it', () => {
  // Arrange
  const table = tables[5];
  table.status = 'occupied';
  table.waiterId = 'usr_waiter';
  const order = makeOrder({ tableId: table.id });

  // Act
  releaseTable(order);

  // Assert
  assert.equal(table.status, 'free');
  assert.equal(table.waiterId, null);
});

test('releaseTable leaves a manually held table alone', () => {
  // Arrange
  const table = tables[6];
  table.status = 'occupied';
  table.held = true;
  const order = makeOrder({ tableId: table.id });

  try {
    // Act
    releaseTable(order);

    // Assert
    assert.equal(table.status, 'occupied');
  } finally {
    table.held = false;
  }
});

test('releaseTable keeps the table occupied while another active order still needs it', () => {
  // Arrange
  const table = tables[7];
  table.status = 'occupied';
  const closing = makeOrder({ tableId: table.id, status: 'served' });
  const stillActive = makeOrder({ tableId: table.id, status: 'preparing' });
  orders.push(stillActive);

  try {
    // Act
    releaseTable(closing);

    // Assert
    assert.equal(table.status, 'occupied');
  } finally {
    orders.length = orders.indexOf(stillActive) >= 0 ? (orders.splice(orders.indexOf(stillActive), 1), orders.length) : orders.length;
  }
});

/* ------------------------------------------------------------- inventory */

test('recordMovement logs a rounded delta against the current stock', () => {
  // Arrange
  const item = inventory[0];
  const before = stockMovements.length;

  // Act
  recordMovement(item, -0.12345, 'sale', { orderId: 'ord_1', orderNumber: 1234 });

  // Assert
  const entry = stockMovements.at(-1);
  assert.equal(stockMovements.length, before + 1);
  assert.equal(entry.inventoryId, item.id);
  assert.equal(entry.delta, -0.123);
  assert.equal(entry.stockAfter, item.stock);
  assert.equal(entry.orderNumber, 1234);
});

test('recordMovement caps the log at 2000 entries, dropping the oldest first', () => {
  // Arrange
  stockMovements.length = 0;
  stockMovements.push({ id: 'sentinel', inventoryId: 'x', name: 'x', unit: 'kg', delta: 0, stockAfter: 0, reason: 'sale', at: '2000-01-01T00:00:00.000Z' });
  for (let i = 0; i < 1999; i++) {
    stockMovements.push({ id: `filler_${i}`, inventoryId: 'x', name: 'x', unit: 'kg', delta: 0, stockAfter: 0, reason: 'sale', at: '2001-01-01T00:00:00.000Z' });
  }

  // Act
  recordMovement(inventory[0], 0, 'sale');

  // Assert
  assert.equal(stockMovements.length, 2000);
  assert.ok(!stockMovements.some((m) => m.id === 'sentinel'));
});

test('adjustStock clamps at zero and never goes negative', () => {
  // Arrange
  const item = inventory[1];
  item.stock = 1;

  // Act
  adjustStock(item, -5, 'waste', {});

  // Assert
  assert.equal(item.stock, 0);
});

test('adjustStock alerts managers only when crossing the reorder level downward', () => {
  // Arrange
  const item = inventory[2];
  item.reorderLevel = 5;
  item.stock = 6;
  const before = notifications.length;

  // Act — this adjustment crosses the threshold
  adjustStock(item, -2, 'waste', {});
  const afterCross = notifications.length;

  // Act — already below the threshold, adjusting further must not re-alert
  adjustStock(item, -1, 'waste', {});

  // Assert
  assert.ok(afterCross > before, 'alert fired when crossing the threshold');
  assert.equal(notifications.length, afterCross, 'no repeat alert while already low');
});

test('deductStock removes each dish\'s recipe exactly once per order', () => {
  // Arrange
  const pizza = menuItems.find((m) => m.name === 'Margherita Pizza');
  const flour = inventory.find((i) => i.name === 'Flour');
  const before = flour.stock;
  const order = makeOrder({ items: [{ menuItemId: pizza.id, qty: 2 }], stockDeducted: false });

  // Act
  deductStock(order);
  const afterFirst = flour.stock;
  deductStock(order); // must not deduct twice

  // Assert
  assert.equal(order.stockDeducted, true);
  assert.equal(afterFirst, Math.round((before - 0.25 * 2) * 1000) / 1000);
  assert.equal(flour.stock, afterFirst);
});

/* -------------------------------------------------------------- kitchen */

test('kitchenQueue sorts rush orders first, then oldest-first by rank', () => {
  // Arrange
  orders.length = 0;
  const a = makeOrder({ status: 'confirmed', priority: 'normal', kitchenRank: 100 });
  const b = makeOrder({ status: 'preparing', priority: 'normal', kitchenRank: 200 });
  const rush = makeOrder({ status: 'confirmed', priority: 'rush', kitchenRank: 150 });
  const notInQueue = makeOrder({ status: 'placed' });
  orders.push(a, b, rush, notInQueue);

  // Act
  const queue = kitchenQueue();

  // Assert
  assert.deepEqual(queue.map((o) => o.id), [rush.id, a.id, b.id]);
});

test('moveInQueue swaps rank within the same priority band, skipping ready orders', () => {
  // Arrange
  orders.length = 0;
  const a = makeOrder({ status: 'confirmed', priority: 'normal', kitchenRank: 100 });
  const b = makeOrder({ status: 'preparing', priority: 'normal', kitchenRank: 200 });
  const readyOne = makeOrder({ status: 'ready', priority: 'normal', kitchenRank: 50 });
  orders.push(a, b, readyOne);

  // Act
  const moved = moveInQueue(b, 'up');

  // Assert
  assert.equal(moved, true);
  assert.equal(a.kitchenRank, 200);
  assert.equal(b.kitchenRank, 100);
});

test('moveInQueue returns false when there is nowhere to move', () => {
  // Arrange
  orders.length = 0;
  const onlyRush = makeOrder({ status: 'confirmed', priority: 'rush', kitchenRank: 10 });
  orders.push(onlyRush);

  // Act
  const moved = moveInQueue(onlyRush, 'up');

  // Assert
  assert.equal(moved, false);
});

/* -------------------------------------------------------- notifications */

test('waiterTarget addresses the assigned waiter, or broadcasts to the role otherwise', () => {
  // Arrange / Act / Assert
  assert.deepEqual(waiterTarget(makeOrder({ waiterId: 'usr_waiter' })), { userId: 'usr_waiter' });
  assert.deepEqual(waiterTarget(makeOrder({ waiterId: null })), { role: 'waiter' });
});

test('notifyItemReady raises a notification naming the table and the item', () => {
  // Arrange
  const order = makeOrder({ tableId: tables[0].id, waiterId: 'usr_waiter' });
  const before = notifications.length;

  // Act
  notifyItemReady(order, { name: 'Soda', qty: 2 });

  // Assert
  const entry = notifications.at(-1);
  assert.equal(notifications.length, before + 1);
  assert.equal(entry.type, 'item_ready');
  assert.equal(entry.userId, 'usr_waiter');
  assert.match(entry.message, new RegExp(`Table ${tables[0].number}.*2× Soda is ready`));
});

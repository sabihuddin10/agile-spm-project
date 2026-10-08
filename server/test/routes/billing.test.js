/** Billing module — routes/billing.js (US5.1–US5.5). */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, menuItem } from '../helpers.js';

let api;
let waiter;
let manager;
before(async () => {
  api = await startServer();
  [waiter, manager] = await Promise.all([api.login('waiter'), api.login('manager')]);
});
after(() => api.close());

/** Create a dine-in order and walk it to "served". */
async function servedOrder(lines) {
  const items = [];
  for (const [name, qty, modifiers = []] of lines) items.push({ menuItemId: (await menuItem(api.call, name)).id, qty, modifiers });
  const { body } = await api.call('POST', '/orders', { token: waiter, body: { type: 'dine-in', items } });
  const chef = await api.login('chef');
  await api.call('POST', `/orders/${body.order.id}/status`, { token: chef, body: { status: 'ready' } });
  await api.call('POST', `/orders/${body.order.id}/status`, { token: waiter, body: { status: 'served' } });
  return body.order.id;
}

test('US5.1 an itemized bill lists every line with modifier deltas', async () => {
  // Arrange
  const id = await servedOrder([['Margherita Pizza', 2, [{ group: 'Size', label: 'Large' }]], ['Soda', 1]]);

  // Act
  const { body } = await api.call('GET', `/billing/${id}`, { token: waiter });

  // Assert
  const pizzaLine = body.invoice.lines.find((l) => l.name === 'Margherita Pizza');
  assert.equal(pizzaLine.unitPrice, 22);
  assert.equal(pizzaLine.lineTotal, 44);
  assert.deepEqual(pizzaLine.modifiers.map((m) => [m.label, m.priceDelta]), [['Large', 4]]);
  assert.equal(body.invoice.subtotal, 46.5);
});

test('US5.2 tax and service charge are separate lines; a tip is added to the total', async () => {
  // Arrange
  const id = await servedOrder([['Caesar Salad', 2]]);

  // Act
  let inv = (await api.call('GET', `/billing/${id}`, { token: waiter })).body.invoice;
  // Assert
  assert.equal(inv.serviceCharge, 1.25);
  assert.equal(inv.tax, 2.5);
  assert.equal(inv.total, 28.75);

  // Act — add a tip
  inv = (await api.call('POST', `/billing/${id}/tip`, { token: waiter, body: { percent: 10 } })).body.invoice;
  // Assert
  assert.equal(inv.tip, 2.5);
  assert.equal(inv.total, 31.25);
});

test('US5.2 restaurant-configured rates apply to new bills', async () => {
  // Arrange
  await api.call('PATCH', '/settings', { token: manager, body: { taxRate: 0.2, serviceChargeRate: 0 } });

  // Act
  const id = await servedOrder([['Garlic Bread', 1]]);
  const inv = (await api.call('GET', `/billing/${id}`, { token: waiter })).body.invoice;

  // Assert
  assert.equal(inv.tax, 1.2);
  assert.equal(inv.serviceCharge, 0);

  await api.call('PATCH', '/settings', { token: manager, body: { taxRate: 0.1, serviceChargeRate: 0.05 } });
});

test('US5.3 split bills always sum to the original total and settle the bill', async () => {
  // Arrange
  const id = await servedOrder([['Beef Burger', 1], ['Vegan Bowl', 1], ['Lemonade', 3]]);
  const total = (await api.call('GET', `/billing/${id}`, { token: waiter })).body.invoice.total;

  // Act — split evenly
  const even = (await api.call('POST', `/billing/${id}/split`, { token: waiter, body: { mode: 'even', ways: 3 } })).body.invoice;
  // Assert
  assert.equal(Math.round(even.split.parts.reduce((s, p) => s + p.amount, 0) * 100), Math.round(total * 100));

  // Act — split by items
  const lines = even.lines.map((l) => l.id);
  const byItems = (await api.call('POST', `/billing/${id}/split`, { token: waiter, body: { mode: 'items', groups: [[lines[0]], [lines[1], lines[2]]] } })).body.invoice;
  // Assert
  assert.equal(Math.round(byItems.split.parts.reduce((s, p) => s + p.amount, 0) * 100), Math.round(total * 100));

  // Act — pay the first share
  await api.call('POST', `/billing/${id}/split/0/pay`, { token: waiter, body: { method: 'card' } });
  let inv = (await api.call('GET', `/billing/${id}`, { token: waiter })).body.invoice;
  // Assert
  assert.equal(inv.paymentStatus, 'unpaid');
  // A paid share locks the bill: no tip change or re-split that would erase it.
  assert.equal((await api.call('POST', `/billing/${id}/tip`, { token: waiter, body: { percent: 15 } })).status, 409);
  assert.equal((await api.call('POST', `/billing/${id}/split`, { token: waiter, body: { mode: 'even', ways: 2 } })).status, 409);

  // Act — pay the remaining share
  await api.call('POST', `/billing/${id}/split/1/pay`, { token: waiter, body: { method: 'cash' } });
  inv = (await api.call('GET', `/billing/${id}`, { token: waiter })).body.invoice;
  // Assert
  assert.equal(inv.paymentStatus, 'paid');
  assert.equal(inv.status, 'closed');
});

test('US5.4 paid bills leave the outstanding view; only a manager can mark them unpaid', async () => {
  // Arrange
  const id = await servedOrder([['Iced Tea', 2]]);
  const openIds = async () => (await api.call('GET', '/billing?scope=open', { token: waiter })).body.bills.map((b) => b.id);
  assert.ok((await openIds()).includes(id));

  // Act — pay the bill
  const paid = (await api.call('POST', `/billing/${id}/pay`, { token: waiter, body: { method: 'cash' } })).body.invoice;
  // Assert
  assert.equal(paid.paymentStatus, 'paid');
  assert.ok(!(await openIds()).includes(id));

  // Act — a waiter may not reverse a payment
  const refused = await api.call('POST', `/billing/${id}/unpay`, { token: waiter });
  // Assert
  assert.equal(refused.status, 403);
  assert.ok(!(await openIds()).includes(id), 'the bill stays paid');

  // Act — a manager marks it unpaid again
  const unpaid = (await api.call('POST', `/billing/${id}/unpay`, { token: manager })).body.invoice;
  // Assert
  assert.equal(unpaid.paymentStatus, 'unpaid');
  assert.equal(unpaid.status, 'served');
  assert.ok((await openIds()).includes(id));
});

test('US5.5 receipts for paid bills; manager refunds update status and revenue', async () => {
  // Arrange
  const id = await servedOrder([['Hummus Plate', 2]]);
  // Assert — no receipt before payment
  assert.equal((await api.call('GET', `/billing/${id}/receipt`, { token: waiter })).status, 409);

  // Act — pay and fetch the receipt
  await api.call('POST', `/billing/${id}/pay`, { token: waiter, body: { method: 'card' } });
  const receipt = (await api.call('GET', `/billing/${id}/receipt`, { token: waiter })).body.receipt;
  // Assert
  assert.equal(receipt.receiptNumber.startsWith('R-'), true);
  assert.equal(receipt.lines.length, 1);

  // Act — refund
  const revenue = async () => (await api.call('GET', '/analytics/summary', { token: manager })).body.summary.revenueToday;
  const before = await revenue();
  // Assert — only a manager can refund, and a reason is required
  assert.equal((await api.call('POST', `/billing/${id}/refund`, { token: waiter, body: { reason: 'Cold food' } })).status, 403);
  assert.equal((await api.call('POST', `/billing/${id}/refund`, { token: manager, body: { reason: '' } })).status, 400);
  const refunded = (await api.call('POST', `/billing/${id}/refund`, { token: manager, body: { reason: 'Cold food' } })).body.invoice;
  // Assert
  assert.equal(refunded.paymentStatus, 'refunded');
  assert.equal(refunded.netTotal, 0);
  assert.equal(Math.round((before - (await revenue())) * 100), Math.round(receipt.total * 100));
});

test('DELETE /billing/:id/split undoing a split restores the single-bill invoice', async () => {
  // Arrange
  const id = await servedOrder([['Beef Burger', 1], ['Soda', 2]]);
  const total = (await api.call('GET', `/billing/${id}`, { token: waiter })).body.invoice.total;
  const split = (await api.call('POST', `/billing/${id}/split`, { token: waiter, body: { mode: 'even', ways: 2 } })).body.invoice;
  assert.equal(split.split.parts.length, 2);

  // Act
  const res = await api.call('DELETE', `/billing/${id}/split`, { token: waiter });

  // Assert
  assert.equal(res.status, 200);
  assert.equal(res.body.invoice.split, null);
  assert.equal(res.body.invoice.total, total);
  assert.equal(res.body.invoice.paymentStatus, 'unpaid');
  assert.equal((await api.call('GET', `/billing/${id}`, { token: waiter })).body.invoice.split, null);
});

test('DELETE /billing/:id/split is refused with 409 once a share is paid', async () => {
  // Arrange
  const id = await servedOrder([['Vegan Bowl', 1], ['Lemonade', 1]]);
  await api.call('POST', `/billing/${id}/split`, { token: waiter, body: { mode: 'even', ways: 2 } });
  await api.call('POST', `/billing/${id}/split/0/pay`, { token: waiter, body: { method: 'card' } });

  // Act
  const res = await api.call('DELETE', `/billing/${id}/split`, { token: waiter });

  // Assert
  assert.equal(res.status, 409);
  const inv = (await api.call('GET', `/billing/${id}`, { token: waiter })).body.invoice;
  assert.equal(inv.split.parts.length, 2, 'the split is kept');
  assert.equal(inv.split.parts[0].paid, true);
});

test('DELETE /billing/:id/split is refused with 409 once the bill is paid', async () => {
  // Arrange
  const id = await servedOrder([['Garlic Bread', 2]]);
  await api.call('POST', `/billing/${id}/split`, { token: waiter, body: { mode: 'even', ways: 2 } });
  await api.call('POST', `/billing/${id}/split/0/pay`, { token: waiter, body: { method: 'card' } });
  await api.call('POST', `/billing/${id}/split/1/pay`, { token: waiter, body: { method: 'cash' } });
  assert.equal((await api.call('GET', `/billing/${id}`, { token: waiter })).body.invoice.paymentStatus, 'paid');

  // Act
  const res = await api.call('DELETE', `/billing/${id}/split`, { token: waiter });

  // Assert
  assert.equal(res.status, 409);
  assert.ok((await api.call('GET', `/billing/${id}`, { token: waiter })).body.invoice.split, 'the split is kept');
});

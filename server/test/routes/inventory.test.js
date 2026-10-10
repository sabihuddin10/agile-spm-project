/** Inventory module — routes/inventory.js (US8.1–US8.5). */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, menuItem } from '../helpers.js';

let api;
let manager;
let chef;
let waiter;
before(async () => {
  api = await startServer();
  [manager, chef, waiter] = await Promise.all([api.login('manager'), api.login('chef'), api.login('waiter')]);
});
after(() => api.close());

const stockOf = async (name) => (await api.call('GET', '/inventory', { token: manager })).body.inventory.find((i) => i.name === name);

test('US8.1 managers add, edit and remove ingredients; chefs can only adjust stock', async () => {
  // Act
  const created = await api.call('POST', '/inventory', { token: manager, body: { name: 'Basil', category: 'Produce', unit: 'kg', stock: 2, reorderLevel: 1, costPerUnit: 12 } });
  // Assert
  assert.equal(created.status, 201);

  // Act
  const edited = await api.call('PATCH', `/inventory/${created.body.item.id}`, { token: manager, body: { reorderLevel: 1.5, supplier: 'Herb Co.' } });
  // Assert
  assert.equal(edited.body.item.supplier, 'Herb Co.');

  // Act / Assert — a chef cannot edit reorder level
  assert.equal((await api.call('PATCH', `/inventory/${created.body.item.id}`, { token: chef, body: { reorderLevel: 9 } })).status, 403);

  // Act — a chef can adjust the stock quantity
  const adjusted = await api.call('PATCH', `/inventory/${created.body.item.id}`, { token: chef, body: { delta: -0.5 } });
  // Assert
  assert.equal(adjusted.body.item.stock, 1.5);

  // Act / Assert — remove it, and waiters cannot see inventory
  assert.equal((await api.call('DELETE', `/inventory/${created.body.item.id}`, { token: manager })).status, 200);
  assert.equal((await api.call('GET', '/inventory', { token: waiter })).status, 403);
});

test('US8.2 a dish recipe (bill of materials) is saved and validated', async () => {
  // Arrange
  const bread = await menuItem(api.call, 'Garlic Bread');
  const flour = await stockOf('Flour');
  const oil = await stockOf('Olive Oil');

  // Act / Assert — a zero quantity is rejected
  assert.equal((await api.call('PUT', `/menu/items/${bread.id}/recipe`, { token: manager, body: { recipe: [{ inventoryId: flour.id, qty: 0 }] } })).status, 400);

  // Act — save a valid recipe
  const saved = await api.call('PUT', `/menu/items/${bread.id}/recipe`, { token: manager, body: { recipe: [{ inventoryId: flour.id, qty: 0.2 }, { inventoryId: oil.id, qty: 0.05 }] } });
  // Assert
  assert.deepEqual(saved.body.item.recipe.map((r) => [r.name, r.qty]), [['Flour', 0.2], ['Olive Oil', 0.05]]);

  // Act / Assert — chefs cannot edit recipes; an ingredient used in a recipe cannot be deleted
  assert.equal((await api.call('PUT', `/menu/items/${bread.id}/recipe`, { token: chef, body: { recipe: [] } })).status, 403);
  assert.equal((await api.call('DELETE', `/inventory/${flour.id}`, { token: manager })).status, 409, 'used in recipes');
});

test('US8.3 closing an order deducts each recipe from stock exactly once', async () => {
  // Arrange
  const bread = await menuItem(api.call, 'Garlic Bread');
  const before = (await stockOf('Flour')).stock;
  const { body } = await api.call('POST', '/orders', { token: waiter, body: { type: 'dine-in', items: [{ menuItemId: bread.id, qty: 3 }] } });

  // Act — move the order through to served, but not yet paid
  await api.call('POST', `/orders/${body.order.id}/status`, { token: chef, body: { status: 'ready' } });
  await api.call('POST', `/orders/${body.order.id}/status`, { token: waiter, body: { status: 'served' } });
  // Assert
  assert.equal((await stockOf('Flour')).stock, before, 'not deducted until the order closes');

  // Act — pay (closes the order)
  await api.call('POST', `/billing/${body.order.id}/pay`, { token: waiter, body: { method: 'card' } });
  // Assert
  assert.equal((await stockOf('Flour')).stock, Math.round((before - 0.6) * 1000) / 1000);

  // Act — unpay then pay again
  await api.call('POST', `/billing/${body.order.id}/unpay`, { token: waiter });
  await api.call('POST', `/billing/${body.order.id}/pay`, { token: waiter, body: { method: 'card' } });
  // Assert — no double deduction
  assert.equal((await stockOf('Flour')).stock, Math.round((before - 0.6) * 1000) / 1000, 'no double deduction');

  const moves = (await api.call('GET', '/inventory/movements?limit=10', { token: manager })).body.movements;
  assert.ok(moves.some((m) => m.reason === 'sale' && m.orderNumber === body.order.number && m.name === 'Flour'));
});

test('US8.4 crossing the reorder level raises a low-stock alert for managers', async () => {
  // Arrange
  const lemons = await stockOf('Lemons');
  const target = lemons.stock - lemons.reorderLevel;

  // Act — deplete stock down to the reorder level
  await api.call('PATCH', `/inventory/${lemons.id}`, { token: chef, body: { delta: -target } });

  // Assert
  assert.equal((await stockOf('Lemons')).lowStock, true);
  const notes = (await api.call('GET', '/notifications', { token: manager })).body.notifications;
  assert.match(notes[0].message, /Lemons is at or below its reorder level/);
  assert.ok((await api.call('GET', '/analytics/summary', { token: manager })).body.summary.lowStock >= 1);
});

test('US8.5 the reorder form suggests quantities and receiving restocks', async () => {
  // Act
  const { body } = await api.call('GET', '/inventory/reorder', { token: manager });

  // Assert
  assert.ok(body.lines.length > 0);
  const moz = body.lines.find((l) => l.name === 'Mozzarella');
  assert.equal(moz.suggestedQty, 11, 'back up to twice the reorder level');
  assert.equal(moz.supplier, 'Alpine Dairy Co.');

  // Act — raise and receive a purchase order
  const before = (await stockOf('Mozzarella')).stock;
  const po = await api.call('POST', '/inventory/purchase-orders', { token: manager, body: { lines: [{ inventoryId: moz.inventoryId, qty: moz.suggestedQty }] } });
  // Assert
  assert.equal(po.body.purchaseOrder.status, 'sent');

  // Act
  await api.call('POST', `/inventory/purchase-orders/${po.body.purchaseOrder.id}/receive`, { token: manager });
  // Assert
  assert.equal((await stockOf('Mozzarella')).stock, before + 11);
  assert.equal((await api.call('GET', '/inventory/reorder', { token: chef })).status, 403);
});

test('/inventory/purchase-orders is manager-only and lists the newest order first', async () => {
  // Arrange
  const basil = (await api.call('POST', '/inventory', { token: manager, body: { name: 'Thai Basil', category: 'Produce', unit: 'kg', stock: 1, reorderLevel: 1, costPerUnit: 10 } })).body.item;
  const first = (await api.call('POST', '/inventory/purchase-orders', { token: manager, body: { lines: [{ inventoryId: basil.id, qty: 2 }] } })).body.purchaseOrder;
  const second = (await api.call('POST', '/inventory/purchase-orders', { token: manager, body: { lines: [{ inventoryId: basil.id, qty: 3 }], notes: 'Rush' } })).body.purchaseOrder;

  // Act
  const list = await api.call('GET', '/inventory/purchase-orders', { token: manager });
  const forbidden = await api.call('GET', '/inventory/purchase-orders', { token: waiter });

  // Assert
  assert.equal(list.status, 200);
  assert.equal(forbidden.status, 403);
  const ids = list.body.purchaseOrders.map((p) => p.id);
  assert.deepEqual(ids.slice(0, 2), [second.id, first.id], 'the just-raised order comes first');
  const top = list.body.purchaseOrders[0];
  assert.deepEqual([top.status, top.total, top.notes, top.lines[0].name], ['sent', 30, 'Rush', 'Thai Basil']);
});

test('ingredient amounts must be finite numbers and text fields short strings', async () => {
  // Arrange
  const token = await api.login('manager');
  const { body } = await api.call('GET', '/inventory', { token });
  const item = body.inventory[0];

  // Act
  const infiniteStock = await api.call('POST', '/inventory', { token, body: { name: 'Infinite Flour', stock: 'Infinity' } });
  const hugeCost = await api.call('POST', '/inventory', { token, body: { name: 'Gold Leaf', costPerUnit: 1e12 } });
  const objectName = await api.call('POST', '/inventory', { token, body: { name: { $gt: '' } } });
  const longSupplier = await api.call('PATCH', `/inventory/${item.id}`, { token, body: { supplier: 's'.repeat(121) } });
  const infiniteDelta = await api.call('PATCH', `/inventory/${item.id}`, { token, body: { delta: '1e400' } });
  const longNotes = await api.call('POST', '/inventory/purchase-orders', { token, body: { lines: [{ inventoryId: item.id, qty: 1 }], notes: 'n'.repeat(1001) } });
  const after = (await api.call('GET', '/inventory', { token })).body.inventory.find((i) => i.id === item.id);

  // Assert
  for (const res of [infiniteStock, hugeCost, objectName, longSupplier, infiniteDelta, longNotes]) assert.equal(res.status, 400);
  assert.equal(after.stock, item.stock);
  assert.equal(after.supplier, item.supplier);
});

test('a cleared supplier or category is stored empty, never as the text "null"', async () => {
  // Arrange
  const created = await api.call('POST', '/inventory', { token: manager, body: { name: 'Null Check Salt', category: null, supplier: null, unit: 'kg', stock: 1, reorderLevel: 0, costPerUnit: 1 } });

  // Act
  const edited = await api.call('PATCH', `/inventory/${created.body.item.id}`, { token: manager, body: { supplier: null, category: null } });

  // Assert
  assert.equal(created.status, 201);
  assert.equal(created.body.item.supplier, '');
  assert.equal(created.body.item.category, 'Dry Goods');
  assert.equal(edited.body.item.supplier, '');
  assert.equal(edited.body.item.category, 'Dry Goods', 'a cleared category keeps the current one');
});

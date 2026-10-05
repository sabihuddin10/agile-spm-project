/** Sprint 2 — Menu Management (US2.1–US2.5). */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, menuItem } from './helpers.js';

let api;
before(async () => {
  api = await startServer();
});
after(() => api.close());

test('US2.1 a manager adds, edits and removes an item and it shows on the live menu', async () => {
  const token = await api.login('manager');
  const cats = (await api.call('GET', '/menu/categories')).body.categories;
  const created = await api.call('POST', '/menu/items', { token, body: { name: 'Tiramisu', categoryId: cats.find((c) => c.name === 'Desserts').id, price: 8, description: 'Classic.' } });
  assert.equal(created.status, 201);
  assert.ok(await menuItem(api.call, 'Tiramisu'));

  await api.call('PATCH', `/menu/items/${created.body.item.id}`, { token, body: { price: 9.5 } });
  assert.equal((await menuItem(api.call, 'Tiramisu')).price, 9.5);

  await api.call('DELETE', `/menu/items/${created.body.item.id}`, { token });
  assert.equal(await menuItem(api.call, 'Tiramisu'), undefined);
});

test('US2.2 empty or inactive categories are hidden from customers', async () => {
  const token = await api.login('manager');
  const created = await api.call('POST', '/menu/categories', { token, body: { name: 'Specials' } });
  const publicNames = (await api.call('GET', '/menu')).body.menu.map((c) => c.name);
  assert.ok(!publicNames.includes('Specials'));
  const manageNames = (await api.call('GET', '/menu?scope=manage', { token })).body.menu.map((c) => c.name);
  assert.ok(manageNames.includes('Specials'));
  await api.call('DELETE', `/menu/categories/${created.body.category.id}`, { token });
});

test('US2.3 modifier groups with price deltas are saved and priced at order time', async () => {
  const manager = await api.login('manager');
  const burger = await menuItem(api.call, 'Beef Burger');
  const res = await api.call('PATCH', `/menu/items/${burger.id}`, {
    token: manager,
    body: { modifiers: [...burger.modifiers, { name: 'Side', type: 'single', options: ['Fries', 'Salad +2'] }] },
  });
  assert.deepEqual(res.body.item.modifiers.at(-1).options, [{ label: 'Fries', priceDelta: 0 }, { label: 'Salad', priceDelta: 2 }]);

  const customer = await api.login('customer');
  const order = await api.call('POST', '/orders', {
    token: customer,
    body: { type: 'online', paymentMethod: 'cash', items: [{ menuItemId: burger.id, qty: 2, modifiers: [{ group: 'Extras', label: 'Bacon' }, { group: 'Side', label: 'Salad' }] }] },
  });
  assert.equal(order.status, 201);
  assert.equal(order.body.order.items[0].unitPrice, 16 + 2 + 2);
  assert.equal(order.body.order.subtotal, 40);
});

test('US2.4 dietary and allergen tags are public', async () => {
  const satay = await menuItem(api.call, 'Peanut Satay Skewers');
  assert.ok(satay.allergens.includes('peanuts'));
  assert.equal(satay.recipe, undefined, 'recipes are internal');
});

test('US2.5 unavailable items cannot be ordered; chefs may only toggle availability', async () => {
  const chef = await api.login('chef');
  const fries = await menuItem(api.call, 'Fries');
  assert.equal((await api.call('PATCH', `/menu/items/${fries.id}`, { token: chef, body: { price: 1 } })).status, 403);
  const off = await api.call('PATCH', `/menu/items/${fries.id}`, { token: chef, body: { available: false, outOfStockReason: 'Fryer down' } });
  assert.equal(off.body.item.available, false);

  const customer = await api.login('customer');
  const blocked = await api.call('POST', '/orders', { token: customer, body: { type: 'online', items: [{ menuItemId: fries.id, qty: 1 }] } });
  assert.equal(blocked.status, 409);
  assert.match(blocked.body.error, /unavailable/);

  await api.call('PATCH', `/menu/items/${fries.id}`, { token: chef, body: { available: true } });
  const ok = await api.call('POST', '/orders', { token: customer, body: { type: 'online', paymentMethod: 'cash', items: [{ menuItemId: fries.id, qty: 1 }] } });
  assert.equal(ok.status, 201);
});

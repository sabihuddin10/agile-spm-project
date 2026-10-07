/** Menu module — routes/menu.js (US2.1–US2.5). */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, menuItem } from '../helpers.js';

let api;
before(async () => {
  api = await startServer();
});
after(() => api.close());

test('US2.1 a manager adds, edits and removes an item and it shows on the live menu', async () => {
  // Arrange
  const token = await api.login('manager');
  const cats = (await api.call('GET', '/menu/categories')).body.categories;

  // Act
  const created = await api.call('POST', '/menu/items', { token, body: { name: 'Tiramisu', categoryId: cats.find((c) => c.name === 'Desserts').id, price: 8, description: 'Classic.' } });

  // Assert
  assert.equal(created.status, 201);
  assert.ok(await menuItem(api.call, 'Tiramisu'));

  // Act — edit the price
  await api.call('PATCH', `/menu/items/${created.body.item.id}`, { token, body: { price: 9.5 } });
  // Assert
  assert.equal((await menuItem(api.call, 'Tiramisu')).price, 9.5);

  // Act — remove the item
  await api.call('DELETE', `/menu/items/${created.body.item.id}`, { token });
  // Assert
  assert.equal(await menuItem(api.call, 'Tiramisu'), undefined);
});

test('US2.2 empty or inactive categories are hidden from customers', async () => {
  // Arrange
  const token = await api.login('manager');
  const created = await api.call('POST', '/menu/categories', { token, body: { name: 'Specials' } });

  // Act
  const publicNames = (await api.call('GET', '/menu')).body.menu.map((c) => c.name);
  const manageNames = (await api.call('GET', '/menu?scope=manage', { token })).body.menu.map((c) => c.name);

  // Assert
  assert.ok(!publicNames.includes('Specials'));
  assert.ok(manageNames.includes('Specials'));

  await api.call('DELETE', `/menu/categories/${created.body.category.id}`, { token });
});

test('US2.3 modifier groups with price deltas are saved and priced at order time', async () => {
  // Arrange
  const manager = await api.login('manager');
  const burger = await menuItem(api.call, 'Beef Burger');

  // Act — add a priced modifier group
  const res = await api.call('PATCH', `/menu/items/${burger.id}`, {
    token: manager,
    body: { modifiers: [...burger.modifiers, { name: 'Side', type: 'single', options: ['Fries', 'Salad +2'] }] },
  });

  // Assert
  assert.deepEqual(res.body.item.modifiers.at(-1).options, [{ label: 'Fries', priceDelta: 0 }, { label: 'Salad', priceDelta: 2 }]);

  // Act — order with the new modifiers selected
  const customer = await api.login('customer');
  const order = await api.call('POST', '/orders', {
    token: customer,
    body: { type: 'online', paymentMethod: 'cash', items: [{ menuItemId: burger.id, qty: 2, modifiers: [{ group: 'Extras', label: 'Bacon' }, { group: 'Side', label: 'Salad' }] }] },
  });

  // Assert
  assert.equal(order.status, 201);
  assert.equal(order.body.order.items[0].unitPrice, 16 + 2 + 2);
  assert.equal(order.body.order.subtotal, 40);
});

test('US2.4 dietary and allergen tags are public', async () => {
  // Arrange / Act
  const satay = await menuItem(api.call, 'Peanut Satay Skewers');

  // Assert
  assert.ok(satay.allergens.includes('peanuts'));
  assert.equal(satay.recipe, undefined, 'recipes are internal');
});

test('US2.5 unavailable items cannot be ordered; chefs may only toggle availability', async () => {
  // Arrange
  const chef = await api.login('chef');
  const fries = await menuItem(api.call, 'Fries');

  // Act / Assert — chefs cannot change price
  assert.equal((await api.call('PATCH', `/menu/items/${fries.id}`, { token: chef, body: { price: 1 } })).status, 403);

  // Act — chef marks the item unavailable
  const off = await api.call('PATCH', `/menu/items/${fries.id}`, { token: chef, body: { available: false, outOfStockReason: 'Fryer down' } });
  // Assert
  assert.equal(off.body.item.available, false);

  // Act — a customer tries to order the unavailable item
  const customer = await api.login('customer');
  const blocked = await api.call('POST', '/orders', { token: customer, body: { type: 'online', items: [{ menuItemId: fries.id, qty: 1 }] } });
  // Assert
  assert.equal(blocked.status, 409);
  assert.match(blocked.body.error, /unavailable/);

  // Act — restore availability and order again
  await api.call('PATCH', `/menu/items/${fries.id}`, { token: chef, body: { available: true } });
  const ok = await api.call('POST', '/orders', { token: customer, body: { type: 'online', paymentMethod: 'cash', items: [{ menuItemId: fries.id, qty: 1 }] } });
  // Assert
  assert.equal(ok.status, 201);
});

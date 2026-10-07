/** Customers module — routes/customers.js (US1.2–US1.5). */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from '../helpers.js';

let api;
before(async () => {
  api = await startServer();
});
after(() => api.close());

test('US1.2 profile edits persist; duplicate emails are refused', async () => {
  // Arrange
  const token = await api.login('customer');

  // Act
  const updated = await api.call('PATCH', '/customers/me', { token, body: { phone: '+1 555-7777', notes: 'Booth please' } });

  // Assert
  assert.equal(updated.body.customer.phone, '+1 555-7777');
  assert.equal((await api.call('GET', '/customers/me', { token })).body.customer.notes, 'Booth please');

  // Act / Assert — email must stay unique
  const clash = await api.call('PATCH', '/customers/me', { token, body: { email: 'admin@rest.test' } });
  assert.equal(clash.status, 409);
});

test('US1.3 the ledger can be searched and filtered', async () => {
  // Arrange
  const token = await api.login('waiter');

  // Act / Assert — by name
  const byName = await api.call('GET', '/customers?q=sofia', { token });
  assert.deepEqual(byName.body.customers.map((c) => c.name), ['Sofia Ramirez']);

  // Act / Assert — by phone
  const byPhone = await api.call('GET', '/customers?q=555-0102', { token });
  assert.equal(byPhone.body.customers[0].name, 'Liam Nguyen');

  // Act / Assert — by type
  const online = await api.call('GET', '/customers?type=online', { token });
  assert.ok(online.body.customers.every((c) => c.type === 'online'));

  // Act / Assert — no matches
  const none = await api.call('GET', '/customers?q=zzzz', { token });
  assert.deepEqual(none.body.customers, []);
});

test('US1.4 order history is listed newest first with totals', async () => {
  // Arrange
  const token = await api.login('manager');

  // Act
  const { body } = await api.call('GET', '/customers/cus_1', { token });

  // Assert
  const dates = body.customer.orderHistory.map((h) => h.createdAt);
  assert.ok(dates.length > 0);
  assert.deepEqual(dates, [...dates].sort().reverse());
  assert.ok(body.customer.totalSpend > 0);

  // Act / Assert — a brand-new customer has an empty history
  const fresh = await api.call('POST', '/customers', { token, body: { name: 'No Orders Yet' } });
  assert.deepEqual(fresh.body.customer.orderHistory, []);
});

test('US1.5 allergies travel with active orders for waiter and chef', async () => {
  // Arrange / Act / Assert
  for (const role of ['waiter', 'chef']) {
    const token = await api.login(role);
    const { body } = await api.call('GET', '/orders/kitchen', { token });
    const emmaOrder = [...body.queue, ...body.ready].find((o) => o.customer?.name === 'Emma Thompson');
    assert.deepEqual(emmaOrder.customer.preferences.allergies, ['peanuts']);
  }
});

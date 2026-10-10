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

test('DELETE /customers/:id a manager removes a customer from the ledger; a waiter may not', async () => {
  // Arrange
  const [waiter, token] = await Promise.all([api.login('waiter'), api.login('manager')]);
  const created = await api.call('POST', '/customers', { token: waiter, body: { name: 'Delete Me Walkin' } });
  const id = created.body.customer.id;

  // Act
  const refused = await api.call('DELETE', `/customers/${id}`, { token: waiter });
  const res = await api.call('DELETE', `/customers/${id}`, { token });

  // Assert
  assert.equal(refused.status, 403);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { deleted: true, id });
  assert.equal((await api.call('GET', `/customers/${id}`, { token })).status, 404);
  const list = await api.call('GET', `/customers?q=${encodeURIComponent('Delete Me Walkin')}`, { token });
  assert.deepEqual(list.body.customers, []);
});

test('DELETE /customers/:id returns 404 for an unknown customer', async () => {
  // Arrange
  const token = await api.login('manager');

  // Act
  const res = await api.call('DELETE', '/customers/cus_does_not_exist', { token });

  // Assert
  assert.equal(res.status, 404);
  assert.equal(res.body.error, 'Customer not found.');
});

test('DELETE /customers/:id is refused for a customer', async () => {
  // Arrange
  const manager = await api.login('manager');
  const created = await api.call('POST', '/customers', { token: manager, body: { name: 'Keep Me Walkin' } });
  const id = created.body.customer.id;
  const customer = await api.login('customer');

  // Act
  const res = await api.call('DELETE', `/customers/${id}`, { token: customer });

  // Assert
  assert.equal(res.status, 403);
  assert.equal((await api.call('GET', `/customers/${id}`, { token: manager })).status, 200, 'the customer is still on the ledger');
});

test('DELETE /customers/:id refuses a customer with order history, keeping their orders linked', async () => {
  // Arrange — Emma Thompson has seeded orders
  const manager = await api.login('manager');
  const emma = (await api.call('GET', `/customers?q=${encodeURIComponent('Emma Thompson')}`, { token: manager })).body.customers[0];

  // Act
  const res = await api.call('DELETE', `/customers/${emma.id}`, { token: manager });

  // Assert
  assert.equal(res.status, 409);
  assert.match(res.body.error, /order history/);
  assert.equal((await api.call('GET', `/customers/${emma.id}`, { token: manager })).status, 200);
});

test('customer records are type-checked, and null preferences no longer crash the request', async () => {
  // Arrange
  const token = await api.login('waiter');
  const create = (extra) => api.call('POST', '/customers', { token, body: { name: 'Type Check', ...extra } });

  // Act
  const nullPrefs = await create({ preferences: null });
  const badEmail = await create({ email: 'nope' });
  const badPhone = await create({ phone: 'abc' });
  const longNotes = await create({ notes: 'x'.repeat(501) });
  const objectName = await create({ name: { first: 'A' } });
  const objectTags = await create({ preferences: { dietary: [{ a: 1 }] } });
  const badType = await create({ type: 'vip' });

  // Assert
  assert.equal(nullPrefs.status, 201);
  for (const res of [badEmail, badPhone, longNotes, objectName, objectTags, badType]) assert.equal(res.status, 400);
});

test('loyalty points, id and account link cannot be set through the body', async () => {
  // Arrange
  const waiter = await api.login('waiter');
  const customer = await api.login('customer');
  const before = (await api.call('GET', '/customers/me', { token: customer })).body.customer;

  // Act
  const created = await api.call('POST', '/customers', { token: waiter, body: { name: 'Mass Assign', loyaltyPoints: 99999, id: 'cus_hijack', userId: 'usr_admin' } });
  const self = await api.call('PATCH', '/customers/me', { token: customer, body: { loyaltyPoints: 99999, userId: 'usr_admin', id: 'cus_hijack' } });

  // Assert
  assert.equal(created.status, 201);
  assert.equal(created.body.customer.loyaltyPoints, 0);
  assert.notEqual(created.body.customer.id, 'cus_hijack');
  assert.equal(created.body.customer.userId, null);
  assert.equal(self.status, 200);
  assert.equal(self.body.customer.loyaltyPoints, before.loyaltyPoints);
  assert.equal(self.body.customer.id, before.id);
  assert.equal(self.body.customer.userId, before.userId);
});

test('a rejected self-service edit changes nothing', async () => {
  // Arrange
  const token = await api.login('customer');
  const before = (await api.call('GET', '/customers/me', { token })).body.customer;

  // Act
  const res = await api.call('PATCH', '/customers/me', { token, body: { name: 'Changed Name', phone: 'not a phone' } });
  const after = (await api.call('GET', '/customers/me', { token })).body.customer;

  // Assert
  assert.equal(res.status, 400);
  assert.equal(after.name, before.name);
});

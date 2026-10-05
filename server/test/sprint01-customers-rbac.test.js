/** Sprint 1 — Customer Management + Core Setup (US1.1–US1.5). */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './helpers.js';

let api;
before(async () => {
  api = await startServer();
});
after(() => api.close());

test('US1.1 each role reaches exactly its permitted endpoints', async () => {
  const expected = {
    waiter: { '/customers': 200, '/orders': 200, '/tables': 200, '/billing': 200, '/reservations': 200, '/inventory': 403, '/analytics/summary': 403, '/staff/roster': 403 },
    chef: { '/customers': 403, '/orders/kitchen': 200, '/inventory': 200, '/billing': 403, '/tables': 403, '/analytics/summary': 403 },
    manager: { '/customers': 200, '/inventory': 200, '/analytics/summary': 200, '/staff/roster': 200, '/auth/users': 200 },
    customer: { '/customers': 403, '/orders': 403, '/billing': 403, '/notifications': 200, '/customers/me': 200 },
  };
  for (const [role, paths] of Object.entries(expected)) {
    const token = await api.login(role);
    for (const [path, status] of Object.entries(paths)) {
      const res = await api.call('GET', path, { token });
      assert.equal(res.status, status, `${role} GET ${path}`);
    }
  }
  assert.equal((await api.call('GET', '/orders')).status, 401);
});

test('US1.1 only an admin can change roles, and not their own', async () => {
  const admin = await api.login('admin');
  const manager = await api.login('manager');
  assert.equal((await api.call('PATCH', '/auth/users/usr_waiter2', { token: manager, body: { role: 'chef' } })).status, 403);
  const changed = await api.call('PATCH', '/auth/users/usr_waiter2', { token: admin, body: { role: 'chef' } });
  assert.equal(changed.body.user.role, 'chef');
  assert.equal((await api.call('PATCH', '/auth/users/usr_admin', { token: admin, body: { role: 'waiter' } })).status, 400);
  await api.call('PATCH', '/auth/users/usr_waiter2', { token: admin, body: { role: 'waiter' } });
});

test('US1.2 registration validates input and creates a logged-in customer', async () => {
  const bad = await api.call('POST', '/auth/register', { body: { name: 'A', email: 'not-an-email', password: 'secret1' } });
  assert.equal(bad.status, 400);
  const short = await api.call('POST', '/auth/register', { body: { name: 'A', email: 'a@b.co', password: '123' } });
  assert.equal(short.status, 400);

  const ok = await api.call('POST', '/auth/register', { body: { name: 'Nina New', email: 'nina@example.com', password: 'secret1' } });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.user.role, 'customer');
  const me = await api.call('GET', '/customers/me', { token: ok.body.token });
  assert.equal(me.body.customer.name, 'Nina New');

  const dup = await api.call('POST', '/auth/register', { body: { name: 'Nina', email: 'NINA@example.com', password: 'secret1' } });
  assert.equal(dup.status, 409);
});

test('US1.2 profile edits persist; duplicate emails are refused', async () => {
  const token = await api.login('customer');
  const updated = await api.call('PATCH', '/customers/me', { token, body: { phone: '+1 555-7777', notes: 'Booth please' } });
  assert.equal(updated.body.customer.phone, '+1 555-7777');
  assert.equal((await api.call('GET', '/customers/me', { token })).body.customer.notes, 'Booth please');
  const clash = await api.call('PATCH', '/customers/me', { token, body: { email: 'admin@rest.test' } });
  assert.equal(clash.status, 409);
});

test('US1.3 the ledger can be searched and filtered', async () => {
  const token = await api.login('waiter');
  const byName = await api.call('GET', '/customers?q=sofia', { token });
  assert.deepEqual(byName.body.customers.map((c) => c.name), ['Sofia Ramirez']);
  const byPhone = await api.call('GET', '/customers?q=555-0102', { token });
  assert.equal(byPhone.body.customers[0].name, 'Liam Nguyen');
  const online = await api.call('GET', '/customers?type=online', { token });
  assert.ok(online.body.customers.every((c) => c.type === 'online'));
  const none = await api.call('GET', '/customers?q=zzzz', { token });
  assert.deepEqual(none.body.customers, []);
});

test('US1.4 order history is listed newest first with totals', async () => {
  const token = await api.login('manager');
  const { body } = await api.call('GET', '/customers/cus_1', { token });
  const dates = body.customer.orderHistory.map((h) => h.createdAt);
  assert.ok(dates.length > 0);
  assert.deepEqual(dates, [...dates].sort().reverse());
  assert.ok(body.customer.totalSpend > 0);

  const fresh = await api.call('POST', '/customers', { token, body: { name: 'No Orders Yet' } });
  assert.deepEqual(fresh.body.customer.orderHistory, []);
});

test('US1.5 allergies travel with active orders for waiter and chef', async () => {
  for (const role of ['waiter', 'chef']) {
    const token = await api.login(role);
    const { body } = await api.call('GET', '/orders/kitchen', { token });
    const emmaOrder = [...body.queue, ...body.ready].find((o) => o.customer?.name === 'Emma Thompson');
    assert.deepEqual(emmaOrder.customer.preferences.allergies, ['peanuts']);
  }
});

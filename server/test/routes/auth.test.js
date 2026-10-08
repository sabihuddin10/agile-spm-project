/** Auth & access-control module — routes/auth.js (US1.1). */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from '../helpers.js';

let api;
before(async () => {
  api = await startServer();
});
after(() => api.close());

test('US1.1 each role reaches exactly its permitted endpoints', async () => {
  // Arrange
  const expected = {
    waiter: { '/customers': 200, '/orders': 200, '/tables': 200, '/billing': 200, '/reservations': 200, '/inventory': 403, '/analytics/summary': 403, '/staff/roster': 403 },
    chef: { '/customers': 403, '/orders/kitchen': 200, '/inventory': 200, '/billing': 403, '/tables': 403, '/analytics/summary': 403 },
    manager: { '/customers': 200, '/inventory': 200, '/analytics/summary': 200, '/staff/roster': 200, '/auth/users': 200 },
    customer: { '/customers': 403, '/orders': 403, '/billing': 403, '/notifications': 200, '/customers/me': 200 },
  };

  // Act / Assert
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
  // Arrange
  const admin = await api.login('admin');
  const manager = await api.login('manager');

  // Act / Assert — a manager cannot change roles
  assert.equal((await api.call('PATCH', '/auth/users/usr_waiter2', { token: manager, body: { role: 'chef' } })).status, 403);

  // Act — an admin can
  const changed = await api.call('PATCH', '/auth/users/usr_waiter2', { token: admin, body: { role: 'chef' } });
  // Assert
  assert.equal(changed.body.user.role, 'chef');

  // Act / Assert — an admin cannot change their own role
  assert.equal((await api.call('PATCH', '/auth/users/usr_admin', { token: admin, body: { role: 'waiter' } })).status, 400);

  await api.call('PATCH', '/auth/users/usr_waiter2', { token: admin, body: { role: 'waiter' } });
});

test('US1.2 registration validates input and creates a logged-in customer', async () => {
  // Act / Assert — invalid input is rejected
  const bad = await api.call('POST', '/auth/register', { body: { name: 'A', email: 'not-an-email', password: 'secret1' } });
  assert.equal(bad.status, 400);
  const short = await api.call('POST', '/auth/register', { body: { name: 'A', email: 'a@b.co', password: '123' } });
  assert.equal(short.status, 400);

  // Act — valid registration
  const ok = await api.call('POST', '/auth/register', { body: { name: 'Nina New', email: 'nina@example.com', password: 'secret1' } });
  // Assert
  assert.equal(ok.status, 201);
  assert.equal(ok.body.user.role, 'customer');
  const me = await api.call('GET', '/customers/me', { token: ok.body.token });
  assert.equal(me.body.customer.name, 'Nina New');

  // Act / Assert — a duplicate email (any case) is refused
  const dup = await api.call('POST', '/auth/register', { body: { name: 'Nina', email: 'NINA@example.com', password: 'secret1' } });
  assert.equal(dup.status, 409);
});

test('/auth/me returns the signed-in user without the password hash', async () => {
  // Arrange
  const token = await api.login('customer');

  // Act
  const res = await api.call('GET', '/auth/me', { token });

  // Assert
  assert.equal(res.status, 200);
  assert.equal(res.body.user.email, 'customer@rest.test');
  assert.equal(res.body.user.role, 'customer');
  assert.equal('passwordHash' in res.body.user, false);
});

test('/auth/me is 401 without a valid token', async () => {
  // Act
  const missing = await api.call('GET', '/auth/me');
  const garbage = await api.call('GET', '/auth/me', { token: 'not-a-token' });

  // Assert
  assert.equal(missing.status, 401);
  assert.equal(garbage.status, 401);
});

test('/auth/roles lists the five stakeholder roles', async () => {
  // Act
  const res = await api.call('GET', '/auth/roles');

  // Assert
  assert.equal(res.status, 200);
  assert.deepEqual([...res.body.roles].sort(), ['admin', 'chef', 'customer', 'manager', 'waiter']);
});

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

/** Hire a fresh staff member through the real application flow; returns { id, email, password, user }. */
async function hire(role, by = 'manager') {
  const tag = `${role}${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
  const email = `${tag}@example.com`;
  const applied = await api.call('POST', '/staff/applications', { body: { name: `Hire ${tag}`, email, desiredRole: role === 'manager' ? 'waiter' : role } });
  const approver = await api.login(by);
  const approved = await api.call('POST', `/staff/applications/${applied.body.application.id}/approve`, { token: approver, body: role === 'manager' ? { role: 'manager' } : {} });
  return { id: approved.body.user.id, email, password: approved.body.tempPassword, user: approved.body.user };
}

test('a newly approved hire must change their temporary password', async () => {
  // Act
  const hired = await hire('waiter');

  // Assert
  assert.equal(hired.user.mustChangePassword, true);
  assert.equal('tokenVersion' in hired.user, false, 'the internal session counter is not exposed');
});

test('staff edit their own name and phone; changing the email needs the current password', async () => {
  // Arrange
  const hired = await hire('chef');
  const token = await api.login(hired.email, hired.password);

  // Act
  const profile = await api.call('PATCH', '/auth/me', { token, body: { name: '  Chef Renamed ', phone: '+1 (555) 010-2000' } });
  const noPassword = await api.call('PATCH', '/auth/me', { token, body: { email: `new-${hired.email}` } });
  const taken = await api.call('PATCH', '/auth/me', { token, body: { email: 'manager@rest.test', currentPassword: hired.password } });
  const badPhone = await api.call('PATCH', '/auth/me', { token, body: { phone: 'call me maybe' } });
  const withPassword = await api.call('PATCH', '/auth/me', { token, body: { email: `new-${hired.email}`, currentPassword: hired.password } });

  // Assert
  assert.equal(profile.status, 200);
  assert.equal(profile.body.user.name, 'Chef Renamed');
  assert.equal(profile.body.user.phone, '+1 (555) 010-2000');
  assert.equal(noPassword.status, 400);
  assert.equal(taken.status, 409);
  assert.equal(badPhone.status, 400);
  assert.equal(withPassword.status, 200);
  assert.equal(withPassword.body.user.email, `new-${hired.email}`);
});

test('customers edit their profile through /customers/me, not /auth/me', async () => {
  // Arrange
  const token = await api.login('customer');

  // Act
  const res = await api.call('PATCH', '/auth/me', { token, body: { name: 'Nope' } });

  // Assert
  assert.equal(res.status, 403);
});

test('changing your own password keeps this session, signs out the others and clears the temporary flag', async () => {
  // Arrange
  const hired = await hire('waiter');
  const tokenA = await api.login(hired.email, hired.password);
  const tokenB = await api.login(hired.email, hired.password);

  // Act
  const wrong = await api.call('POST', '/auth/me/password', { token: tokenA, body: { currentPassword: 'nope', newPassword: 'secret-123' } });
  const short = await api.call('POST', '/auth/me/password', { token: tokenA, body: { currentPassword: hired.password, newPassword: '123' } });
  const same = await api.call('POST', '/auth/me/password', { token: tokenA, body: { currentPassword: hired.password, newPassword: hired.password } });
  const changed = await api.call('POST', '/auth/me/password', { token: tokenA, body: { currentPassword: hired.password, newPassword: 'secret-123' } });

  // Assert
  assert.deepEqual([wrong.status, short.status, same.status], [400, 400, 400]);
  assert.equal(changed.status, 200);
  assert.equal(changed.body.user.mustChangePassword, false);
  assert.equal((await api.call('GET', '/auth/me', { token: changed.body.token })).status, 200, 'the returned token works');
  assert.equal((await api.call('GET', '/auth/me', { token: tokenB })).status, 401, 'other sessions are signed out');
  assert.equal((await api.call('POST', '/auth/login', { body: { email: hired.email, password: 'secret-123' } })).status, 200);
});

test('a manager edits and resets waiters and chefs, but not other managers, the admin or themselves', async () => {
  // Arrange
  const manager = await api.login('manager');
  const chef = await hire('chef');
  const peer = await hire('manager', 'admin');
  const chefToken = await api.login(chef.email, chef.password);

  // Act
  const edit = await api.call('PATCH', `/auth/users/${chef.id}/profile`, { token: manager, body: { phone: '555-0199' } });
  const reset = await api.call('POST', `/auth/users/${chef.id}/reset-password`, { token: manager });
  const onPeer = await api.call('PATCH', `/auth/users/${peer.id}/profile`, { token: manager, body: { name: 'X' } });
  const resetPeer = await api.call('POST', `/auth/users/${peer.id}/reset-password`, { token: manager });
  const onAdmin = await api.call('POST', '/auth/users/usr_admin/reset-password', { token: manager });
  const onSelf = await api.call('PATCH', '/auth/users/usr_manager/profile', { token: manager, body: { name: 'X' } });

  // Assert
  assert.equal(edit.status, 200);
  assert.equal(edit.body.user.phone, '555-0199');
  assert.equal(reset.status, 200);
  assert.equal(reset.body.user.mustChangePassword, true);
  assert.ok(reset.body.tempPassword.length >= 8);
  assert.equal((await api.call('GET', '/auth/me', { token: chefToken })).status, 401, 'the reset signs the chef out');
  assert.equal((await api.call('POST', '/auth/login', { body: { email: chef.email, password: reset.body.tempPassword } })).status, 200);
  for (const res of [onPeer, resetPeer, onAdmin, onSelf]) {
    assert.equal(res.status, 403);
    assert.match(res.body.error, /below your own rank/);
  }
});

test('an admin manages managers, but not another admin — not their details, role, status or account', async () => {
  // Arrange
  const admin = await api.login('admin');
  const manager = await hire('manager', 'admin');
  const promoted = await hire('waiter');
  await api.call('PATCH', `/auth/users/${promoted.id}`, { token: admin, body: { role: 'admin' } });

  // Act
  const resetManager = await api.call('POST', `/auth/users/${manager.id}/reset-password`, { token: admin });
  const editAdmin = await api.call('PATCH', `/auth/users/${promoted.id}/profile`, { token: admin, body: { name: 'X' } });
  const demoteAdmin = await api.call('PATCH', `/auth/users/${promoted.id}`, { token: admin, body: { role: 'waiter' } });
  const suspendAdmin = await api.call('PATCH', `/auth/users/${promoted.id}`, { token: admin, body: { active: false } });
  const removeAdmin = await api.call('DELETE', `/auth/users/${promoted.id}`, { token: admin });
  const customer = await api.call('PATCH', '/auth/users/usr_customer', { token: admin, body: { active: true } });

  // Assert
  assert.equal(resetManager.status, 200);
  for (const res of [editAdmin, demoteAdmin, suspendAdmin, removeAdmin]) assert.equal(res.status, 403);
  assert.equal(customer.status, 200, 'customer accounts stay manageable by an admin');
});

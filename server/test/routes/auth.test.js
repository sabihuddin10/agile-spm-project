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
  const bad = await api.call('POST', '/auth/register', { body: { name: 'A', email: 'not-an-email', password: 'Secret-pass1' } });
  assert.equal(bad.status, 400);
  const short = await api.call('POST', '/auth/register', { body: { name: 'A', email: 'a@b.co', password: '123' } });
  assert.equal(short.status, 400);

  // Act — valid registration
  const ok = await api.call('POST', '/auth/register', { body: { name: 'Nina New', email: 'nina@example.com', password: 'Secret-pass1' } });
  // Assert
  assert.equal(ok.status, 201);
  assert.equal(ok.body.user.role, 'customer');
  const me = await api.call('GET', '/customers/me', { token: ok.body.token });
  assert.equal(me.body.customer.name, 'Nina New');

  // Act / Assert — a duplicate email (any case) is refused
  const dup = await api.call('POST', '/auth/register', { body: { name: 'Nina', email: 'NINA@example.com', password: 'Secret-pass1' } });
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
  const wrong = await api.call('POST', '/auth/me/password', { token: tokenA, body: { currentPassword: 'nope', newPassword: 'Secret-123x' } });
  const short = await api.call('POST', '/auth/me/password', { token: tokenA, body: { currentPassword: hired.password, newPassword: '123' } });
  const same = await api.call('POST', '/auth/me/password', { token: tokenA, body: { currentPassword: hired.password, newPassword: hired.password } });
  const changed = await api.call('POST', '/auth/me/password', { token: tokenA, body: { currentPassword: hired.password, newPassword: 'Secret-123x' } });

  // Assert
  assert.deepEqual([wrong.status, short.status, same.status], [400, 400, 400]);
  assert.equal(changed.status, 200);
  assert.equal(changed.body.user.mustChangePassword, false);
  assert.equal((await api.call('GET', '/auth/me', { token: changed.body.token })).status, 200, 'the returned token works');
  assert.equal((await api.call('GET', '/auth/me', { token: tokenB })).status, 401, 'other sessions are signed out');
  assert.equal((await api.call('POST', '/auth/login', { body: { email: hired.email, password: 'Secret-123x' } })).status, 200);
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

test('an admin changes their own password without the current one; other roles still need it', async () => {
  // Arrange — a second admin, so the seeded demo admin keeps its "password" for the other tests
  const demoAdmin = await api.login('admin');
  const promoted = await hire('waiter');
  await api.call('PATCH', `/auth/users/${promoted.id}`, { token: demoAdmin, body: { role: 'admin' } });
  const admin = await api.login(promoted.email, promoted.password);
  const waiter = await hire('waiter');
  const waiterToken = await api.login(waiter.email, waiter.password);

  // Act
  const adminChange = await api.call('POST', '/auth/me/password', { token: admin, body: { newPassword: 'Admin-new-1!' } });
  const waiterNoCurrent = await api.call('POST', '/auth/me/password', { token: waiterToken, body: { newPassword: 'Waiter-new-1!' } });
  const adminSame = await api.call('POST', '/auth/me/password', { token: adminChange.body.token, body: { newPassword: 'Admin-new-1!' } });

  // Assert
  assert.equal(adminChange.status, 200);
  assert.equal((await api.call('POST', '/auth/login', { body: { email: promoted.email, password: 'Admin-new-1!' } })).status, 200);
  assert.equal(waiterNoCurrent.status, 400);
  assert.equal(adminSame.status, 400, 'the new password must still differ from the current one');
});

test('every way of setting a new password enforces the policy and names what is missing', async () => {
  // Arrange
  const admin = await api.login('admin');
  const chef = await hire('chef');
  const chefToken = await api.login(chef.email, chef.password);

  // Act
  const register = await api.call('POST', '/auth/register', { body: { name: 'Weak Pw', email: 'weak@example.com', password: 'alllowercase' } });
  const common = await api.call('POST', '/auth/register', { body: { name: 'Common Pw', email: 'common@example.com', password: 'Password1!' } });
  const asEmail = await api.call('POST', '/auth/register', { body: { name: 'Me', email: 'Same-As-1@x.io', password: 'Same-As-1@x.io' } });
  const own = await api.call('POST', '/auth/me/password', { token: chefToken, body: { currentPassword: chef.password, newPassword: 'NoDigits!!' } });
  const adminSet = await api.call('POST', `/auth/users/${chef.id}/password`, { token: admin, body: { newPassword: 'short1!' } });
  const notText = await api.call('POST', '/auth/me/password', { token: chefToken, body: { currentPassword: chef.password, newPassword: ['A', 'b'] } });

  // Assert
  assert.equal(register.status, 400);
  assert.match(register.body.error, /an uppercase letter/);
  assert.match(register.body.error, /a number/);
  assert.match(register.body.error, /a special character/);
  assert.doesNotMatch(register.body.error, /lowercase/, 'only the failed rules are listed');
  assert.equal(common.status, 400);
  assert.match(common.body.error, /less common/);
  assert.equal(asEmail.status, 400);
  assert.match(asEmail.body.error, /different from your email/);
  assert.equal(own.status, 400);
  assert.match(own.body.error, /a number/);
  assert.equal(adminSet.status, 400);
  assert.match(adminSet.body.error, /at least 8 characters/);
  assert.equal(notText.status, 400);
});

test('sign-in does not apply the password policy, so the demo accounts still use "password"', async () => {
  // Act
  const res = await api.call('POST', '/auth/login', { body: { email: 'waiter@rest.test', password: 'password' } });
  const wrongType = await api.call('POST', '/auth/login', { body: { email: { $ne: '' }, password: 'password' } });

  // Assert
  assert.equal(res.status, 200);
  assert.equal(wrongType.status, 400, 'an object instead of an email string is rejected, not matched');
});

test('registration ignores a role (or any other field) in the body', async () => {
  // Act
  const res = await api.call('POST', '/auth/register', {
    body: { name: 'Sneaky', email: 'sneaky@example.com', password: 'Sneaky-pass1', role: 'admin', active: false, tokenVersion: 99, id: 'usr_admin' },
  });

  // Assert
  assert.equal(res.status, 201);
  assert.equal(res.body.user.role, 'customer');
  assert.equal(res.body.user.active, true);
  assert.notEqual(res.body.user.id, 'usr_admin');
  assert.equal((await api.call('GET', '/auth/users', { token: await api.login('admin') })).body.users.filter((u) => u.id === 'usr_admin').length, 1);
});

test('profile and account fields are type-checked and length-limited', async () => {
  // Arrange
  const admin = await api.login('admin');
  const hired = await hire('waiter');
  const token = await api.login(hired.email, hired.password);

  // Act
  const longName = await api.call('PATCH', '/auth/me', { token, body: { name: 'x'.repeat(81) } });
  const controlName = await api.call('PATCH', '/auth/me', { token, body: { name: 'Bad\u0000Name' } });
  const arrayName = await api.call('PATCH', '/auth/me', { token, body: { name: ['Sam'] } });
  const shortPhone = await api.call('PATCH', '/auth/me', { token, body: { phone: '12-34' } });
  const longEmail = await api.call('POST', '/auth/register', { body: { name: 'Long', email: `${'a'.repeat(250)}@x.io`, password: 'Long-email-1' } });
  const stringActive = await api.call('PATCH', `/auth/users/${hired.id}`, { token: admin, body: { active: 'false' } });
  const after = (await api.call('GET', '/auth/me', { token })).body.user;

  // Assert
  for (const res of [longName, controlName, arrayName, shortPhone, longEmail, stringActive]) assert.equal(res.status, 400);
  assert.equal(after.active, true, 'the string "false" did not flip the account');
  assert.equal(after.name, hired.user.name);
});

test('an admin types a new password for a staff member below them; nobody else can, and not for another admin', async () => {
  // Arrange
  const admin = await api.login('admin');
  const manager = await api.login('manager');
  const chef = await hire('chef');
  const chefToken = await api.login(chef.email, chef.password);
  const otherAdmin = await hire('waiter');
  await api.call('PATCH', `/auth/users/${otherAdmin.id}`, { token: admin, body: { role: 'admin' } });

  // Act
  const short = await api.call('POST', `/auth/users/${chef.id}/password`, { token: admin, body: { newPassword: '123' } });
  const set = await api.call('POST', `/auth/users/${chef.id}/password`, { token: admin, body: { newPassword: 'Chef-pass-9!' } });
  const byManager = await api.call('POST', `/auth/users/${chef.id}/password`, { token: manager, body: { newPassword: 'Nope-nope-1!' } });
  const onAdmin = await api.call('POST', `/auth/users/${otherAdmin.id}/password`, { token: admin, body: { newPassword: 'Nope-nope-1!' } });

  // Assert
  assert.equal(short.status, 400);
  assert.equal(set.status, 200);
  assert.equal(set.body.user.mustChangePassword, false, 'the admin chose it, so no forced change');
  assert.equal((await api.call('GET', '/auth/me', { token: chefToken })).status, 401, 'the chef is signed out');
  assert.equal((await api.call('POST', '/auth/login', { body: { email: chef.email, password: 'Chef-pass-9!' } })).status, 200);
  assert.equal(byManager.status, 403);
  assert.equal(onAdmin.status, 403);
});

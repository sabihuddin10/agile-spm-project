/** AccountService — domain/account-service.js: registering a customer account and removing an account. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AccountError, AccountService } from '../../src/domain/account-service.js';
import { UserDirectory } from '../../src/domain/user-directory.js';

function setup() {
  const users = [{ id: 'usr_waiter', name: 'Will', email: 'waiter@rest.test', role: 'waiter' }];
  const customers = [];
  const tables = [{ id: 'tbl_1', waiterId: 'usr_waiter' }, { id: 'tbl_2', waiterId: 'usr_other' }, { id: 'tbl_3', waiterId: null }];
  const directory = new UserDirectory(users);
  let seq = 0;
  const createUser = ({ name, email, role }) => directory.add({ id: `usr_${++seq}`, name, email: email.toLowerCase(), role });
  const nextId = (prefix) => `${prefix}_${++seq}`;
  const service = new AccountService({ directory, customers, tables, createUser, nextId, now: () => new Date('2026-11-18T10:00:00Z') });
  return { users, customers, tables, directory, service };
}

test('registering creates the account and a linked online customer profile', () => {
  // Arrange
  const { service, customers, directory } = setup();

  // Act
  const user = service.registerCustomer({ name: 'Sam Lee', email: 'Sam@Example.com', password: 'Whatever-1!' });

  // Assert
  assert.equal(user.role, 'customer');
  assert.equal(directory.byEmail('sam@example.com'), user);
  assert.equal(customers.length, 1);
  assert.deepEqual(customers[0], {
    id: customers[0].id, userId: user.id, name: 'Sam Lee', email: 'sam@example.com', phone: '', type: 'online',
    loyaltyPoints: 0, preferences: { dietary: [], allergies: [] }, notes: '', createdAt: '2026-11-18T10:00:00.000Z',
  });
});

test('registering with an email that already has an account throws EMAIL_TAKEN and changes nothing', () => {
  // Arrange
  const { service, customers, users } = setup();

  // Act
  const attempt = () => service.registerCustomer({ name: 'Copy', email: ' WAITER@rest.test ', password: 'Whatever-1!' });

  // Assert
  assert.throws(attempt, (err) => err instanceof AccountError && err.code === 'EMAIL_TAKEN' && /already exists/.test(err.message));
  assert.equal(customers.length, 0);
  assert.equal(users.length, 1);
});

test('removing an account takes it out, keeps the customer profile but unlinks the login, and frees its tables', () => {
  // Arrange
  const { service, customers, tables, directory, users } = setup();
  const customerUser = service.registerCustomer({ name: 'Sam Lee', email: 'sam@example.com', password: 'Whatever-1!' });
  customers.push({ id: 'cus_other', userId: 'usr_someone_else', name: 'Other' });

  // Act
  const removedCustomer = service.removeAccount(customerUser.id);
  const removedWaiter = service.removeAccount('usr_waiter');

  // Assert
  assert.equal(removedCustomer.id, customerUser.id);
  assert.equal(removedWaiter.id, 'usr_waiter');
  assert.equal(directory.byId(customerUser.id), undefined);
  assert.equal(users.length, 0);
  assert.equal(customers[0].userId, null, 'the profile and its history stay');
  assert.equal(customers[0].name, 'Sam Lee');
  assert.equal(customers[1].userId, 'usr_someone_else', 'other customers are untouched');
  assert.deepEqual(tables.map((t) => t.waiterId), [null, 'usr_other', null]);
});

test('removing an account that does not exist returns undefined and touches nothing', () => {
  // Arrange
  const { service, tables, users } = setup();

  // Act
  const result = service.removeAccount('usr_nobody');

  // Assert
  assert.equal(result, undefined);
  assert.equal(users.length, 1);
  assert.equal(tables[0].waiterId, 'usr_waiter');
});

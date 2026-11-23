/** UserDirectory — domain/user-directory.js: O(1) verified lookups over the live users array. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UserDirectory } from '../../src/domain/user-directory.js';

const make = (n) => Array.from({ length: n }, (_, i) => ({ id: `usr_${i}`, name: `User ${i}`, email: `user${i}@Example.com` }));

test('finds an account by id and by email, ignoring case and surrounding space in the email', () => {
  // Arrange
  const list = make(5);
  const dir = new UserDirectory(list);

  // Act / Assert
  assert.equal(dir.byId('usr_3'), list[3]);
  assert.equal(dir.byEmail('user3@example.com'), list[3]);
  assert.equal(dir.byEmail('  USER3@EXAMPLE.COM  '), list[3]);
  assert.equal(dir.byId('usr_missing'), undefined);
  assert.equal(dir.byEmail('nobody@example.com'), undefined);
  assert.equal(dir.byEmail(undefined), undefined);
  assert.equal(dir.size, 5);
});

test('a warm lookup inspects one account, where a scan inspects all of them', () => {
  // Arrange: count every read of `id`, the field a scan compares
  const reads = { count: 0 };
  const list = Array.from({ length: 2000 }, (_, i) => ({
    get id() { reads.count += 1; return `usr_${i}`; },
    email: `user${i}@example.com`,
  }));
  const dir = new UserDirectory(list);
  dir.byId('usr_1999'); // the first lookup scans and warms the index

  // Act
  reads.count = 0;
  for (let i = 0; i < 100; i += 1) dir.byId('usr_1999');

  // Assert: 100 warm lookups cost about 100 reads, not 100 x 2000
  assert.ok(reads.count <= 300, `reads: ${reads.count}`);
});

test('after a reload replaces every user object, lookups return the new objects, never stale ones', () => {
  // Arrange: what restore() does: empty the array and refill it with fresh copies
  const list = make(4);
  const dir = new UserDirectory(list);
  const stale = dir.byId('usr_2');
  list.length = 0;
  for (const u of make(4)) list.push({ ...u, name: 'Reloaded' });

  // Act
  const found = dir.byId('usr_2');
  const byMail = dir.byEmail('user2@example.com');

  // Assert
  assert.notEqual(found, stale);
  assert.equal(found.name, 'Reloaded');
  assert.equal(byMail, found);
});

test('an account removed behind the directory is no longer found', () => {
  // Arrange
  const list = make(4);
  const dir = new UserDirectory(list);
  dir.byId('usr_1');
  dir.byEmail('user1@example.com');

  // Act
  list.splice(1, 1);

  // Assert
  assert.equal(dir.byId('usr_1'), undefined);
  assert.equal(dir.byEmail('user1@example.com'), undefined);
  assert.equal(dir.byId('usr_2').id, 'usr_2', 'accounts that moved up are still found');
});

test('an email edited in place is found under the new address, and not the old one', () => {
  // Arrange
  const list = make(3);
  const dir = new UserDirectory(list);
  const user = dir.byEmail('user1@example.com');

  // Act
  Object.assign(user, { email: 'renamed@example.com' });

  // Assert
  assert.equal(dir.byEmail('renamed@example.com'), user);
  assert.equal(dir.byEmail('user1@example.com'), undefined);
});

test('add puts the account in the array and makes it findable; remove takes it out and returns it', () => {
  // Arrange
  const list = make(3);
  const dir = new UserDirectory(list);
  const created = { id: 'usr_new', name: 'New', email: 'new@example.com' };

  // Act
  dir.add(created);
  const foundAfterAdd = dir.byId('usr_new');
  const removed = dir.remove('usr_new');

  // Assert
  assert.equal(foundAfterAdd, created);
  assert.equal(removed, created);
  assert.equal(list.length, 3);
  assert.equal(dir.byId('usr_new'), undefined);
  assert.equal(dir.remove('usr_new'), undefined, 'removing twice is harmless');
  assert.equal(dir.byId('usr_2').id, 'usr_2');
});

test('emailTaken ignores the account asking, and nameOf falls back for unknown accounts', () => {
  // Arrange
  const dir = new UserDirectory(make(3));

  // Act / Assert
  assert.equal(dir.emailTaken('user1@example.com'), true);
  assert.equal(dir.emailTaken('user1@example.com', 'usr_1'), false, 'your own address is not a clash');
  assert.equal(dir.emailTaken('user1@example.com', 'usr_2'), true);
  assert.equal(dir.emailTaken('free@example.com'), false);
  assert.equal(dir.nameOf('usr_0'), 'User 0');
  assert.equal(dir.nameOf('gone', 'Former staff'), 'Former staff');
  assert.equal(dir.nameOf('gone'), null);
});

test('the indexes stay correct when emails are edited over and over', () => {
  // Arrange
  const list = make(2);
  const dir = new UserDirectory(list);

  // Act: 500 edits, each looked up under its new address
  for (let i = 0; i < 500; i += 1) {
    list[0].email = `edit${i}@example.com`;
    assert.equal(dir.byEmail(`edit${i}@example.com`), list[0]);
  }

  // Assert: still correct after all that churn
  assert.equal(dir.byEmail('edit499@example.com'), list[0]);
  assert.equal(dir.byEmail('edit0@example.com'), undefined);
});

test('the first account wins when two share an email, as a plain find would', () => {
  // Arrange
  const list = [{ id: 'a', email: 'same@example.com' }, { id: 'b', email: 'same@example.com' }];
  const dir = new UserDirectory(list);

  // Act / Assert
  assert.equal(dir.byEmail('same@example.com').id, 'a');
});

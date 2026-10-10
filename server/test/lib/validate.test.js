/** Request-body type checks — lib/validate.js. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BadRequest, text, personName, email, phone, number, bool, oneOf, id, stringList, hasUnsafeKeys, isPlainObject,
} from '../../src/lib/validate.js';

const rejects = (fn, pattern) => assert.throws(fn, (err) => err instanceof BadRequest && err.status === 400 && (!pattern || pattern.test(err.message)));

test('text trims, enforces type, length and control characters', () => {
  // Act / Assert
  assert.equal(text('  hi  ', 'Note'), 'hi');
  assert.equal(text(undefined, 'Note'), undefined);
  rejects(() => text(42, 'Note'), /must be text/);
  rejects(() => text(['a'], 'Note'), /must be text/);
  rejects(() => text('x'.repeat(11), 'Note', { max: 10 }), /at most 10/);
  rejects(() => text('a\u0000b', 'Note'), /aren't allowed/);
  rejects(() => text('line\nbreak', 'Note'), /aren't allowed/);
  assert.equal(text('line\nbreak', 'Note', { multiline: true }), 'line\nbreak');
  rejects(() => text('   ', 'Note', { required: true }), /required/);
});

test('personName allows 1–80 characters on one line', () => {
  // Act / Assert
  assert.equal(personName(' Ada Lovelace '), 'Ada Lovelace');
  rejects(() => personName('x'.repeat(81)), /at most 80/);
  rejects(() => personName(''), /required/);
});

test('email validates format and length and lower-cases', () => {
  // Act / Assert
  assert.equal(email(' Sam@Rest.Test '), 'sam@rest.test');
  rejects(() => email('nope'), /valid email/);
  rejects(() => email(`${'a'.repeat(250)}@x.io`), /at most 254/);
  rejects(() => email({ $ne: '' }), /must be text/);
  assert.equal(email('', { required: false }), '');
});

test('phone normalises Pakistani mobiles to +92 3XX XXXXXXX and rejects anything else', () => {
  // Act / Assert
  assert.equal(phone(' 0300 1234567 '), '+92 300 1234567');
  assert.equal(phone('923001234567'), '+92 300 1234567');
  assert.equal(phone('+92 300 1234567'), '+92 300 1234567');
  assert.equal(phone('0092-300-1234567'), '+92 300 1234567');
  assert.equal(phone('3001234567'), '+92 300 1234567');
  assert.equal(phone(''), '');
  rejects(() => phone('12-34'), /valid phone/);
  rejects(() => phone('+1 (555) 010-2000'), /valid phone/);
  rejects(() => phone('0300 123456'), /valid phone/);
  rejects(() => phone('0212 1234567'), /valid phone/);
  rejects(() => phone('call me maybe'), /valid phone/);
  rejects(() => phone('1'.repeat(21)), /valid phone/);
  rejects(() => phone(5550100), /valid phone/);
});

test('number accepts numbers and numeric strings, nothing else', () => {
  // Act / Assert
  assert.equal(number('12.5', 'Price'), 12.5);
  assert.equal(number(3, 'Qty', { integer: true, min: 1, max: 5 }), 3);
  assert.equal(number(undefined, 'Price'), undefined);
  for (const bad of [null, '', true, [], {}, 'abc', 'Infinity', Infinity, NaN]) rejects(() => number(bad, 'Price'));
  rejects(() => number(2.5, 'Qty', { integer: true }), /whole number/);
  rejects(() => number(6, 'Qty', { min: 1, max: 5 }), /between 1 and 5/);
});

test('bool, oneOf and id are strict about types', () => {
  // Act / Assert
  assert.equal(bool(false, 'active'), false);
  rejects(() => bool('false', 'active'), /true or false/);
  rejects(() => bool(0, 'active'));
  assert.equal(oneOf('chef', 'Role', ['chef', 'waiter']), 'chef');
  rejects(() => oneOf('__proto__', 'Role', ['chef']));
  rejects(() => oneOf(['chef'], 'Role', ['chef']));
  assert.equal(id('', 'Table', { nullable: true }), null);
  rejects(() => id({}, 'Table'), /valid id/);
  rejects(() => id('x'.repeat(65), 'Table'), /valid id/);
});

test('stringList trims, de-duplicates and limits entries', () => {
  // Act / Assert
  assert.deepEqual(stringList([' Vegan ', 'vegan', ''], 'Tags', { lower: true }), ['vegan']);
  rejects(() => stringList('vegan', 'Tags'), /must be a list/);
  rejects(() => stringList([{ a: 1 }], 'Tags'), /text values/);
  rejects(() => stringList(Array(31).fill('a'), 'Tags'), /at most 30/);
  rejects(() => stringList(['x'.repeat(41)], 'Tags'), /at most 40/);
});

test('hasUnsafeKeys finds prototype-polluting keys at any depth', () => {
  // Arrange
  const top = JSON.parse('{"__proto__": {"isAdmin": true}}');
  const nested = JSON.parse('{"a": [{"b": {"constructor": {"prototype": {"x": 1}}}}]}');

  // Act / Assert
  assert.equal(hasUnsafeKeys(top), true);
  assert.equal(hasUnsafeKeys(nested), true);
  assert.equal(hasUnsafeKeys({ name: 'ok', list: [1, { a: 'b' }] }), false);
  assert.equal(isPlainObject([]), false);
  assert.equal(isPlainObject({}), true);
});

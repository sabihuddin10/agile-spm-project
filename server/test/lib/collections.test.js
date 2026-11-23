/** Collection helpers — lib/collections.js: map-building replacements for nested scans. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countBy, groupBy, indexBy, itemsFor } from '../../src/lib/collections.js';

const people = [
  { id: 1, team: 'kitchen', name: 'Ana' },
  { id: 2, team: 'floor', name: 'Ben' },
  { id: 3, team: 'kitchen', name: 'Cy' },
  { id: 4, team: 'floor', name: 'Di' },
  { id: 5, team: 'kitchen', name: 'Ed' },
];

test('groupBy collects items per key in input order, and keys appear in first-seen order', () => {
  // Arrange / Act
  const groups = groupBy(people, (p) => p.team);

  // Assert
  assert.deepEqual([...groups.keys()], ['kitchen', 'floor']);
  assert.deepEqual(groups.get('kitchen').map((p) => p.name), ['Ana', 'Cy', 'Ed']);
  assert.deepEqual(groups.get('floor').map((p) => p.name), ['Ben', 'Di']);
  assert.equal(groups.get('missing'), undefined);
});

test('indexBy keeps the first item for a key, exactly like Array.find', () => {
  // Arrange / Act
  const index = indexBy(people, (p) => p.team);

  // Assert
  assert.equal(index.get('kitchen'), people.find((p) => p.team === 'kitchen'));
  assert.equal(index.get('floor').name, 'Ben');
  assert.equal(index.size, 2);
});

test('countBy counts per key, and counts undefined keys together instead of failing', () => {
  // Arrange / Act
  const counts = countBy([...people, { id: 6 }, { id: 7 }], (p) => p.team);

  // Assert
  assert.equal(counts.get('kitchen'), 3);
  assert.equal(counts.get('floor'), 2);
  assert.equal(counts.get(undefined), 2);
  assert.equal(counts.get('missing'), undefined);
});

test('itemsFor returns an empty list for a missing key, so callers need no existence check', () => {
  // Arrange
  const groups = groupBy(people, (p) => p.team);

  // Act / Assert
  assert.deepEqual(itemsFor(groups, 'nobody'), []);
  assert.equal(itemsFor(groups, 'floor').length, 2);
});

test('empty input gives empty results', () => {
  assert.equal(groupBy([], (x) => x).size, 0);
  assert.equal(indexBy([], (x) => x).size, 0);
  assert.equal(countBy([], (x) => x).size, 0);
});

test('the grouped lists are the same as filtering once per key, which is what they replace', () => {
  // Arrange
  const keys = ['kitchen', 'floor', 'other'];

  // Act
  const groups = groupBy(people, (p) => p.team);

  // Assert
  for (const key of keys) assert.deepEqual(itemsFor(groups, key), people.filter((p) => p.team === key));
});

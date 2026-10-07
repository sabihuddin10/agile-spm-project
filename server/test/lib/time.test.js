/** Local-time date helpers — lib/time.js. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, combine, iso, isValidDate, isValidTime, localDate, localTime, pad, weekStart } from '../../src/lib/time.js';

test('pad left-pads single digits with a zero', () => {
  // Arrange / Act / Assert
  assert.equal(pad(5), '05');
  assert.equal(pad(12), '12');
});

test('localDate and localTime format a Date in local time', () => {
  // Arrange
  const d = new Date(2026, 9, 7, 14, 5); // 2026-10-07 14:05

  // Act / Assert
  assert.equal(localDate(d), '2026-10-07');
  assert.equal(localTime(d), '14:05');
});

test('combine joins a date and time string into the matching local Date', () => {
  // Arrange / Act
  const d = combine('2026-10-07', '14:30');

  // Assert
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 9);
  assert.equal(d.getDate(), 7);
  assert.equal(d.getHours(), 14);
  assert.equal(d.getMinutes(), 30);
});

test('addDays crosses month and year boundaries', () => {
  // Arrange
  const endOfJan = new Date(2026, 0, 31);
  const endOfYear = new Date(2026, 11, 31);

  // Act
  const intoFeb = addDays(endOfJan, 1);
  const intoNextYear = addDays(endOfYear, 1);

  // Assert
  assert.equal(localDate(intoFeb), '2026-02-01');
  assert.equal(localDate(intoNextYear), '2027-01-01');
});

test('isValidDate accepts a well-formed date and rejects malformed input', () => {
  // Arrange / Act / Assert
  assert.equal(isValidDate('2026-10-07'), true);
  assert.equal(isValidDate('10-07-2026'), false);
  assert.equal(isValidDate('not-a-date'), false);
  assert.equal(isValidDate(''), false);
});

test('isValidTime accepts 24h HH:MM and rejects everything else', () => {
  // Arrange / Act / Assert
  assert.equal(isValidTime('00:00'), true);
  assert.equal(isValidTime('23:59'), true);
  assert.equal(isValidTime('24:00'), false);
  assert.equal(isValidTime('9:30'), false);
  assert.equal(isValidTime('abc'), false);
});

test('weekStart returns the Monday of the week containing the given date', () => {
  // Arrange — 2024-01-01 is a known Monday
  const monday = new Date(2024, 0, 1);
  const midWeek = new Date(2024, 0, 3); // Wednesday, same week
  const sunday = new Date(2024, 0, 7); // Sunday, end of the same week

  // Act / Assert
  assert.equal(weekStart(monday), '2024-01-01');
  assert.equal(weekStart(midWeek), '2024-01-01');
  assert.equal(weekStart(sunday), '2024-01-01');
});

test('iso matches the native ISO string for the same Date', () => {
  // Arrange
  const d = new Date(2026, 9, 7, 12, 0, 0);

  // Act / Assert
  assert.equal(iso(d), d.toISOString());
});

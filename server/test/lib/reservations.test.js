/** Reservation capacity, alternatives and table holds — lib/reservations.js. */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { reservations, tables } from '../../src/data/store.js';
import { availability, canAccommodate, isLate, releaseHold, suggestAlternatives, syncTableHolds } from '../../src/lib/reservations.js';
import { addDays, localDate } from '../../src/lib/time.js';

before(() => {
  reservations.length = 0;
  for (const t of tables) Object.assign(t, { status: 'free', held: false, reservedFor: null });
});

const FUTURE = localDate(addDays(new Date(), 3));
const YESTERDAY = localDate(addDays(new Date(), -1));

let seq = 0;
function makeReservation(overrides = {}) {
  seq += 1;
  return {
    id: `test_res_${seq}`,
    customerName: 'Test Guest',
    email: 'guest@example.com',
    phone: '',
    partySize: 2,
    date: FUTURE,
    time: '19:00',
    tableId: null,
    status: 'confirmed',
    specialRequests: '',
    customerId: null,
    ...overrides,
  };
}

test('canAccommodate seats a small party with no existing bookings', () => {
  // Arrange / Act / Assert
  assert.equal(canAccommodate({ date: FUTURE, time: '19:00', partySize: 2 }), true);
});

test('canAccommodate refuses a party larger than the biggest table', () => {
  // Arrange / Act / Assert
  assert.equal(canAccommodate({ date: FUTURE, time: '19:00', partySize: 20 }), false);
});

test('canAccommodate refuses an explicit table that is too small or already taken', () => {
  // Arrange
  reservations.push(makeReservation({ tableId: tables[0].id, partySize: 2, date: FUTURE, time: '20:00' }));

  // Act / Assert — too small
  assert.equal(canAccommodate({ date: FUTURE, time: '20:00', partySize: 10, tableId: tables[0].id }), false);
  // Act / Assert — already taken by the overlapping booking above
  assert.equal(canAccommodate({ date: FUTURE, time: '20:00', partySize: 2, tableId: tables[0].id }), false);
  // Act / Assert — a different table, same slot, is still free
  assert.equal(canAccommodate({ date: FUTURE, time: '20:00', partySize: 2, tableId: tables[1].id }), true);
});

test('canAccommodate only treats nearby times as overlapping', () => {
  // Arrange
  reservations.push(makeReservation({ tableId: tables[2].id, partySize: 4, date: FUTURE, time: '12:00' }));

  // Act / Assert — far enough away on the same day: no conflict
  assert.equal(canAccommodate({ date: FUTURE, time: '21:00', partySize: 4, tableId: tables[2].id }), true);
  // Act / Assert — within the booking's duration: conflicts
  assert.equal(canAccommodate({ date: FUTURE, time: '12:30', partySize: 4, tableId: tables[2].id }), false);
});

test('availability lists every slot as unavailable for a date that has already passed', () => {
  // Arrange / Act
  const slots = availability(YESTERDAY, 2);

  // Assert
  assert.ok(slots.length > 0);
  assert.ok(slots.every((s) => s.available === false));
});

test('availability lists every slot as available for an open future date', () => {
  // Arrange / Act
  const slots = availability(FUTURE, 2);

  // Assert
  assert.ok(slots.every((s) => s.available === true));
});

test('suggestAlternatives never includes the originally requested slot', () => {
  // Arrange / Act
  const alternatives = suggestAlternatives(FUTURE, '19:00', 2, 3);

  // Assert
  assert.equal(alternatives.length, 3);
  assert.ok(!alternatives.some((a) => a.date === FUTURE && a.time === '19:00'));
  assert.ok(alternatives.every((a) => a.date === FUTURE || a.date === localDate(addDays(new Date(FUTURE + 'T12:00:00'), 1))));
});

test('syncTableHolds reserves a table ahead of a confirmed booking and releases it afterwards', () => {
  // Arrange
  const table = tables[3];
  const soon = new Date(Date.now() + 20 * 60000);
  const reservation = makeReservation({ tableId: table.id, status: 'confirmed', date: localDate(soon), time: `${String(soon.getHours()).padStart(2, '0')}:${String(soon.getMinutes()).padStart(2, '0')}` });
  reservations.push(reservation);

  // Act — just before the booking: the table is held
  syncTableHolds(Date.now());

  // Assert
  assert.equal(table.status, 'reserved');
  assert.equal(table.reservedFor, reservation.id);

  // Act — long after the booking window has closed
  syncTableHolds(Date.now() + 6 * 60 * 60000);

  // Assert
  assert.equal(table.reservedFor, null);
  assert.equal(table.status, 'free');
});

test('syncTableHolds leaves a manually held table reserved even after the window closes', () => {
  // Arrange
  const table = tables[4];
  table.held = true;
  const soon = new Date(Date.now() + 20 * 60000);
  const reservation = makeReservation({ tableId: table.id, status: 'confirmed', date: localDate(soon), time: `${String(soon.getHours()).padStart(2, '0')}:${String(soon.getMinutes()).padStart(2, '0')}` });
  reservations.push(reservation);

  try {
    // Act — put the table into the held window first
    syncTableHolds(Date.now());
    assert.equal(table.status, 'reserved');

    // Act — now move past the end of the booking window
    syncTableHolds(Date.now() + 6 * 60 * 60000);

    // Assert
    assert.equal(table.reservedFor, null);
    assert.equal(table.status, 'reserved');
  } finally {
    table.held = false;
  }
});

test('releaseHold frees a table that was held for the given booking', () => {
  // Arrange
  const table = tables[5];
  table.status = 'reserved';
  const reservation = makeReservation({ tableId: table.id });
  table.reservedFor = reservation.id;

  // Act
  releaseHold(reservation);

  // Assert
  assert.equal(table.reservedFor, null);
  assert.equal(table.status, 'free');
});

test('isLate is true only for a confirmed booking past its grace period', () => {
  // Arrange
  const reservation = makeReservation({ status: 'confirmed', date: FUTURE, time: '19:00' });
  const start = new Date(`${FUTURE}T19:00:00`).getTime();

  // Act / Assert
  assert.equal(isLate(reservation, start + 5 * 60000), false, 'still within the grace period');
  assert.equal(isLate(reservation, start + 30 * 60000), true, 'past the grace period');
  assert.equal(isLate({ ...reservation, status: 'requested' }, start + 30 * 60000), false, 'not confirmed');
});

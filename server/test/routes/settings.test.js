/** Settings module — routes/settings.js (restaurant policy: tax, service charge, hours, …). */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from '../helpers.js';

let api;
let manager;
let admin;
let original;
before(async () => {
  api = await startServer();
  [manager, admin] = await Promise.all([api.login('manager'), api.login('admin')]);
  original = (await api.call('GET', '/settings')).body.settings;
});
after(() => api.close());

const current = async () => (await api.call('GET', '/settings')).body.settings;
const patch = (token, body) => api.call('PATCH', '/settings', { token, body });
const restore = async () => {
  const res = await patch(manager, original);
  assert.equal(res.status, 200);
  assert.deepEqual(await current(), original);
};

/** [field, min, max] — mirrors the NUMERIC table in routes/settings.js. */
const NUMERIC = [
  ['taxRate', 0, 0.5],
  ['serviceChargeRate', 0, 0.5],
  ['pointValue', 0, 1],
  ['kitchenDelayMinutes', 1, 240],
  ['reservationDurationMinutes', 30, 300],
  ['reservationGraceMinutes', 0, 120],
  ['openingHour', 0, 23],
  ['closingHour', 1, 24],
];

test('GET is public and includes the settings and time slots', async () => {
  // Act
  const { status, body } = await api.call('GET', '/settings');

  // Assert
  assert.equal(status, 200);
  assert.equal(body.settings.restaurantName, 'Plate & Flame');
  assert.equal(body.settings.taxRate, 0.1);
  assert.ok(Array.isArray(body.timeSlots) && body.timeSlots.length > 0);
  for (const slot of body.timeSlots) assert.match(slot, /^\d{2}:\d{2}$/);
});

test('a manager PATCH saves and GET reflects it', async () => {
  // Act
  const res = await patch(manager, { taxRate: 0.2, kitchenDelayMinutes: 20, restaurantName: '  Plate & Flame Bistro  ' });

  // Assert
  assert.equal(res.status, 200);
  assert.equal(res.body.settings.taxRate, 0.2);
  const saved = await current();
  assert.equal(saved.taxRate, 0.2);
  assert.equal(saved.kitchenDelayMinutes, 20);
  assert.equal(saved.restaurantName, 'Plate & Flame Bistro', 'names are trimmed');
  assert.equal(saved.serviceChargeRate, original.serviceChargeRate, 'untouched fields are kept');

  await restore();
});

test('an admin may PATCH too; numeric strings and range edges are accepted', async () => {
  // Act
  const res = await patch(admin, { serviceChargeRate: '0.5', openingHour: 0, closingHour: 24 });

  // Assert
  assert.equal(res.status, 200);
  const saved = await current();
  assert.equal(saved.serviceChargeRate, 0.5);
  assert.equal(saved.openingHour, 0);
  assert.equal(saved.closingHour, 24);

  await restore();
});

test('waiters, customers and anonymous callers cannot PATCH', async () => {
  // Arrange
  const [waiter, customer] = await Promise.all([api.login('waiter'), api.login('customer')]);

  // Act
  const results = await Promise.all([
    patch(waiter, { taxRate: 0.3 }),
    patch(customer, { taxRate: 0.3 }),
    patch(undefined, { taxRate: 0.3 }),
  ]);

  // Assert
  assert.equal(results[0].status, 403);
  assert.equal(results[1].status, 403);
  assert.equal(results[2].status, 401);
  assert.deepEqual(await current(), original);
});

test('each numeric field is rejected outside its range and nothing changes', async () => {
  for (const [field, min, max] of NUMERIC) {
    for (const bad of [min - 0.01, max + 0.01, 'abc']) {
      // Act
      const res = await patch(manager, { [field]: bad });

      // Assert
      assert.equal(res.status, 400, `${field}=${bad} should be refused`);
      assert.match(res.body.error, new RegExp(field));
      assert.deepEqual(await current(), original, `${field}=${bad} must not change anything`);
    }
  }
});

test('blank restaurantName or address is rejected', async () => {
  for (const field of ['restaurantName', 'address']) {
    for (const blank of ['', '   ']) {
      // Act
      const res = await patch(manager, { [field]: blank });

      // Assert
      assert.equal(res.status, 400, `${field}=${JSON.stringify(blank)} should be refused`);
      assert.match(res.body.error, new RegExp(field));
    }
  }
  assert.deepEqual(await current(), original);
});

test('the opening hour must be before the closing hour', async () => {
  // Act / Assert — equal hours, and opening after the stored closing hour
  assert.equal((await patch(manager, { openingHour: 18, closingHour: 18 })).status, 400);
  assert.equal((await patch(manager, { openingHour: original.closingHour })).status, 400);
  assert.equal((await patch(manager, { closingHour: original.openingHour })).status, 400);

  // Assert
  assert.deepEqual(await current(), original);
});

test('a rejected PATCH changes nothing, even its valid fields', async () => {
  // Arrange
  const snapshot = await current();

  // Act — a valid taxRate alongside an invalid closingHour
  const res = await patch(manager, { taxRate: 0.25, restaurantName: 'Renamed', closingHour: 99 });

  // Assert
  assert.equal(res.status, 400);
  assert.deepEqual(await current(), snapshot);
});

/** Floor index — lib/floor-index.js: live orders and today's next booking per table, in one pass. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFloorIndex } from '../../src/lib/floor-index.js';

function rng(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const isActive = (o) => o.status !== 'closed' && o.status !== 'cancelled';
const TODAY = '2026-11-18';

/** The original way: filter every order and every reservation once per table. */
function naive(table, orders, reservations) {
  return {
    activeOrders: orders.filter((o) => o.tableId === table && isActive(o)),
    nextBooking: reservations
      .filter((r) => r.tableId === table && r.date === TODAY && ['requested', 'confirmed'].includes(r.status))
      .sort((a, b) => a.time.localeCompare(b.time))[0],
  };
}

test('a table gets its live orders, in the order taken, and today\'s earliest open booking', () => {
  // Arrange
  const orders = [
    { id: 'o1', tableId: 't1', status: 'placed' },
    { id: 'o2', tableId: 't2', status: 'placed' },
    { id: 'o3', tableId: 't1', status: 'closed' },
    { id: 'o4', tableId: 't1', status: 'preparing' },
  ];
  const reservations = [
    { id: 'r1', tableId: 't1', date: TODAY, time: '20:00', status: 'confirmed' },
    { id: 'r2', tableId: 't1', date: TODAY, time: '18:30', status: 'requested' },
    { id: 'r3', tableId: 't1', date: TODAY, time: '17:00', status: 'cancelled' },
    { id: 'r4', tableId: 't1', date: '2026-11-19', time: '12:00', status: 'confirmed' },
  ];

  // Act
  const floor = buildFloorIndex({ orders, reservations, today: TODAY, isActive });

  // Assert
  assert.deepEqual(floor.activeOrders('t1').map((o) => o.id), ['o1', 'o4']);
  assert.deepEqual(floor.activeOrders('t2').map((o) => o.id), ['o2']);
  assert.equal(floor.nextBooking('t1').id, 'r2', 'earliest open booking today; cancelled and other days are ignored');
  assert.equal(floor.nextBooking('t2'), undefined);
});

test('a table nobody has touched has no orders and no booking', () => {
  // Arrange
  const floor = buildFloorIndex({ orders: [], reservations: [], today: TODAY, isActive });

  // Act / Assert
  assert.deepEqual(floor.activeOrders('t9'), []);
  assert.equal(floor.nextBooking('t9'), undefined);
});

test('does not reorder or change the caller\'s lists', () => {
  // Arrange
  const reservations = [
    { id: 'a', tableId: 't1', date: TODAY, time: '21:00', status: 'confirmed' },
    { id: 'b', tableId: 't1', date: TODAY, time: '12:00', status: 'confirmed' },
  ];

  // Act
  buildFloorIndex({ orders: [], reservations, today: TODAY, isActive }).nextBooking('t1');

  // Assert
  assert.deepEqual(reservations.map((r) => r.id), ['a', 'b']);
});

test('gives the same answer as filtering per table, on 25 random floors', () => {
  for (let seed = 1; seed <= 25; seed += 1) {
    // Arrange
    const random = rng(seed);
    const pick = (list) => list[Math.floor(random() * list.length)];
    const tableIds = Array.from({ length: 15 }, (_, i) => `t${i}`);
    const orders = Array.from({ length: 200 }, (_, i) => ({ id: `o${i}`, tableId: random() < 0.1 ? null : pick(tableIds), status: pick(['placed', 'preparing', 'closed', 'cancelled']) }));
    const reservations = Array.from({ length: 120 }, (_, i) => ({
      id: `r${i}`, tableId: pick(tableIds), date: pick([TODAY, TODAY, '2026-11-19', '2026-11-17']),
      time: `${String(10 + Math.floor(random() * 12)).padStart(2, '0')}:${pick(['00', '30'])}`, status: pick(['requested', 'confirmed', 'seated', 'cancelled']),
    }));

    // Act
    const floor = buildFloorIndex({ orders, reservations, today: TODAY, isActive });

    // Assert
    for (const table of tableIds) {
      const expected = naive(table, orders, reservations);
      assert.deepEqual(floor.activeOrders(table), expected.activeOrders, `seed ${seed}, ${table} orders`);
      assert.deepEqual(floor.nextBooking(table), expected.nextBooking, `seed ${seed}, ${table} booking`);
    }
  }
});

test('building the index reads each order once, where filtering per table reads every order for every table', () => {
  // Arrange
  let reads = 0;
  const orders = Array.from({ length: 1000 }, (_, i) => ({ get tableId() { reads += 1; return `t${i % 25}`; }, status: 'placed' }));
  const tableIds = Array.from({ length: 25 }, (_, i) => `t${i}`);

  // Act
  reads = 0;
  const floor = buildFloorIndex({ orders, reservations: [], today: TODAY, isActive });
  for (const t of tableIds) floor.activeOrders(t);
  const indexed = reads;
  reads = 0;
  for (const t of tableIds) naive(t, orders, []);
  const scanned = reads;

  // Assert
  assert.equal(indexed, 1000);
  assert.equal(scanned, 25 * 1000);
});

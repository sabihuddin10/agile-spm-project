/**
 * Staff performance — lib/staff-performance.js. The reference below is the original per-person loop, kept
 * verbatim, so the single-pass version is checked against exactly what it replaced.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { staffPerformance } from '../../src/lib/staff-performance.js';
import { MINUTE, combine } from '../../src/lib/time.js';
import { fromCents, toCents } from '../../src/lib/order-math.js';

function rng(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const shiftHours = (s) => (combine(s.date, s.end) - combine(s.date, s.start)) / (60 * MINUTE);

/** The original implementation: for each person, walk every order and shift again. */
function reference({ staff, orders: inRange, shifts, from, to }) {
  return staff.map((u) => {
    const taken = inRange.filter((o) => o.waiterId === u.id);
    const settled = taken.filter((o) => o.paymentStatus !== 'unpaid');
    const prepared = inRange.flatMap((o) => o.items.filter((i) => i.preparedBy === u.id).map((i) => ({ i, o })));
    const prepTimes = prepared
      .filter(({ i, o }) => i.readyAt && o.confirmedAt)
      .map(({ i, o }) => (new Date(i.readyAt) - new Date(o.confirmedAt)) / MINUTE);
    const myShifts = shifts.filter((s) => s.userId === u.id && s.date >= from && s.date <= to);
    const completed = myShifts.filter((s) => s.status === 'completed');
    return {
      userId: u.id,
      name: u.name,
      role: u.role,
      active: u.active,
      ordersTaken: taken.length,
      ordersServed: inRange.filter((o) => o.servedBy === u.id).length,
      revenueHandled: fromCents(settled.reduce((s, o) => s + toCents(o.total) - toCents(o.refund?.amount ?? 0), 0)),
      tips: fromCents(settled.reduce((s, o) => s + toCents(o.tip), 0)),
      itemsPrepared: prepared.reduce((s, { i }) => s + i.qty, 0),
      avgPrepMinutes: prepTimes.length ? Math.round(prepTimes.reduce((s, m) => s + m, 0) / prepTimes.length) : null,
      shiftsCompleted: completed.length,
      shiftsMissed: myShifts.filter((s) => s.status === 'missed').length,
      hoursWorked: Math.round(completed.reduce((s, x) => s + shiftHours(x), 0) * 10) / 10,
    };
  });
}

function dataset(seed, { people = 8, orderCount = 150, shiftCount = 120 } = {}) {
  const random = rng(seed);
  const pick = (list) => list[Math.floor(random() * list.length)];
  const staff = Array.from({ length: people }, (_, i) => ({ id: `usr_${i}`, name: `Person ${i}`, role: pick(['waiter', 'chef', 'manager']), active: random() < 0.9 }));
  const ids = [...staff.map((s) => s.id), 'usr_gone', null];
  const orders = Array.from({ length: orderCount }, (_, n) => {
    const confirmedAt = new Date(Date.UTC(2026, 10, 10, 10, 0) + n * 3 * MINUTE).toISOString();
    return {
      id: `o${n}`,
      waiterId: pick(ids),
      servedBy: pick(ids),
      paymentStatus: pick(['unpaid', 'paid', 'paid', 'refunded']),
      total: Math.round(random() * 9000) / 100,
      tip: Math.round(random() * 800) / 100,
      refund: random() < 0.15 ? { amount: Math.round(random() * 1500) / 100 } : undefined,
      confirmedAt: random() < 0.9 ? confirmedAt : null,
      items: Array.from({ length: 1 + Math.floor(random() * 4) }, () => ({
        preparedBy: pick(ids),
        qty: 1 + Math.floor(random() * 3),
        readyAt: random() < 0.8 ? new Date(Date.parse(confirmedAt) + Math.floor(random() * 40) * MINUTE).toISOString() : null,
      })),
    };
  });
  const shifts = Array.from({ length: shiftCount }, () => ({
    userId: pick(ids),
    date: `2026-11-${String(5 + Math.floor(random() * 20)).padStart(2, '0')}`,
    start: pick(['09:00', '11:30', '16:30']),
    end: pick(['16:00', '18:00', '22:30']),
    status: pick(['completed', 'completed', 'missed', 'scheduled']),
  }));
  return { staff, orders, shifts, from: '2026-11-08', to: '2026-11-22' };
}

test('gives exactly the numbers the original loop gave, on 30 random datasets', () => {
  for (let seed = 1; seed <= 30; seed += 1) {
    // Arrange
    const input = dataset(seed);

    // Act
    const actual = staffPerformance(input);

    // Assert
    assert.deepEqual(actual, reference(input), `seed ${seed}`);
  }
});

test('handles no staff, no orders and no shifts', () => {
  assert.deepEqual(staffPerformance({ staff: [], orders: [], shifts: [], from: '2026-11-01', to: '2026-11-30' }), []);
  const empty = staffPerformance({ staff: [{ id: 'u', name: 'U', role: 'waiter', active: true }], orders: [], shifts: [], from: '2026-11-01', to: '2026-11-30' });
  assert.deepEqual(empty[0], {
    userId: 'u', name: 'U', role: 'waiter', active: true, ordersTaken: 0, ordersServed: 0, revenueHandled: 0, tips: 0,
    itemsPrepared: 0, avgPrepMinutes: null, shiftsCompleted: 0, shiftsMissed: 0, hoursWorked: 0,
  });
});

test('shifts outside the report range are ignored', () => {
  // Arrange
  const staff = [{ id: 'u', name: 'U', role: 'waiter', active: true }];
  const shifts = [
    { userId: 'u', date: '2026-11-10', start: '09:00', end: '17:00', status: 'completed' },
    { userId: 'u', date: '2026-10-31', start: '09:00', end: '17:00', status: 'completed' },
    { userId: 'u', date: '2026-12-01', start: '09:00', end: '17:00', status: 'missed' },
  ];

  // Act
  const [row] = staffPerformance({ staff, orders: [], shifts, from: '2026-11-01', to: '2026-11-30' });

  // Assert
  assert.equal(row.shiftsCompleted, 1);
  assert.equal(row.shiftsMissed, 0);
  assert.equal(row.hoursWorked, 8);
});

test('the work grows with the data, not with data times staff: one read of each order\'s waiter', () => {
  // Arrange: count reads of waiterId with 60 staff and 1500 orders
  let reads = 0;
  const base = dataset(7, { people: 60, orderCount: 1500, shiftCount: 10 });
  const orders = base.orders.map((o) => {
    const id = o.waiterId;
    return Object.defineProperty({ ...o }, 'waiterId', { get() { reads += 1; return id; }, enumerable: true });
  });

  // Act
  reads = 0;
  staffPerformance({ ...base, orders });
  const indexed = reads;
  reads = 0;
  reference({ ...base, orders });
  const scanned = reads;

  // Assert
  assert.equal(indexed, 1500);
  assert.equal(scanned, 60 * 1500);
});

/** Pay — lib/payroll.js (base, tips, bonuses, late penalties, rounding, estimate flag). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { payBreakdown, monthTips, monthRange, wageOf, round2, DEFAULT_WAGES, MONTH_RE } from '../../src/lib/payroll.js';

test('net pay is paid hours × wage + tips + bonuses − late penalties', () => {
  // Arrange
  const input = {
    month: '2026-09',
    hourlyWage: 12,
    paidMinutes: 600, // 10 h
    tips: 35.5,
    adjustments: [
      { id: 'adj_2', amount: 25, reason: 'Birthday', date: '2026-09-20' },
      { id: 'adj_1', amount: -10, reason: 'Broken glassware', date: '2026-09-02' },
    ],
    lateSessions: [{ date: '2026-09-12', lateMinutes: 14 }, { date: '2026-09-03', lateMinutes: 7 }],
    latePenalty: 5,
    today: '2026-10-09',
  };

  // Act
  const pay = payBreakdown(input);

  // Assert
  assert.deepEqual(pay, {
    month: '2026-09',
    hourlyWage: 12,
    paidHours: 10,
    base: 120,
    tips: 35.5,
    bonuses: [
      { id: 'adj_1', amount: -10, reason: 'Broken glassware', date: '2026-09-02' },
      { id: 'adj_2', amount: 25, reason: 'Birthday', date: '2026-09-20' },
    ],
    bonusTotal: 15,
    latePenalties: [{ date: '2026-09-03', minutes: 7, amount: 5 }, { date: '2026-09-12', minutes: 14, amount: 5 }],
    latePenaltyTotal: 10,
    net: 160.5,
    estimated: false,
  });
});

test('money is rounded to cents without floating-point drift', () => {
  // Arrange — 1234 min = 20.5666… h, rounded to 20.57 h
  const input = { month: '2026-09', hourlyWage: 13.33, paidMinutes: 1234, tips: 0.1 + 0.2, adjustments: [{ id: 'a', amount: 0.1, reason: 'x', date: '2026-09-01' }, { id: 'b', amount: 0.2, reason: 'y', date: '2026-09-02' }], today: '2026-10-09' };

  // Act
  const pay = payBreakdown(input);

  // Assert
  assert.equal(pay.paidHours, 20.57);
  assert.equal(pay.base, 274.2); // 20.57 × 13.33 = 274.1981
  assert.equal(pay.tips, 0.3);
  assert.equal(pay.bonusTotal, 0.3);
  assert.equal(pay.net, 274.8);
  assert.equal(round2(0.1 + 0.2), 0.3);
});

test('pay is an estimate until the month has ended', () => {
  // Arrange
  const base = { hourlyWage: 10, paidMinutes: 60 };

  // Act
  const current = payBreakdown({ ...base, month: '2026-10', today: '2026-10-09' });
  const lastDay = payBreakdown({ ...base, month: '2026-10', today: '2026-10-31' });
  const past = payBreakdown({ ...base, month: '2026-10', today: '2026-11-01' });
  const future = payBreakdown({ ...base, month: '2026-12', today: '2026-10-09' });

  // Assert
  assert.deepEqual([current.estimated, lastDay.estimated, past.estimated, future.estimated], [true, true, false, true]);
});

test('a waiter\'s tips come from paid bills they waited, dated by payment', () => {
  // Arrange
  const orders = [
    { waiterId: 'usr_w', paymentStatus: 'paid', paidAt: new Date(2026, 8, 10, 20).toISOString(), tip: 4.25 },
    { waiterId: 'usr_w', paymentStatus: 'paid', paidAt: new Date(2026, 8, 30, 21).toISOString(), tip: 3.1 },
    { waiterId: null, servedBy: 'usr_w', paymentStatus: 'paid', paidAt: new Date(2026, 8, 12, 13).toISOString(), tip: 2 },
    { waiterId: 'usr_w', paymentStatus: 'refunded', paidAt: new Date(2026, 8, 11, 20).toISOString(), tip: 9 },
    { waiterId: 'usr_w', paymentStatus: 'unpaid', paidAt: null, tip: 5 },
    { waiterId: 'usr_w', paymentStatus: 'paid', paidAt: new Date(2026, 9, 1, 12).toISOString(), tip: 7 },
    { waiterId: 'usr_other', servedBy: 'usr_w', paymentStatus: 'paid', paidAt: new Date(2026, 8, 15, 20).toISOString(), tip: 6 },
  ];

  // Act
  const tips = monthTips(orders, 'usr_w', '2026-09');

  // Assert — refunded, unpaid, next month's and another waiter's bills are left out
  assert.equal(tips, 9.35);
});

test('helpers: month range, default wages by role, month format', () => {
  // Act / Assert
  assert.deepEqual(monthRange('2026-02'), { from: '2026-02-01', to: '2026-02-28' });
  assert.deepEqual(monthRange('2028-02'), { from: '2028-02-01', to: '2028-02-29' });
  assert.deepEqual(DEFAULT_WAGES, { waiter: 12, chef: 15, manager: 20, admin: 25 });
  assert.equal(wageOf({ role: 'chef' }), 15);
  assert.equal(wageOf({ role: 'chef', hourlyWage: 17.5 }), 17.5);
  assert.ok(MONTH_RE.test('2026-10'));
  assert.ok(!MONTH_RE.test('2026-13') && !MONTH_RE.test('2026-1') && !MONTH_RE.test('2026-10-01'));
});

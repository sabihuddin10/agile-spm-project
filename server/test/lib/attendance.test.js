/** Attendance rules — lib/attendance.js (paid time, breaks, lateness, missed shifts, series). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_RULES, rulesFrom, grossMinutes, recordedBreakMinutes, autoBreakMinutes, paidMinutes, serializeSession,
  matchShift, lateness, shiftStatus, currentState, summarize, isoWeekKey, buildSeries, datesBetween,
} from '../../src/lib/attendance.js';
import { combine } from '../../src/lib/time.js';

const at = (date, time) => combine(date, time).toISOString();
const ms = (date, time) => combine(date, time).getTime();

function session(fields) {
  return { id: 'att_1', userId: 'usr_w', date: '2026-10-08', clockOut: null, breaks: [], shiftId: null, late: false, lateMinutes: 0, ...fields };
}
const brk = (date, start, end) => ({ start: at(date, start), end: end ? at(date, end) : null });
const shift = (fields) => ({ id: 'shf_1', userId: 'usr_w', date: '2026-10-08', start: '09:00', end: '17:00', ...fields });

/* ------------------------------------------------------------ paid time */

test('paid minutes subtract a recorded break and apply no automatic break', () => {
  // Arrange
  const s = session({ clockIn: at('2026-10-08', '09:00'), clockOut: at('2026-10-08', '17:00'), breaks: [brk('2026-10-08', '13:00', '13:30')] });

  // Act
  const result = serializeSession(s, DEFAULT_RULES);

  // Assert
  assert.equal(grossMinutes(s), 480);
  assert.equal(recordedBreakMinutes(s), 30);
  assert.equal(result.autoBreakMinutes, 0);
  assert.equal(result.paidMinutes, 450);
});

test('a long session with no recorded break gets the automatic unpaid break', () => {
  // Arrange
  const long = session({ clockIn: at('2026-10-08', '09:00'), clockOut: at('2026-10-08', '16:30') });
  const exactlySix = session({ clockIn: at('2026-10-08', '09:00'), clockOut: at('2026-10-08', '15:00') });
  const shortBreak = session({ ...long, breaks: [brk('2026-10-08', '12:00', '12:10')] });

  // Act
  const results = [long, exactlySix, shortBreak].map((s) => [autoBreakMinutes(s, DEFAULT_RULES), paidMinutes(s, DEFAULT_RULES)]);

  // Assert — 7.5 h → 60 min deducted; exactly 6 h is not "more than" 6 h; any recorded break replaces it
  assert.deepEqual(results, [[60, 390], [0, 360], [0, 440]]);
});

test('the automatic break follows the settings', () => {
  // Arrange
  const s = session({ clockIn: at('2026-10-08', '09:00'), clockOut: at('2026-10-08', '13:30') });
  const rules = rulesFrom({ autoBreakAfterHours: 4, autoBreakMinutes: 30 });

  // Act
  const paid = paidMinutes(s, rules);

  // Assert
  assert.equal(autoBreakMinutes(s, rules), 30);
  assert.equal(paid, 240);
});

test('open sessions and open breaks count up to now', () => {
  // Arrange
  const now = ms('2026-10-08', '11:30');
  const working = session({ clockIn: at('2026-10-08', '09:00') });
  const onBreak = session({ clockIn: at('2026-10-08', '09:00'), breaks: [brk('2026-10-08', '11:00', null)] });

  // Act
  const a = serializeSession(working, DEFAULT_RULES, now);
  const b = serializeSession(onBreak, DEFAULT_RULES, now);

  // Assert
  assert.equal(a.paidMinutes, 150);
  assert.equal(a.clockOut, null);
  assert.equal(recordedBreakMinutes(onBreak, now), 30);
  assert.equal(b.paidMinutes, 120);
  assert.deepEqual(b.breaks, [{ start: at('2026-10-08', '11:00'), end: null }]);
});

/* -------------------------------------------------------- shifts & late */

test('lateness allows the grace period and counts minutes after the shift start', () => {
  // Arrange
  const sh = shift({ start: '17:00', end: '23:00' });

  // Act
  const onGrace = lateness(sh, at('2026-10-08', '17:05'), 5);
  const late = lateness(sh, at('2026-10-08', '17:06'), 5);
  const noGrace = lateness(sh, at('2026-10-08', '17:01'), 0);
  const early = lateness(sh, at('2026-10-08', '16:50'), 5);
  const noShift = lateness(null, at('2026-10-08', '20:00'), 5);

  // Assert
  assert.deepEqual(onGrace, { late: false, lateMinutes: 0 });
  assert.deepEqual(late, { late: true, lateMinutes: 6 });
  assert.deepEqual(noGrace, { late: true, lateMinutes: 1 });
  assert.deepEqual(early, { late: false, lateMinutes: 0 });
  assert.deepEqual(noShift, { late: false, lateMinutes: 0 });
});

test('a clock-in matches the user\'s shift that day with the closest start', () => {
  // Arrange
  const shifts = [
    shift({ id: 'lunch', start: '11:30', end: '16:00' }),
    shift({ id: 'dinner', start: '16:30', end: '22:30' }),
    shift({ id: 'other', userId: 'usr_x', start: '16:00', end: '23:00' }),
    shift({ id: 'tomorrow', date: '2026-10-09', start: '16:30', end: '22:30' }),
  ];

  // Act
  const beforeDinner = matchShift(shifts, 'usr_w', at('2026-10-08', '16:20'));
  const lunch = matchShift(shifts, 'usr_w', at('2026-10-08', '11:40'));
  const tooEarly = matchShift(shifts, 'usr_w', at('2026-10-08', '06:00'));
  const afterAll = matchShift(shifts, 'usr_w', at('2026-10-08', '23:00'));

  // Assert
  assert.equal(beforeDinner.id, 'dinner');
  assert.equal(lunch.id, 'lunch');
  assert.equal(tooEarly, null, 'more than 3 hours early does not count towards a shift');
  assert.equal(afterAll, null);
});

test('a shift is missed once it has ended without a session, completed when attended', () => {
  // Arrange
  const now = ms('2026-10-09', '12:00');
  const pastMissed = shift({ id: 'a', date: '2026-10-07' });
  const todayEnded = shift({ id: 'b', date: '2026-10-09', start: '06:00', end: '10:00' });
  const inProgress = shift({ id: 'c', date: '2026-10-09', start: '11:00', end: '19:00' });
  const future = shift({ id: 'd', date: '2026-10-10' });
  const matched = shift({ id: 'e', date: '2026-10-08' });
  const overlapped = shift({ id: 'f', date: '2026-10-06' });
  const sessions = [
    session({ shiftId: 'e', clockIn: at('2026-10-08', '09:20'), clockOut: at('2026-10-08', '17:00') }),
    session({ date: '2026-10-06', clockIn: at('2026-10-06', '10:00'), clockOut: at('2026-10-06', '12:00') }),
    session({ userId: 'usr_x', date: '2026-10-07', clockIn: at('2026-10-07', '09:00'), clockOut: at('2026-10-07', '17:00') }),
  ];

  // Act
  const statuses = [pastMissed, todayEnded, inProgress, future, matched, overlapped].map((s) => shiftStatus(s, sessions, now));

  // Assert — another person's session does not count
  assert.deepEqual(statuses, ['missed', 'missed', 'scheduled', 'scheduled', 'completed', 'completed']);
});

test('current state is working, on a break or off, with the time it began', () => {
  // Arrange
  const closed = session({ clockIn: at('2026-10-08', '09:00'), clockOut: at('2026-10-08', '12:00') });
  const back = session({ id: 'att_2', clockIn: at('2026-10-08', '13:00'), breaks: [brk('2026-10-08', '14:00', '14:20')] });
  const away = session({ id: 'att_3', clockIn: at('2026-10-08', '13:00'), breaks: [brk('2026-10-08', '14:00', null)] });

  // Act
  const off = currentState([closed]);
  const working = currentState([closed, back]);
  const onBreak = currentState([away]);
  const never = currentState([]);

  // Assert
  assert.deepEqual([off.state, off.since, off.session], ['off', at('2026-10-08', '12:00'), null]);
  assert.deepEqual([working.state, working.since, working.session.id], ['working', at('2026-10-08', '14:20'), 'att_2']);
  assert.deepEqual([onBreak.state, onBreak.since], ['on_break', at('2026-10-08', '14:00')]);
  assert.deepEqual([never.state, never.since], ['off', null]);
});

test('the summary counts worked, break and paid time, lateness and attendance', () => {
  // Arrange
  const now = ms('2026-10-10', '12:00');
  const shifts = [shift({ id: 's1', date: '2026-10-07' }), shift({ id: 's2', date: '2026-10-08' }), shift({ id: 's3', date: '2026-10-09' })];
  const sessions = [
    session({ shiftId: 's1', date: '2026-10-07', clockIn: at('2026-10-07', '09:00'), clockOut: at('2026-10-07', '17:00'), breaks: [brk('2026-10-07', '13:00', '13:30')] }),
    session({ shiftId: 's2', date: '2026-10-08', clockIn: at('2026-10-08', '09:12'), clockOut: at('2026-10-08', '17:00'), late: true, lateMinutes: 12 }),
  ];

  // Act
  const summary = summarize(sessions, shifts, DEFAULT_RULES, now);

  // Assert
  assert.deepEqual(summary, {
    scheduledMinutes: 1440,
    workedMinutes: 480 + 468,
    breakMinutes: 30 + 60,
    paidMinutes: 450 + 408,
    shifts: 3,
    shiftsWorked: 2,
    shiftsMissed: 1,
    lateCount: 1,
    lateMinutes: 12,
    onTimeRate: 0.5,
    attendanceRate: 0.667,
  });
});

/* ---------------------------------------------------------------- series */

test('ISO week keys use the ISO week-year', () => {
  // Act
  const keys = ['2026-10-08', '2026-10-04', '2026-10-05', '2027-01-01', '2024-12-30'].map(isoWeekKey);

  // Assert — Sunday belongs to the week before; early January can be the previous ISO year and vice versa
  assert.deepEqual(keys, ['2026-W41', '2026-W40', '2026-W41', '2026-W53', '2025-W01']);
});

test('series bucket by day, ISO week and month across the range', () => {
  // Arrange
  const shifts = [shift({ date: '2026-09-30' }), shift({ id: 's2', date: '2026-10-05' })];
  const sessions = [
    session({ date: '2026-09-30', clockIn: at('2026-09-30', '09:00'), clockOut: at('2026-09-30', '13:00') }),
    session({ date: '2026-10-05', clockIn: at('2026-10-05', '09:10'), clockOut: at('2026-10-05', '12:10'), late: true, lateMinutes: 10 }),
  ];

  // Act
  const series = buildSeries(sessions, shifts, '2026-09-29', '2026-10-05', DEFAULT_RULES, ms('2026-10-06', '00:00'));

  // Assert
  assert.deepEqual(series.day.map((p) => p.key), datesBetween('2026-09-29', '2026-10-05'));
  assert.equal(series.day.find((p) => p.key === '2026-09-30').paidMinutes, 240);
  assert.deepEqual(series.week.map((p) => [p.key, p.label, p.scheduledMinutes, p.paidMinutes, p.lateCount]), [
    ['2026-W40', 'w/c 28 Sep', 480, 240, 0],
    ['2026-W41', 'w/c 5 Oct', 480, 180, 1],
  ]);
  assert.deepEqual(series.month.map((p) => [p.key, p.label, p.paidMinutes]), [['2026-09', 'Sep 2026', 240], ['2026-10', 'Oct 2026', 180]]);
});

test('hour-of-day points split sessions across the hours they span, including past midnight', () => {
  // Arrange
  const sessions = [
    session({ clockIn: at('2026-10-08', '16:30'), clockOut: at('2026-10-08', '18:15') }),
    session({ id: 'att_2', clockIn: at('2026-10-08', '23:30'), clockOut: at('2026-10-09', '00:30') }),
  ];

  // Act
  const { hour, day } = buildSeries(sessions, [], '2026-10-08', '2026-10-09', DEFAULT_RULES, ms('2026-10-10', '00:00'));

  // Assert
  assert.equal(hour.length, 24);
  assert.deepEqual(hour.map((p) => p.key), Array.from({ length: 24 }, (_, h) => String(h)));
  assert.deepEqual([hour[16].paidMinutes, hour[17].paidMinutes, hour[18].paidMinutes], [30, 60, 15]);
  assert.deepEqual([hour[23].paidMinutes, hour[0].paidMinutes], [30, 30]);
  assert.deepEqual(day.map((p) => p.paidMinutes), [165, 0], 'the overnight session counts on the day it started');
});

test('hour points leave out recorded breaks and spread an automatic break, keeping the paid total', () => {
  // Arrange
  const recorded = session({ clockIn: at('2026-10-08', '09:00'), clockOut: at('2026-10-08', '12:00'), breaks: [brk('2026-10-08', '10:00', '10:30')] });
  const auto = session({ id: 'att_2', date: '2026-10-07', clockIn: at('2026-10-07', '09:00'), clockOut: at('2026-10-07', '17:00') });

  // Act
  const a = buildSeries([recorded], [], '2026-10-08', '2026-10-08', DEFAULT_RULES).hour;
  const b = buildSeries([auto], [], '2026-10-07', '2026-10-07', DEFAULT_RULES).hour;

  // Assert
  assert.deepEqual([a[9].paidMinutes, a[10].paidMinutes, a[10].breakMinutes, a[11].paidMinutes], [60, 30, 30, 60]);
  assert.equal(b.reduce((s, p) => s + p.paidMinutes, 0), 420);
  assert.equal(b.reduce((s, p) => s + p.breakMinutes, 0), 60);
  assert.ok(b.slice(9, 17).every((p) => p.paidMinutes >= 52 && p.paidMinutes <= 53));
});

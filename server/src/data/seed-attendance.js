/**
 * Seeds attendance sessions from the seeded shifts (about 90 days) plus a few
 * pay adjustments, so My work, the workforce hub and payroll have history from
 * the first run.
 *
 * Past shifts not marked missed get a session: clock-in a few minutes either
 * side of the start (about 1 in 12 is late), clock-out a little after the end,
 * a recorded break on most long shifts (the rest fall back to the automatic
 * break) and an occasional short break on short ones. Today's shifts are
 * worked up to now, so whoever is mid-shift is clocked in or on a break; if
 * fewer than two people are in, a couple of extra-cover sessions keep the
 * presence board alive at any hour. A seeded PRNG keeps it deterministic
 * (relative to the current time).
 */
import { MINUTE, localDate, combine, addDays, iso } from '../lib/time.js';
import { lateness, matchShift, rulesFrom, sessionSpan } from '../lib/attendance.js';
import { mulberry32 } from './seed-history.js';

const ADJUSTMENTS = [
  ['usr_waiter', 50, 'Eid bonus', -38],
  ['usr_chef', 50, 'Eid bonus', -38],
  ['usr_waiter2', -10, 'Broken glassware', -20],
  ['usr_chef2', 25, 'Birthday', -5],
  ['usr_manager', 40, 'Covered two closing shifts', -2],
];

export function seedAttendance({ attendance, payAdjustments, shifts, settings, nextId, now = new Date() }) {
  const rand = mulberry32(20261009);
  const between = (min, max) => min + Math.floor(rand() * (max - min + 1));
  const rules = rulesFrom(settings);
  const nowMs = now.getTime();
  const today = localDate(now);
  const shift = (date, time, offset) => combine(date, time).getTime() + offset * MINUTE;

  function add(userId, shiftRow, clockInMs, clockOutMs, breaks) {
    const clockIn = iso(new Date(clockInMs));
    const { late, lateMinutes } = lateness(shiftRow, clockIn, rules.lateGraceMinutes);
    const session = {
      id: nextId('att'),
      userId,
      date: localDate(new Date(clockInMs)),
      clockIn,
      clockOut: clockOutMs === null ? null : iso(new Date(clockOutMs)),
      breaks: breaks.map(([s, e]) => ({ start: iso(new Date(s)), end: e === null ? null : iso(new Date(e)) })),
      shiftId: shiftRow?.id ?? null,
      late,
      lateMinutes,
    };
    attendance.push(session);
    return session;
  }

  /* --------------------------------------------- past and today's shifts */

  const ordered = shifts
    .filter((s) => s.date <= today)
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));

  for (const s of ordered) {
    // Draw every number up front so each shift consumes the same amount of randomness.
    const lateRoll = rand();
    const offsetIn = lateRoll < 0.08 ? between(8, 28) : between(-12, 4);
    const offsetOut = between(-4, 14);
    const breakRoll = rand();
    const breakAfter = between(150, 240);
    const breakLength = between(20, 45);

    if (s.date < today && s.status === 'missed') continue;

    const clockIn = shift(s.date, s.start, offsetIn);
    const clockOut = shift(s.date, s.end, offsetOut);
    const length = (combine(s.date, s.end) - combine(s.date, s.start)) / MINUTE;
    let breaks = [];
    if (length >= 360 && breakRoll < 0.85) breaks = [[clockIn + breakAfter * MINUTE, clockIn + (breakAfter + breakLength) * MINUTE]];
    else if (length < 360 && breakRoll < 0.3) breaks = [[clockIn + (breakAfter / 2) * MINUTE, clockIn + (breakAfter / 2 + 15) * MINUTE]];

    if (clockIn > nowMs) continue; // today, not started yet
    if (clockOut <= nowMs) {
      add(s.userId, s, clockIn, clockOut, breaks);
      s.status = 'completed';
      continue;
    }
    // Mid-shift right now: clocked in, possibly on a break that has started.
    const started = breaks.filter(([b]) => b <= nowMs).map(([b, e]) => [b, e > nowMs ? null : e]);
    add(s.userId, s, clockIn, null, started);
  }

  /* -------------------------------------- keep the presence board alive */

  const isOpen = (x) => !x.clockOut;
  for (const userId of ['usr_waiter', 'usr_chef', 'usr_waiter2', 'usr_chef2', 'usr_manager']) {
    if (attendance.filter(isOpen).length >= 2) break;
    if (attendance.some((x) => x.userId === userId && isOpen(x))) continue;
    // Start 100 minutes ago, or 15 minutes after their last session ended.
    const lastEnd = Math.max(0, ...attendance.filter((x) => x.userId === userId).map((x) => sessionSpan(x, nowMs)[1]));
    const clockIn = Math.max(nowMs - 100 * MINUTE, lastEnd + 15 * MINUTE);
    if (clockIn > nowMs - 5 * MINUTE) continue;
    add(userId, matchShift(shifts, userId, iso(new Date(clockIn))), clockIn, null, []);
  }
  if (!attendance.some((x) => isOpen(x) && x.breaks.some((b) => !b.end))) {
    const candidate = attendance.find((x) => isOpen(x) && x.breaks.length === 0 && nowMs - Date.parse(x.clockIn) > 60 * MINUTE);
    if (candidate) candidate.breaks.push({ start: iso(new Date(nowMs - 12 * MINUTE)), end: null });
  }

  /* ------------------------------------------------- bonuses and deductions */

  for (const [userId, amount, reason, daysAgo] of ADJUSTMENTS) {
    const date = localDate(addDays(now, daysAgo));
    payAdjustments.push({ id: nextId('adj'), userId, amount, reason, date, createdBy: 'usr_admin', createdAt: iso(combine(date, '09:00')) });
  }
}

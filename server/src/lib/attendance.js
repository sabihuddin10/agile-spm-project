/**
 * Attendance rules (pure functions, no store access).
 *
 * A session is { id, userId, date, clockIn, clockOut|null, breaks: [{ start, end|null }],
 * shiftId|null, late, lateMinutes }. Times are ISO strings; `date` is the local
 * date the session started. Open sessions and open breaks count up to `now`.
 *
 * Breaks are unpaid. A session longer than `autoBreakAfterHours` with no
 * recorded break gets an automatic unpaid break of `autoBreakMinutes`.
 */
import { MINUTE, HOUR, pad, combine, localDate, addDays } from './time.js';

export const DEFAULT_RULES = Object.freeze({
  lateGraceMinutes: 5,
  latePenalty: 5,
  autoBreakMinutes: 60,
  autoBreakAfterHours: 6,
});

/** The rule fields of the settings object, with defaults for any missing. */
export function rulesFrom(settings = {}) {
  const out = {};
  for (const [key, fallback] of Object.entries(DEFAULT_RULES)) {
    out[key] = Number.isFinite(settings[key]) ? settings[key] : fallback;
  }
  return out;
}

const ms = (value) => new Date(value).getTime();
const toNow = (now) => (now instanceof Date ? now.getTime() : now ?? Date.now());

/* ------------------------------------------------------------- one session */

/** [start, end] in ms of the session (open sessions end at now). */
export function sessionSpan(session, now) {
  const start = ms(session.clockIn);
  const end = session.clockOut ? ms(session.clockOut) : toNow(now);
  return [start, Math.max(start, end)];
}

/** Recorded break intervals in ms, clipped to the session. */
export function breakSpans(session, now) {
  const [start, end] = sessionSpan(session, now);
  return (session.breaks || [])
    .map((b) => [Math.max(start, ms(b.start)), Math.min(end, b.end ? ms(b.end) : end)])
    .filter(([s, e]) => e > s);
}

/** Working intervals in ms: the session minus its recorded breaks. */
export function workSpans(session, now) {
  const [start, end] = sessionSpan(session, now);
  const out = [];
  let cursor = start;
  for (const [s, e] of breakSpans(session, now).sort((a, b) => a[0] - b[0])) {
    if (s > cursor) out.push([cursor, s]);
    cursor = Math.max(cursor, e);
  }
  if (end > cursor) out.push([cursor, end]);
  return out;
}

const spanMinutes = (spans) => spans.reduce((sum, [s, e]) => sum + (e - s), 0) / MINUTE;

export function grossMinutes(session, now) {
  const [start, end] = sessionSpan(session, now);
  return Math.round((end - start) / MINUTE);
}

export function recordedBreakMinutes(session, now) {
  return Math.round(spanMinutes(breakSpans(session, now)));
}

/** Automatic unpaid break: only when no break was recorded and the session ran long. */
export function autoBreakMinutes(session, rules, now) {
  const r = rulesFrom(rules);
  if ((session.breaks || []).length > 0) return 0;
  const gross = grossMinutes(session, now);
  if (gross <= r.autoBreakAfterHours * 60) return 0;
  return Math.min(r.autoBreakMinutes, gross);
}

export function paidMinutes(session, rules, now) {
  return Math.max(0, grossMinutes(session, now) - recordedBreakMinutes(session, now) - autoBreakMinutes(session, rules, now));
}

/** The session as the API returns it (AttendanceSession). */
export function serializeSession(session, rules, now) {
  return {
    id: session.id,
    userId: session.userId,
    date: session.date,
    clockIn: session.clockIn,
    clockOut: session.clockOut ?? null,
    breaks: (session.breaks || []).map((b) => ({ start: b.start, end: b.end ?? null })),
    autoBreakMinutes: autoBreakMinutes(session, rules, now),
    shiftId: session.shiftId ?? null,
    late: Boolean(session.late),
    lateMinutes: session.lateMinutes ?? 0,
    paidMinutes: paidMinutes(session, rules, now),
  };
}

/* ----------------------------------------------------------- shifts & late */

const shiftStartMs = (s) => combine(s.date, s.start).getTime();
const shiftEndMs = (s) => combine(s.date, s.end).getTime();
export const shiftMinutes = (s) => Math.round((shiftEndMs(s) - shiftStartMs(s)) / MINUTE);

/** How early a clock-in may be and still count towards a shift. */
export const EARLY_CLOCK_IN_MINUTES = 180;

/**
 * The shift a clock-in belongs to: the user's shift on that local date that has
 * not already ended and starts at most EARLY_CLOCK_IN_MINUTES later, with the
 * start closest to the clock-in. Null when none.
 */
export function matchShift(shifts, userId, clockIn) {
  const at = ms(clockIn);
  const date = localDate(new Date(at));
  const candidates = shifts.filter((s) => s.userId === userId && s.date === date
    && shiftEndMs(s) > at && shiftStartMs(s) - EARLY_CLOCK_IN_MINUTES * MINUTE <= at);
  if (!candidates.length) return null;
  return candidates.reduce((best, s) => (Math.abs(shiftStartMs(s) - at) < Math.abs(shiftStartMs(best) - at) ? s : best));
}

/** Late when the clock-in is more than `graceMinutes` after the shift start. */
export function lateness(shift, clockIn, graceMinutes = DEFAULT_RULES.lateGraceMinutes) {
  if (!shift) return { late: false, lateMinutes: 0 };
  const minutes = Math.floor((ms(clockIn) - shiftStartMs(shift)) / MINUTE);
  return minutes > graceMinutes ? { late: true, lateMinutes: minutes } : { late: false, lateMinutes: 0 };
}

/**
 * scheduled | completed | missed. A shift is completed when a session was
 * matched to it or overlaps it; missed when it has ended with neither.
 */
export function shiftStatus(shift, sessions, now) {
  const start = shiftStartMs(shift);
  const end = shiftEndMs(shift);
  const attended = sessions.some((x) => {
    if (x.userId !== shift.userId) return false;
    if (x.shiftId === shift.id) return true;
    const [s, e] = sessionSpan(x, now);
    return s < end && e > start;
  });
  if (attended) return 'completed';
  return end <= toNow(now) ? 'missed' : 'scheduled';
}

/* ---------------------------------------------------------------- status */

/** Current state of one user from their sessions: off | working | on_break. */
export function currentState(sessions) {
  const open = sessions.find((s) => !s.clockOut);
  if (open) {
    const last = open.breaks?.[open.breaks.length - 1];
    if (last && !last.end) return { state: 'on_break', since: last.start, session: open };
    return { state: 'working', since: last?.end ?? open.clockIn, session: open };
  }
  const latest = sessions.reduce((a, s) => (!a || s.clockOut > a.clockOut ? s : a), null);
  return { state: 'off', since: latest?.clockOut ?? null, session: null };
}

/* --------------------------------------------------------------- summary */

const rate = (part, whole) => (whole > 0 ? Math.round((part / whole) * 1000) / 1000 : 1);

/** WorkSummary for the given sessions and shifts (already filtered to a range). */
export function summarize(sessions, shifts, rules, now, allSessions = sessions) {
  let workedMinutes = 0;
  let breakMinutes = 0;
  let paid = 0;
  let lateCount = 0;
  let lateMinutes = 0;
  for (const s of sessions) {
    workedMinutes += grossMinutes(s, now);
    breakMinutes += recordedBreakMinutes(s, now) + autoBreakMinutes(s, rules, now);
    paid += paidMinutes(s, rules, now);
    if (s.late) {
      lateCount += 1;
      lateMinutes += s.lateMinutes || 0;
    }
  }
  const statuses = shifts.map((sh) => shiftStatus(sh, allSessions, now));
  const shiftsWorked = statuses.filter((x) => x === 'completed').length;
  const shiftsMissed = statuses.filter((x) => x === 'missed').length;
  const onShift = sessions.filter((s) => s.shiftId);
  return {
    scheduledMinutes: shifts.reduce((sum, sh) => sum + shiftMinutes(sh), 0),
    workedMinutes,
    breakMinutes,
    paidMinutes: paid,
    shifts: shifts.length,
    shiftsWorked,
    shiftsMissed,
    lateCount,
    lateMinutes,
    onTimeRate: rate(onShift.filter((s) => !s.late).length, onShift.length),
    attendanceRate: rate(shiftsWorked, shiftsWorked + shiftsMissed),
  };
}

/* ---------------------------------------------------------------- series */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const parseDate = (date) => combine(date, '00:00');

/** ISO-8601 week key, e.g. '2026-W41' (the week-year can differ from the calendar year). */
export function isoWeekKey(date) {
  const [y, m, d] = String(date).split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  const dow = (t.getUTCDay() + 6) % 7; // Monday = 0
  t.setUTCDate(t.getUTCDate() - dow + 3); // Thursday of this week decides the year
  const year = t.getUTCFullYear();
  const week = 1 + Math.floor((t - Date.UTC(year, 0, 1)) / (7 * 24 * HOUR));
  return `${year}-W${pad(week)}`;
}

export const monthKey = (date) => String(date).slice(0, 7);

export function monthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

/** Every date from `from` to `to` inclusive. */
export function datesBetween(from, to) {
  const out = [];
  for (let d = parseDate(from); localDate(d) <= to; d = addDays(d, 1)) out.push(localDate(d));
  return out;
}

const emptyPoint = (key, label) => ({ key, label, scheduledMinutes: 0, paidMinutes: 0, breakMinutes: 0, lateCount: 0 });

/** Add each minute of [s, e) to the hour-of-day it falls in, times `weight`. */
function addByHour(buckets, field, s, e, weight = 1) {
  let cursor = s;
  while (cursor < e) {
    const d = new Date(cursor);
    const next = Math.min(e, new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours() + 1).getTime());
    buckets[d.getHours()][field] += ((next - cursor) / MINUTE) * weight;
    cursor = next;
  }
}

/** Round each point's field to whole minutes so the points still add up to the rounded total. */
function roundKeepingTotal(points, field) {
  const total = Math.round(points.reduce((sum, p) => sum + p[field], 0));
  const floors = points.map((p) => Math.floor(p[field] + 1e-9));
  let left = total - floors.reduce((a, b) => a + b, 0);
  const order = points.map((p, i) => [p[field] - floors[i], i]).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (left <= 0) break;
    floors[i] += 1;
    left -= 1;
  }
  points.forEach((p, i) => { p[field] = floors[i]; });
}

/**
 * Day / ISO week / month series over [from, to], plus 24 hour-of-day points.
 * Sessions bucket by their start date; hour points split each session across
 * the clock hours it covers (an automatic break is spread proportionally).
 */
export function buildSeries(sessions, shifts, from, to, rules, now) {
  const dates = datesBetween(from, to);
  const day = new Map(dates.map((d) => {
    const dt = parseDate(d);
    return [d, emptyPoint(d, `${dt.getDate()} ${MONTHS[dt.getMonth()]}`)];
  }));
  const week = new Map();
  const month = new Map();
  for (const d of dates) {
    const w = isoWeekKey(d);
    if (!week.has(w)) {
      const dt = parseDate(d);
      const monday = addDays(dt, -((dt.getDay() + 6) % 7));
      week.set(w, emptyPoint(w, `w/c ${monday.getDate()} ${MONTHS[monday.getMonth()]}`));
    }
    const m = monthKey(d);
    if (!month.has(m)) month.set(m, emptyPoint(m, monthLabel(m)));
  }
  const hour = Array.from({ length: 24 }, (_, h) => emptyPoint(String(h), `${pad(h)}:00`));

  const add = (date, field, value) => {
    for (const point of [day.get(date), week.get(isoWeekKey(date)), month.get(monthKey(date))]) {
      if (point) point[field] += value;
    }
  };

  for (const sh of shifts) {
    add(sh.date, 'scheduledMinutes', shiftMinutes(sh));
    addByHour(hour, 'scheduledMinutes', shiftStartMs(sh), shiftEndMs(sh));
  }
  for (const s of sessions) {
    const paid = paidMinutes(s, rules, now);
    const auto = autoBreakMinutes(s, rules, now);
    add(s.date, 'paidMinutes', paid);
    add(s.date, 'breakMinutes', recordedBreakMinutes(s, now) + auto);
    if (s.late) add(s.date, 'lateCount', 1);

    const spans = workSpans(s, now);
    const net = spanMinutes(spans);
    const paidShare = net > 0 ? paid / net : 0;
    for (const [a, b] of spans) {
      addByHour(hour, 'paidMinutes', a, b, paidShare);
      addByHour(hour, 'breakMinutes', a, b, 1 - paidShare);
    }
    for (const [a, b] of breakSpans(s, now)) addByHour(hour, 'breakMinutes', a, b);
    if (s.late) hour[new Date(s.clockIn).getHours()].lateCount += 1;
  }
  for (const field of ['scheduledMinutes', 'paidMinutes', 'breakMinutes']) roundKeepingTotal(hour, field);

  return { day: [...day.values()], week: [...week.values()], month: [...month.values()], hour };
}

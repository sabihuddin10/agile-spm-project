/**
 * In-browser demo implementation of the workforce API contract (attendance,
 * presence, hours, pay). `workforceApi` delegates here only when
 * NEXT_PUBLIC_WORKFORCE_MOCK is 'true' (the unit tests set it), so the My work
 * page and the Workforce hub can be clicked through without a server.
 *
 * - History is generated from a seeded PRNG keyed on user + date, so it is
 *   stable across reloads (about 90 days back and two weeks ahead).
 * - Today's shifts are anchored on the first visit of the day so a few
 *   colleagues are working or on a break whenever the demo is opened.
 * - Check in / break / check out by the signed-in user are kept in memory and
 *   saved to localStorage per user; admin wage and bonus edits and the
 *   attendance settings are saved under one shared key.
 * - Visibility rules are enforced exactly as the server will: managers get
 *   `pay: null`, forbidden calls throw an ApiError with status 403, invalid
 *   clock transitions throw 409.
 */
import { ApiError } from '@/lib/api';
import { hourLabel, periodLabel } from '@/components/analytics/analytics-format';
import type {
  AttendanceBreak,
  AttendanceSession,
  AttendanceSettings,
  AttendanceState,
  MyStatus,
  PayAdjustment,
  PayBreakdown,
  PresenceEntry,
  Role,
  SeriesPoint,
  ShiftTime,
  StaffAnalytics,
  StaffRole,
  WorkforceOverview,
  WorkforceOverviewRow,
  WorkSeries,
  WorkShift,
  WorkShiftStatus,
  WorkSummary,
} from '@/types';

/* ------------------------------------------------------------- constants */

export const DEFAULT_ATTENDANCE_SETTINGS: AttendanceSettings = {
  lateGraceMinutes: 5,
  latePenalty: 5,
  autoBreakMinutes: 60,
  autoBreakAfterHours: 6,
};

/** Seed hourly wage per role. */
export const DEFAULT_WAGES: Record<StaffRole, number> = { waiter: 12, chef: 15, manager: 20, admin: 25 };

/** [field, min, max] — validation for the attendance settings (same message format as the server). */
export const ATTENDANCE_SETTING_LIMITS: [keyof AttendanceSettings, number, number][] = [
  ['lateGraceMinutes', 0, 60],
  ['latePenalty', 0, 100],
  ['autoBreakMinutes', 0, 120],
  ['autoBreakAfterHours', 1, 12],
];

export interface MockStaff {
  id: string;
  name: string;
  role: StaffRole;
  active: boolean;
}

/** The demo staff accounts from server/src/data/store.js. */
export const MOCK_STAFF: MockStaff[] = [
  { id: 'usr_admin', name: 'Alex Admin', role: 'admin', active: true },
  { id: 'usr_manager', name: 'Maya Manager', role: 'manager', active: true },
  { id: 'usr_chef', name: 'Carlos Chef', role: 'chef', active: true },
  { id: 'usr_chef2', name: 'Cara Cook', role: 'chef', active: true },
  { id: 'usr_waiter', name: 'Will Waiter', role: 'waiter', active: true },
  { id: 'usr_waiter2', name: 'Wendy Server', role: 'waiter', active: true },
];

/** Who the mock is acting for — the signed-in user. */
export interface MockActor {
  id: string;
  name: string;
  role: Role;
}

export interface ShiftRecord {
  id: string;
  userId: string;
  date: string;
  start: string;
  end: string;
}

export interface SessionRecord {
  id: string;
  userId: string;
  date: string;
  clockIn: string;
  clockOut: string | null;
  breaks: AttendanceBreak[];
  shiftId: string | null;
  /** Seeded record whose times may lie in the future: only the part before "now" is visible. */
  planned?: boolean;
}

export interface AdjustmentRecord extends PayAdjustment {
  userId: string;
}

/* ---------------------------------------------------------- time helpers */

const pad = (n: number) => String(n).padStart(2, '0');
const MS_MIN = 60000;
const round2 = (n: number) => Math.round(n * 100) / 100;

export function dateISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(date: string, n: number): string {
  const d = parseDate(date);
  d.setDate(d.getDate() + n);
  return dateISO(d);
}

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function fromMin(min: number): string {
  const m = Math.max(0, Math.min(23 * 60 + 59, Math.round(min)));
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

/** Local Date for `date` at `minutes` past midnight. */
function at(date: string, minutes: number): Date {
  const d = parseDate(date);
  d.setMinutes(minutes);
  return d;
}

function minutesBetween(a: string | Date, b: string | Date): number {
  return Math.max(0, Math.floor((new Date(b).getTime() - new Date(a).getTime()) / MS_MIN));
}

export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number);
  return { from: `${month}-01`, to: dateISO(new Date(y, m, 0)) };
}

function isValidDate(date: unknown): date is string {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  return dateISO(parseDate(date)) === date;
}

/** ISO-8601 week key, e.g. '2026-W41'. */
export function isoWeekKey(date: string): string {
  const d = parseDate(date);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7)); // Thursday of this week
  const year = d.getFullYear();
  const jan4 = new Date(year, 0, 4);
  const week = 1 + Math.round(((d.getTime() - jan4.getTime()) / 86400000 - 3 + ((jan4.getDay() + 6) % 7)) / 7);
  return `${year}-W${pad(week)}`;
}

function mondayOf(date: string): string {
  const d = parseDate(date);
  return addDays(date, -((d.getDay() + 6) % 7));
}

function shiftMinutes(s: { start: string; end: string }): number {
  return Math.max(0, toMin(s.end) - toMin(s.start));
}

/* -------------------------------------------------------- seeded random */

function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Mulberry32 PRNG seeded from a string: same key, same sequence. */
export function seededRandom(key: string): () => number {
  let a = hashString(`workforce-demo|${key}`);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------- pure computations */

function visibleSession(rec: SessionRecord, now: Date): SessionRecord | null {
  if (!rec.planned) return rec;
  const t = now.getTime();
  if (new Date(rec.clockIn).getTime() > t) return null;
  const clockOut = rec.clockOut && new Date(rec.clockOut).getTime() <= t ? rec.clockOut : null;
  const breaks = rec.breaks
    .filter((b) => new Date(b.start).getTime() <= t)
    .map((b) => ({ start: b.start, end: b.end && new Date(b.end).getTime() <= t ? b.end : null }));
  return { ...rec, clockOut, breaks };
}

function recordedBreakMinutes(breaks: AttendanceBreak[], now: Date): number {
  return breaks.reduce((sum, b) => sum + minutesBetween(b.start, b.end ?? now), 0);
}

/**
 * Derive lateness, automatic break and paid minutes for one session.
 * Paid = (check-out or now − check-in) − breaks; a session longer than
 * `autoBreakAfterHours` with no recorded break loses `autoBreakMinutes`.
 */
export function computeSession(
  rec: SessionRecord,
  shift: Pick<ShiftRecord, 'date' | 'start'> | null | undefined,
  settings: AttendanceSettings,
  now: Date,
): AttendanceSession {
  const end = rec.clockOut ?? now;
  const elapsed = minutesBetween(rec.clockIn, end);
  const recorded = recordedBreakMinutes(rec.breaks, now);
  const autoBreakMinutes =
    rec.breaks.length === 0 && elapsed > settings.autoBreakAfterHours * 60 ? settings.autoBreakMinutes : 0;
  let lateMinutes = 0;
  if (shift) {
    const diff = Math.floor((new Date(rec.clockIn).getTime() - at(shift.date, toMin(shift.start)).getTime()) / MS_MIN);
    if (diff > settings.lateGraceMinutes) lateMinutes = diff;
  }
  return {
    id: rec.id,
    userId: rec.userId,
    date: rec.date,
    clockIn: rec.clockIn,
    clockOut: rec.clockOut,
    breaks: rec.breaks.map((b) => ({ ...b })),
    autoBreakMinutes,
    shiftId: rec.shiftId,
    late: lateMinutes > 0,
    lateMinutes,
    paidMinutes: Math.max(0, elapsed - recorded - autoBreakMinutes),
  };
}

/** Recorded + automatic break minutes of a computed session. */
export function sessionBreakMinutes(s: AttendanceSession, now: Date): number {
  return recordedBreakMinutes(s.breaks, now) + s.autoBreakMinutes;
}

/** A shift is completed once someone checked in against it, missed once it has ended without a session. */
export function shiftStatus(shift: ShiftRecord, hasSession: boolean, now: Date): WorkShiftStatus {
  if (hasSession) return 'completed';
  return at(shift.date, toMin(shift.end)).getTime() < now.getTime() ? 'missed' : 'scheduled';
}

export function summarize(shifts: WorkShift[], sessions: AttendanceSession[], now: Date): WorkSummary {
  const shiftsWorked = shifts.filter((s) => s.status === 'completed').length;
  const shiftsMissed = shifts.filter((s) => s.status === 'missed').length;
  const paidMinutes = sessions.reduce((sum, s) => sum + s.paidMinutes, 0);
  const breakMinutes = sessions.reduce((sum, s) => sum + sessionBreakMinutes(s, now), 0);
  const late = sessions.filter((s) => s.late);
  return {
    scheduledMinutes: shifts.reduce((sum, s) => sum + shiftMinutes(s), 0),
    workedMinutes: paidMinutes + breakMinutes,
    breakMinutes,
    paidMinutes,
    shifts: shifts.length,
    shiftsWorked,
    shiftsMissed,
    lateCount: late.length,
    lateMinutes: late.reduce((sum, s) => sum + s.lateMinutes, 0),
    onTimeRate: sessions.length ? (sessions.length - late.length) / sessions.length : 0,
    attendanceRate: shiftsWorked + shiftsMissed ? shiftsWorked / (shiftsWorked + shiftsMissed) : 0,
  };
}

const emptyPoint = (key: string, label: string): SeriesPoint => ({
  key,
  label,
  scheduledMinutes: 0,
  paidMinutes: 0,
  breakMinutes: 0,
  lateCount: 0,
});

/** Minutes of [a, b) falling in each hour of the day, added into `into`. */
function spreadByHour(a: Date, b: Date, into: number[], weight = 1) {
  let t = a.getTime();
  const end = b.getTime();
  while (t < end) {
    const d = new Date(t);
    const nextHour = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours() + 1).getTime();
    const stop = Math.min(nextHour, end);
    into[d.getHours()] += ((stop - t) / MS_MIN) * weight;
    t = stop;
  }
}

/** Day, ISO-week, month and hour-of-day buckets for [from, to]. */
export function buildSeries(from: string, to: string, shifts: WorkShift[], sessions: AttendanceSession[], now: Date): WorkSeries {
  const day = new Map<string, SeriesPoint>();
  const week = new Map<string, SeriesPoint>();
  const month = new Map<string, SeriesPoint>();
  for (let d = from; d <= to; d = addDays(d, 1)) {
    day.set(d, emptyPoint(d, periodLabel(d, 'day')));
    const monday = mondayOf(d);
    const wk = isoWeekKey(d);
    if (!week.has(wk)) week.set(wk, emptyPoint(wk, periodLabel(monday, 'week')));
    const mk = d.slice(0, 7);
    if (!month.has(mk)) month.set(mk, emptyPoint(mk, periodLabel(`${mk}-01`, 'month')));
  }
  const buckets = (date: string) => [day.get(date), week.get(isoWeekKey(date)), month.get(date.slice(0, 7))];

  const hourPaid = new Array<number>(24).fill(0);
  const hourScheduled = new Array<number>(24).fill(0);
  const hourBreak = new Array<number>(24).fill(0);
  const hourLate = new Array<number>(24).fill(0);

  for (const s of shifts) {
    for (const p of buckets(s.date)) if (p) p.scheduledMinutes += shiftMinutes(s);
    spreadByHour(at(s.date, toMin(s.start)), at(s.date, toMin(s.end)), hourScheduled);
  }
  for (const s of sessions) {
    const breaks = sessionBreakMinutes(s, now);
    for (const p of buckets(s.date)) {
      if (!p) continue;
      p.paidMinutes += s.paidMinutes;
      p.breakMinutes += breaks;
      if (s.late) p.lateCount += 1;
    }
    // Hour of day: worked time minus recorded breaks, scaled down for an automatic break.
    const start = new Date(s.clockIn);
    const end = new Date(s.clockOut ?? now);
    const worked = new Array<number>(24).fill(0);
    spreadByHour(start, end, worked);
    const breakHours = new Array<number>(24).fill(0);
    for (const b of s.breaks) spreadByHour(new Date(b.start), new Date(b.end ?? now), breakHours);
    const net = worked.map((m, h) => Math.max(0, m - breakHours[h]));
    const netTotal = net.reduce((a, b) => a + b, 0);
    const scale = netTotal > 0 ? s.paidMinutes / netTotal : 0;
    net.forEach((m, h) => {
      hourPaid[h] += m * scale;
      hourBreak[h] += breakHours[h];
    });
    if (s.autoBreakMinutes) {
      const mid = new Date((start.getTime() + end.getTime()) / 2);
      hourBreak[mid.getHours()] += s.autoBreakMinutes;
    }
    if (s.late) hourLate[start.getHours()] += 1;
  }

  const hour = Array.from({ length: 24 }, (_, h) => ({
    key: String(h),
    label: hourLabel(h),
    scheduledMinutes: Math.round(hourScheduled[h]),
    paidMinutes: Math.round(hourPaid[h]),
    breakMinutes: Math.round(hourBreak[h]),
    lateCount: hourLate[h],
  }));
  return { day: Array.from(day.values()), week: Array.from(week.values()), month: Array.from(month.values()), hour };
}

/** Point-wise sum of several series with identical buckets. */
export function sumSeries(list: Pick<WorkSeries, 'day' | 'week' | 'hour'>[]): Pick<WorkSeries, 'day' | 'week' | 'hour'> {
  const sum = (key: 'day' | 'week' | 'hour'): SeriesPoint[] => {
    if (list.length === 0) return [];
    return list[0][key].map((p, i) =>
      list.reduce<SeriesPoint>(
        (acc, s) => ({
          ...acc,
          scheduledMinutes: acc.scheduledMinutes + (s[key][i]?.scheduledMinutes ?? 0),
          paidMinutes: acc.paidMinutes + (s[key][i]?.paidMinutes ?? 0),
          breakMinutes: acc.breakMinutes + (s[key][i]?.breakMinutes ?? 0),
          lateCount: acc.lateCount + (s[key][i]?.lateCount ?? 0),
        }),
        emptyPoint(p.key, p.label),
      ),
    );
  };
  return { day: sum('day'), week: sum('week'), hour: sum('hour') };
}

/**
 * Monthly pay: paid hours × hourly wage + tips + bonuses − late penalties.
 * Estimated until the month has ended.
 */
export function computePay(input: {
  month: string;
  hourlyWage: number;
  sessions: AttendanceSession[];
  tips: { date: string; amount: number }[];
  adjustments: PayAdjustment[];
  settings: AttendanceSettings;
  today: string;
}): PayBreakdown {
  const { month, hourlyWage, settings } = input;
  const inMonth = (date: string) => date.startsWith(`${month}-`);
  const sessions = input.sessions.filter((s) => inMonth(s.date));
  const paidMinutes = sessions.reduce((sum, s) => sum + s.paidMinutes, 0);
  const base = round2((paidMinutes / 60) * hourlyWage);
  const tips = round2(input.tips.filter((t) => inMonth(t.date)).reduce((sum, t) => sum + t.amount, 0));
  const bonuses = input.adjustments
    .filter((a) => inMonth(a.date))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((a) => ({ id: a.id, amount: a.amount, reason: a.reason, date: a.date }));
  const bonusTotal = round2(bonuses.reduce((sum, a) => sum + a.amount, 0));
  const latePenalties = sessions
    .filter((s) => s.late)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((s) => ({ date: s.date, minutes: s.lateMinutes, amount: settings.latePenalty }));
  const latePenaltyTotal = round2(latePenalties.reduce((sum, p) => sum + p.amount, 0));
  return {
    month,
    hourlyWage,
    paidHours: round2(paidMinutes / 60),
    base,
    tips,
    bonuses,
    bonusTotal,
    latePenalties,
    latePenaltyTotal,
    net: round2(base + tips + bonusTotal - latePenaltyTotal),
    estimated: input.today <= monthRange(month).to,
  };
}

/* ----------------------------------------------------------------- seeding */

/** Weekdays off per demo user (0 = Sunday). */
const DAYS_OFF: Record<string, number[]> = {
  usr_admin: [0, 6],
  usr_manager: [0, 1],
  usr_chef: [1, 2],
  usr_chef2: [3, 4],
  usr_waiter: [2, 3],
  usr_waiter2: [4, 5],
};

/** Shift templates per role: [start, end]. Long ones (over 6 h) can trigger the automatic break. */
const TEMPLATES: Record<StaffRole, [string, string][]> = {
  waiter: [
    ['11:00', '16:00'],
    ['17:00', '23:00'],
    ['12:00', '20:00'],
  ],
  chef: [
    ['10:00', '18:00'],
    ['15:00', '23:00'],
    ['09:00', '15:00'],
  ],
  manager: [
    ['09:00', '17:00'],
    ['14:00', '22:00'],
  ],
  admin: [
    ['09:00', '15:00'],
    ['10:00', '18:00'],
  ],
};

const HISTORY_DAYS = 90;
const FUTURE_DAYS = 14;

interface Seeded {
  shifts: ShiftRecord[];
  sessions: SessionRecord[];
  tips: Map<string, number>;
}

/** A planned session for `shift`, with occasional lateness and recorded or missing breaks. */
function plannedSession(shift: ShiftRecord, rand: () => number, forceLate?: boolean): SessionRecord {
  const start = toMin(shift.start);
  const end = toMin(shift.end);
  const late = forceLate ?? rand() < 0.11;
  const inMin = late ? start + 6 + Math.floor(rand() * 22) : start - 12 + Math.floor(rand() * 16);
  const outMin = Math.min(23 * 60 + 59, end - 6 + Math.floor(rand() * 22));
  const dur = outMin - inMin;
  const breaks: AttendanceBreak[] = [];
  if (dur > 360) {
    if (rand() < 0.78) {
      const len = 30 + Math.floor(rand() * 4) * 5;
      const bStart = inMin + Math.floor(dur / 2) - 15;
      breaks.push({ start: at(shift.date, bStart).toISOString(), end: at(shift.date, bStart + len).toISOString() });
    }
  } else if (dur >= 240 && rand() < 0.35) {
    const bStart = inMin + Math.floor(dur / 2);
    breaks.push({ start: at(shift.date, bStart).toISOString(), end: at(shift.date, bStart + 15).toISOString() });
  }
  return {
    id: `ses_${shift.userId}_${shift.date}`,
    userId: shift.userId,
    date: shift.date,
    clockIn: at(shift.date, inMin).toISOString(),
    clockOut: at(shift.date, outMin).toISOString(),
    breaks,
    shiftId: shift.id,
    planned: true,
  };
}

/**
 * Deterministic history for one user. `anchor` is the minute of day the demo
 * was first opened today; today's shifts are placed around it so presence looks
 * alive. The signed-in user (`isSelf`) always has a shift today, starting at the
 * anchor's half hour, and no seeded session so they can check in themselves.
 */
export function seedUser(staff: MockStaff, today: string, anchor: number, isSelf: boolean): Seeded {
  const shifts: ShiftRecord[] = [];
  const sessions: SessionRecord[] = [];
  const tips = new Map<string, number>();
  const off = DAYS_OFF[staff.id] ?? [0, 6];
  const templates = TEMPLATES[staff.role];

  for (let i = -HISTORY_DAYS; i <= FUTURE_DAYS; i++) {
    const date = addDays(today, i);
    const rand = seededRandom(`${staff.id}|${date}`);
    const dayOff = off.includes(parseDate(date).getDay()) || rand() < 0.06;
    const [tStart, tEnd] = templates[Math.floor(rand() * templates.length)];
    const id = `shf_${staff.id}_${date}`;

    if (date === today) {
      const half = Math.floor(anchor / 30) * 30;
      const length = shiftMinutes({ start: tStart, end: tEnd });
      if (isSelf) {
        shifts.push({ id, userId: staff.id, date, start: fromMin(half), end: fromMin(half + length) });
        continue;
      }
      if (dayOff) continue;
      const roll = rand();
      let start: number;
      if (roll < 0.7) start = Math.max(0, half - 30 * (1 + Math.floor(rand() * 6))); // started 0.5–3 h ago
      else start = Math.min(22 * 60, half + 60 + 30 * Math.floor(rand() * 4)); // later today
      const shift = { id, userId: staff.id, date, start: fromMin(start), end: fromMin(start + length) };
      shifts.push(shift);
      const session = plannedSession(shift, rand);
      // Some of those already working are on a break right now.
      if (roll < 0.7 && rand() < 0.4 && anchor - 8 > toMin(shift.start) + 30) {
        session.breaks = [{ start: at(date, anchor - 8).toISOString(), end: at(date, anchor + 22).toISOString() }];
      }
      sessions.push(session);
      continue;
    }

    if (dayOff) continue;
    const shift = { id, userId: staff.id, date, start: tStart, end: tEnd };
    shifts.push(shift);
    if (date > today) continue;
    if (rand() < 0.045) continue; // missed shift
    sessions.push(plannedSession(shift, rand));
    if (staff.role === 'waiter') {
      const dinner = toMin(tEnd) >= 22 * 60;
      tips.set(date, round2((22 + rand() * 50) * (dinner ? 1.35 : 1)));
    }
  }
  return { shifts, sessions, tips };
}

/** A couple of demo bonuses and one correction, relative to today. */
function seedAdjustments(today: string): AdjustmentRecord[] {
  const month = today.slice(0, 7);
  const lastMonth = addDays(`${month}-01`, -1).slice(0, 7);
  const clampToToday = (d: string) => (d > today ? today : d);
  return [
    { id: 'adj_seed_1', userId: 'usr_waiter', amount: 50, reason: 'Eid bonus', date: clampToToday(`${month}-02`) },
    { id: 'adj_seed_2', userId: 'usr_chef', amount: 50, reason: 'Eid bonus', date: clampToToday(`${month}-02`) },
    { id: 'adj_seed_3', userId: 'usr_waiter2', amount: 25, reason: 'Birthday', date: clampToToday(`${month}-05`) },
    { id: 'adj_seed_4', userId: 'usr_chef2', amount: 40, reason: 'Covered a double shift', date: `${lastMonth}-18` },
    { id: 'adj_seed_5', userId: 'usr_chef2', amount: -15, reason: 'Correction: overpaid tips', date: `${lastMonth}-20` },
    { id: 'adj_seed_6', userId: 'usr_manager', amount: 100, reason: 'Quarterly bonus', date: `${lastMonth}-28` },
  ];
}

/* ---------------------------------------------------------- persistence */

const KEY = 'workforce-mock:v1';
const sessionsKey = (userId: string) => `${KEY}:sessions:${userId}`;

interface SharedState {
  wages?: Record<string, number>;
  adjustments?: AdjustmentRecord[];
  settings?: AttendanceSettings;
}

function readJSON<T>(storage: Storage | null, key: string): T | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJSON(storage: Storage | null, key: string, value: unknown) {
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode or quota: the demo keeps working in memory */
  }
}

function defaultStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------- the mock */

interface Db {
  selfId: string | null;
  today: string;
  staff: MockStaff[];
  wages: Record<string, number>;
  shifts: ShiftRecord[];
  sessions: SessionRecord[];
  tips: Map<string, number>;
  adjustments: AdjustmentRecord[];
  settings: AttendanceSettings;
}

export interface WorkforceMockOptions {
  /** Clock used for "now" (tests pin it). */
  now?: () => Date;
  /** Storage for click-through persistence; null disables it. Defaults to localStorage. */
  storage?: Storage | null;
  /** Simulated latency [min, max] in ms. Defaults to 150–300 ms (0 under test). */
  latencyMs?: [number, number];
}

const STAFF_ROLES: StaffRole[] = ['waiter', 'chef', 'manager', 'admin'];

function isStaffRole(role: Role): role is StaffRole {
  return (STAFF_ROLES as Role[]).includes(role);
}

/** Roles whose presence each role may see. */
const PRESENCE_SCOPE: Record<StaffRole, StaffRole[]> = {
  waiter: ['waiter'],
  chef: ['chef'],
  manager: ['manager', 'waiter', 'chef'],
  admin: ['admin', 'manager', 'chef', 'waiter'],
};

export function createWorkforceMock(options: WorkforceMockOptions = {}) {
  const now = options.now ?? (() => new Date());
  const storage = options.storage === undefined ? defaultStorage() : options.storage;
  const latency =
    options.latencyMs ?? (typeof process !== 'undefined' && process.env.NODE_ENV === 'test' ? [0, 0] : [150, 300]);
  let db: Db | null = null;
  let idCounter = 0;

  async function delay() {
    const [min, max] = latency;
    if (max <= 0) return;
    await new Promise((r) => setTimeout(r, min + Math.random() * (max - min)));
  }

  function anchorFor(today: string): number {
    const saved = readJSON<{ date: string; minute: number }>(storage, `${KEY}:anchor`);
    if (saved && saved.date === today) return saved.minute;
    const n = now();
    const minute = n.getHours() * 60 + n.getMinutes();
    writeJSON(storage, `${KEY}:anchor`, { date: today, minute });
    return minute;
  }

  function build(actor: MockActor | null): Db {
    const today = dateISO(now());
    const anchor = anchorFor(today);
    const selfId = actor?.id ?? null;
    const staff = [...MOCK_STAFF];
    if (actor && isStaffRole(actor.role) && !staff.some((s) => s.id === actor.id)) {
      staff.push({ id: actor.id, name: actor.name, role: actor.role, active: true });
    }
    const shared = readJSON<SharedState>(storage, `${KEY}:shared`) ?? {};
    const shifts: ShiftRecord[] = [];
    const sessions: SessionRecord[] = [];
    const tips = new Map<string, number>();
    for (const s of staff) {
      const seeded = seedUser(s, today, anchor, s.id === selfId);
      // Sessions the user recorded themselves replace the seeded ones for those dates.
      const own = readJSON<SessionRecord[]>(storage, sessionsKey(s.id)) ?? [];
      const ownDates = new Set(own.map((r) => r.date));
      shifts.push(...seeded.shifts);
      sessions.push(...seeded.sessions.filter((r) => !ownDates.has(r.date)), ...own);
      seeded.tips.forEach((amount, date) => tips.set(`${s.id}|${date}`, amount));
    }
    const wages: Record<string, number> = {};
    for (const s of staff) wages[s.id] = shared.wages?.[s.id] ?? DEFAULT_WAGES[s.role];
    return {
      selfId,
      today,
      staff,
      wages,
      shifts,
      sessions,
      tips,
      adjustments: shared.adjustments ?? seedAdjustments(today),
      settings: { ...DEFAULT_ATTENDANCE_SETTINGS, ...shared.settings },
    };
  }

  function getDb(actor: MockActor | null): Db {
    const today = dateISO(now());
    if (!db || db.today !== today || db.selfId !== (actor?.id ?? null)) db = build(actor);
    return db;
  }

  function saveShared(d: Db) {
    writeJSON(storage, `${KEY}:shared`, { wages: d.wages, adjustments: d.adjustments, settings: d.settings } satisfies SharedState);
  }

  function saveOwnSessions(d: Db, userId: string) {
    writeJSON(
      storage,
      sessionsKey(userId),
      d.sessions.filter((s) => s.userId === userId && !s.planned),
    );
  }

  function requireStaff(actor: MockActor | null): MockActor & { role: StaffRole } {
    if (!actor) throw new ApiError('Please sign in.', 401, { error: 'Please sign in.' });
    if (!isStaffRole(actor.role)) throw new ApiError('Staff only.', 403, { error: 'Staff only.' });
    return actor as MockActor & { role: StaffRole };
  }

  function forbid(message: string): never {
    throw new ApiError(message, 403, { error: message });
  }

  function fail(status: number, message: string): never {
    throw new ApiError(message, status, { error: message });
  }

  /* ---- per-user views */

  function userSessions(d: Db, userId: string): AttendanceSession[] {
    const n = now();
    const shiftById = new Map(d.shifts.map((s) => [s.id, s]));
    return d.sessions
      .filter((s) => s.userId === userId)
      .map((s) => visibleSession(s, n))
      .filter((s): s is SessionRecord => s !== null)
      .map((s) => computeSession(s, s.shiftId ? shiftById.get(s.shiftId) : null, d.settings, n))
      .sort((a, b) => b.clockIn.localeCompare(a.clockIn));
  }

  function userShifts(d: Db, userId: string, sessions: AttendanceSession[]): WorkShift[] {
    const n = now();
    const worked = new Set(sessions.map((s) => s.shiftId));
    return d.shifts
      .filter((s) => s.userId === userId)
      .map((s) => ({ id: s.id, date: s.date, start: s.start, end: s.end, status: shiftStatus(s, worked.has(s.id), n) }))
      .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
  }

  function todayShiftOf(d: Db, userId: string): ShiftRecord | null {
    const list = d.shifts.filter((s) => s.userId === userId && s.date === d.today).sort((a, b) => a.start.localeCompare(b.start));
    if (list.length === 0) return null;
    const nowMin = now().getHours() * 60 + now().getMinutes();
    return list.find((s) => toMin(s.end) > nowMin) ?? list[list.length - 1];
  }

  function stateOf(d: Db, userId: string): { state: AttendanceState; since: string | null; session: AttendanceSession | null } {
    const sessions = userSessions(d, userId);
    const open = sessions.find((s) => s.clockOut === null);
    if (open) {
      const brk = open.breaks.find((b) => b.end === null);
      return brk ? { state: 'on_break', since: brk.start, session: open } : { state: 'working', since: open.clockIn, session: open };
    }
    const todays = sessions.find((s) => s.date === d.today) ?? null;
    return { state: 'off', since: todays?.clockOut ?? null, session: todays };
  }

  function shiftTime(s: ShiftRecord | null): ShiftTime | null {
    return s ? { start: s.start, end: s.end } : null;
  }

  function myStatus(d: Db, userId: string): MyStatus {
    const { state, since, session } = stateOf(d, userId);
    return { state, since, session, todayShift: shiftTime(todayShiftOf(d, userId)) };
  }

  function payFor(d: Db, userId: string, month: string, sessions: AttendanceSession[]): PayBreakdown {
    const tips: { date: string; amount: number }[] = [];
    d.tips.forEach((amount, key) => {
      const [uid, date] = key.split('|');
      if (uid !== userId) return;
      // Tips land once the shift's session has closed.
      if (sessions.some((s) => s.date === date && s.clockOut)) tips.push({ date, amount });
    });
    return computePay({
      month,
      hourlyWage: d.wages[userId] ?? 0,
      sessions,
      tips,
      adjustments: d.adjustments.filter((a) => a.userId === userId),
      settings: d.settings,
      today: d.today,
    });
  }

  function analytics(d: Db, staff: MockStaff, from: string, to: string, withPay: boolean): StaffAnalytics {
    const n = now();
    const all = userSessions(d, staff.id);
    const shifts = userShifts(d, staff.id, all);
    const inRange = (date: string) => date >= from && date <= to;
    const sessions = all.filter((s) => inRange(s.date));
    const rangeShifts = shifts.filter((s) => inRange(s.date));
    return {
      user: { id: staff.id, name: staff.name, role: staff.role },
      range: { from, to },
      summary: summarize(rangeShifts, sessions, n),
      series: buildSeries(from, to, rangeShifts, sessions, n),
      sessions,
      shifts: rangeShifts,
      pay: withPay ? payFor(d, staff.id, to.slice(0, 7), all) : null,
    };
  }

  function resolveRange(d: Db, from?: string, to?: string): { from: string; to: string } {
    const end = to ?? d.today;
    const start = from ?? `${end.slice(0, 7)}-01`;
    if (!isValidDate(start) || !isValidDate(end)) fail(400, 'from and to must be dates (YYYY-MM-DD).');
    if (start > end) fail(400, 'from must be on or before to.');
    return { from: start, to: end };
  }

  /* ---- clock transitions */

  function newId(prefix: string) {
    idCounter += 1;
    return `${prefix}_${Date.now().toString(36)}${idCounter}`;
  }

  function openRecord(d: Db, userId: string): SessionRecord | null {
    const n = now();
    for (const rec of d.sessions) {
      if (rec.userId !== userId) continue;
      const view = visibleSession(rec, n);
      if (view && view.clockOut === null) return rec;
    }
    return null;
  }

  /** Freeze a seeded record at "now" so it can be edited like a real one. */
  function own(rec: SessionRecord): SessionRecord {
    if (!rec.planned) return rec;
    const view = visibleSession(rec, now()) as SessionRecord;
    rec.clockOut = view.clockOut;
    rec.breaks = view.breaks;
    delete rec.planned;
    return rec;
  }

  function transition(actor: MockActor | null, action: 'clock-in' | 'clock-out' | 'break/start' | 'break/end'): MyStatus {
    const me = requireStaff(actor);
    const d = getDb(me);
    const iso = now().toISOString();
    const open = openRecord(d, me.id);
    const openBreak = open ? visibleSession(open, now())?.breaks.find((b) => b.end === null) : undefined;

    if (action === 'clock-in') {
      if (open) fail(409, 'You are already checked in.');
      const shift = todayShiftOf(d, me.id);
      d.sessions.push({ id: newId('ses'), userId: me.id, date: d.today, clockIn: iso, clockOut: null, breaks: [], shiftId: shift?.id ?? null });
    } else if (action === 'clock-out') {
      if (!open) fail(409, 'You are not checked in.');
      // Like the server: an open break ends with the session.
      const rec = own(open);
      const b = rec.breaks.find((x) => x.end === null);
      if (b) b.end = iso;
      rec.clockOut = iso;
    } else if (action === 'break/start') {
      if (!open) fail(409, 'Check in before starting a break.');
      if (openBreak) fail(409, 'You are already on a break.');
      own(open).breaks.push({ start: iso, end: null });
    } else {
      if (!open || !openBreak) fail(409, 'You are not on a break.');
      const rec = own(open);
      const b = rec.breaks.find((x) => x.end === null);
      if (b) b.end = iso;
    }
    saveOwnSessions(d, me.id);
    return myStatus(d, me.id);
  }

  function findStaff(d: Db, id: string): MockStaff {
    const s = d.staff.find((x) => x.id === id);
    if (!s) fail(404, 'Staff member not found.');
    return s;
  }

  function requireAdmin(actor: MockActor | null) {
    const me = requireStaff(actor);
    if (me.role !== 'admin') forbid('Only admins can change pay.');
    return me;
  }

  /* ---- public API (mirrors the HTTP contract) */

  return {
    async attendanceMe(actor: MockActor | null): Promise<MyStatus> {
      await delay();
      const me = requireStaff(actor);
      return myStatus(getDb(me), me.id);
    },
    async clockIn(actor: MockActor | null) {
      await delay();
      return transition(actor, 'clock-in');
    },
    async clockOut(actor: MockActor | null) {
      await delay();
      return transition(actor, 'clock-out');
    },
    async startBreak(actor: MockActor | null) {
      await delay();
      return transition(actor, 'break/start');
    },
    async endBreak(actor: MockActor | null) {
      await delay();
      return transition(actor, 'break/end');
    },

    async presence(actor: MockActor | null): Promise<{ people: PresenceEntry[] }> {
      await delay();
      const me = requireStaff(actor);
      const d = getDb(me);
      const scope = PRESENCE_SCOPE[me.role];
      const people = d.staff
        .filter((s) => s.active && scope.includes(s.role))
        .map((s) => {
          const { state, since } = stateOf(d, s.id);
          return { userId: s.id, name: s.name, role: s.role, state, since, todayShift: shiftTime(todayShiftOf(d, s.id)) };
        });
      return { people };
    },

    async workforceMe(actor: MockActor | null, params: { from?: string; to?: string } = {}): Promise<StaffAnalytics> {
      await delay();
      const me = requireStaff(actor);
      const d = getDb(me);
      const { from, to } = resolveRange(d, params.from, params.to);
      return analytics(d, findStaff(d, me.id), from, to, true);
    },

    async workforceUser(actor: MockActor | null, id: string, params: { from?: string; to?: string } = {}): Promise<StaffAnalytics> {
      await delay();
      const me = requireStaff(actor);
      const d = getDb(me);
      const target = findStaff(d, id);
      let withPay = true;
      if (me.role === 'admin' || me.id === id) withPay = true;
      else if (me.role === 'manager' && (target.role === 'waiter' || target.role === 'chef')) withPay = false;
      else forbid("You can't view this person's work record.");
      const { from, to } = resolveRange(d, params.from, params.to);
      return analytics(d, target, from, to, withPay);
    },

    async overview(actor: MockActor | null, month?: string): Promise<WorkforceOverview> {
      await delay();
      const me = requireStaff(actor);
      if (me.role !== 'admin' && me.role !== 'manager') forbid('Only managers and admins can view the workforce overview.');
      const d = getDb(me);
      const m = month ?? d.today.slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(m) || !isValidDate(`${m}-01`)) fail(400, 'month must be YYYY-MM.');
      const { from, to } = monthRange(m);
      const isAdmin = me.role === 'admin';
      const visible = d.staff.filter((s) => (isAdmin ? true : s.role === 'waiter' || s.role === 'chef'));
      const all = visible.map((s) => ({ s, a: analytics(d, s, from, to, isAdmin) }));
      const rows: WorkforceOverviewRow[] = all.map(({ s, a }) => ({
        user: { id: s.id, name: s.name, role: s.role, active: s.active },
        state: stateOf(d, s.id).state,
        summary: a.summary,
        pay: a.pay,
      }));
      return {
        month: m,
        rows,
        totals: {
          paidMinutes: rows.reduce((sum, r) => sum + r.summary.paidMinutes, 0),
          lateCount: rows.reduce((sum, r) => sum + r.summary.lateCount, 0),
          payroll: isAdmin ? round2(rows.reduce((sum, r) => sum + (r.pay?.net ?? 0), 0)) : null,
        },
        series: sumSeries(all.map(({ a }) => a.series)),
      };
    },

    async setWage(actor: MockActor | null, id: string, hourlyWage: number): Promise<{ hourlyWage: number }> {
      await delay();
      const me = requireAdmin(actor);
      const d = getDb(me);
      findStaff(d, id);
      if (typeof hourlyWage !== 'number' || !Number.isFinite(hourlyWage) || hourlyWage <= 0 || hourlyWage > 500) {
        fail(400, 'hourlyWage must be between 0 and 500.');
      }
      d.wages[id] = round2(hourlyWage);
      saveShared(d);
      return { hourlyWage: d.wages[id] };
    },

    async addAdjustment(
      actor: MockActor | null,
      id: string,
      input: { amount: number; reason: string; date: string },
    ): Promise<{ adjustment: PayAdjustment }> {
      await delay();
      const me = requireAdmin(actor);
      const d = getDb(me);
      findStaff(d, id);
      const amount = Number(input.amount);
      if (!Number.isFinite(amount) || amount === 0 || Math.abs(amount) > 10000) fail(400, 'amount must be a non-zero number up to 10000.');
      const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
      if (!reason) fail(400, 'reason cannot be empty.');
      if (reason.length > 200) fail(400, 'The reason can be at most 200 characters.');
      if (!isValidDate(input.date)) fail(400, 'date must be YYYY-MM-DD.');
      const adjustment: AdjustmentRecord = { id: newId('adj'), userId: id, amount: round2(amount), reason, date: input.date };
      d.adjustments.push(adjustment);
      saveShared(d);
      const { userId: _userId, ...rest } = adjustment;
      return { adjustment: rest };
    },

    async removeAdjustment(actor: MockActor | null, id: string, adjId: string): Promise<{ deleted: boolean }> {
      await delay();
      const me = requireAdmin(actor);
      const d = getDb(me);
      const idx = d.adjustments.findIndex((a) => a.id === adjId && a.userId === id);
      if (idx < 0) fail(404, 'Adjustment not found.');
      d.adjustments.splice(idx, 1);
      saveShared(d);
      return { deleted: true };
    },

    async getSettings(actor: MockActor | null): Promise<AttendanceSettings> {
      await delay();
      return { ...getDb(actor).settings };
    },

    async updateSettings(actor: MockActor | null, patch: Partial<AttendanceSettings>): Promise<AttendanceSettings> {
      await delay();
      const me = requireStaff(actor);
      if (me.role !== 'manager' && me.role !== 'admin') forbid('Only managers and admins can change settings.');
      const d = getDb(me);
      const next = { ...d.settings };
      for (const [field, min, max] of ATTENDANCE_SETTING_LIMITS) {
        const raw = patch[field];
        if (raw === undefined) continue;
        const value = Number(raw);
        if (!(Number.isFinite(value) && value >= min && value <= max)) fail(400, `${field} must be between ${min} and ${max}.`);
        next[field] = value;
      }
      d.settings = next;
      saveShared(d);
      return { ...next };
    },

    /** Forget in-memory state (the next call rebuilds from seed + storage). */
    reset() {
      db = null;
    },
  };
}

export type WorkforceMock = ReturnType<typeof createWorkforceMock>;

/**
 * Tests for src/lib/workforce-mock.ts — the in-browser demo of the workforce
 * API: pay/attendance computations, visibility rules and clock transitions.
 * The clock is pinned through the mock's `now` option. Arrange-Act-Assert.
 */
import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api';
import {
  DEFAULT_ATTENDANCE_SETTINGS,
  computePay,
  computeSession,
  createWorkforceMock,
  isoWeekKey,
  shiftStatus,
  summarize,
  type MockActor,
  type SessionRecord,
} from '@/lib/workforce-mock';
import type { AttendanceSession, WorkShift } from '@/types';

const S = DEFAULT_ATTENDANCE_SETTINGS;
const at = (h: number, m = 0, day = 9) => new Date(2026, 9, day, h, m).toISOString();
const NOW = new Date(2026, 9, 9, 14, 3);

const ACTORS: Record<string, MockActor> = {
  admin: { id: 'usr_admin', name: 'Alex Admin', role: 'admin' },
  manager: { id: 'usr_manager', name: 'Maya Manager', role: 'manager' },
  chef: { id: 'usr_chef', name: 'Carlos Chef', role: 'chef' },
  waiter: { id: 'usr_waiter', name: 'Will Waiter', role: 'waiter' },
};

function rec(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return { id: 's1', userId: 'u1', date: '2026-10-09', clockIn: at(10), clockOut: at(18), breaks: [], shiftId: 'sh1', ...overrides };
}

function session(overrides: Partial<AttendanceSession> = {}): AttendanceSession {
  return {
    id: 's1',
    userId: 'u1',
    date: '2026-10-05',
    clockIn: at(10, 0, 5),
    clockOut: at(15, 0, 5),
    breaks: [],
    autoBreakMinutes: 0,
    shiftId: null,
    late: false,
    lateMinutes: 0,
    paidMinutes: 300,
    ...overrides,
  };
}

/** Minimal in-memory Storage for persistence tests. */
function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => Array.from(map.keys())[i] ?? null,
    removeItem: (k) => void map.delete(k),
    setItem: (k, v) => void map.set(k, String(v)),
  };
}

function mock(now: () => Date = () => NOW, storage: Storage | null = null) {
  return createWorkforceMock({ now, storage, latencyMs: [0, 0] });
}

async function expectApiError(promise: Promise<unknown>, status: number) {
  const err = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(ApiError);
  expect((err as ApiError).status).toBe(status);
  return err as ApiError;
}

describe('computeSession', () => {
  const shift = { date: '2026-10-09', start: '10:00' };

  it('subtracts a recorded break from paid minutes and applies no automatic break', () => {
    // Arrange
    const r = rec({ breaks: [{ start: at(13), end: at(13, 30) }] });

    // Act
    const s = computeSession(r, shift, S, NOW);

    // Assert
    expect(s.autoBreakMinutes).toBe(0);
    expect(s.paidMinutes).toBe(8 * 60 - 30);
  });

  it('deducts the automatic unpaid break from a session over 6 h with no recorded break', () => {
    // Arrange
    const long = rec();
    const sixHours = rec({ clockOut: at(16) });

    // Act
    const a = computeSession(long, shift, S, NOW);
    const b = computeSession(sixHours, shift, S, NOW);

    // Assert
    expect(a.autoBreakMinutes).toBe(60);
    expect(a.paidMinutes).toBe(8 * 60 - 60);
    expect(b.autoBreakMinutes).toBe(0);
    expect(b.paidMinutes).toBe(6 * 60);
  });

  it('marks a check-in late only beyond the grace period and records the minutes late', () => {
    // Arrange
    const withinGrace = rec({ clockIn: at(10, 5) });
    const late = rec({ clockIn: at(10, 12) });

    // Act
    const a = computeSession(withinGrace, shift, S, NOW);
    const b = computeSession(late, shift, S, NOW);

    // Assert
    expect(a.late).toBe(false);
    expect(b.late).toBe(true);
    expect(b.lateMinutes).toBe(12);
  });

  it('counts an open session and an open break up to now', () => {
    // Arrange
    const r = rec({ clockIn: at(10), clockOut: null, breaks: [{ start: at(14), end: null }] });

    // Act
    const s = computeSession(r, shift, S, NOW); // now 14:03

    // Assert
    expect(s.paidMinutes).toBe(4 * 60); // 243 elapsed − 3 on break
  });
});

describe('shiftStatus and summarize', () => {
  it('treats a past shift without a session as missed and a future one as scheduled', () => {
    // Arrange
    const past = { id: 'a', userId: 'u', date: '2026-10-08', start: '10:00', end: '16:00' };
    const later = { id: 'b', userId: 'u', date: '2026-10-09', start: '17:00', end: '23:00' };

    // Act / Assert
    expect(shiftStatus(past, false, NOW)).toBe('missed');
    expect(shiftStatus(past, true, NOW)).toBe('completed');
    expect(shiftStatus(later, false, NOW)).toBe('scheduled');
  });

  it('summarises hours, lateness and the on-time and attendance rates', () => {
    // Arrange
    const shifts: WorkShift[] = [
      { id: 'a', date: '2026-10-05', start: '10:00', end: '15:00', status: 'completed' },
      { id: 'b', date: '2026-10-06', start: '10:00', end: '15:00', status: 'completed' },
      { id: 'c', date: '2026-10-07', start: '10:00', end: '15:00', status: 'missed' },
      { id: 'd', date: '2026-10-20', start: '10:00', end: '15:00', status: 'scheduled' },
    ];
    const sessions = [session(), session({ id: 's2', date: '2026-10-06', late: true, lateMinutes: 9, paidMinutes: 280 })];

    // Act
    const sum = summarize(shifts, sessions, NOW);

    // Assert
    expect(sum).toMatchObject({
      scheduledMinutes: 4 * 300,
      paidMinutes: 580,
      shifts: 4,
      shiftsWorked: 2,
      shiftsMissed: 1,
      lateCount: 1,
      lateMinutes: 9,
      onTimeRate: 0.5,
    });
    expect(sum.attendanceRate).toBeCloseTo(2 / 3);
  });

  it('keys weeks by ISO week number', () => {
    // Arrange / Act / Assert
    expect(isoWeekKey('2026-10-08')).toBe('2026-W41');
    expect(isoWeekKey('2027-01-01')).toBe('2026-W53');
  });
});

describe('computePay', () => {
  it('is paid hours × wage + tips + bonuses − late penalties, estimated until the month ends', () => {
    // Arrange
    const sessions = [
      session({ paidMinutes: 300 }),
      session({ id: 's2', date: '2026-10-06', paidMinutes: 300, late: true, lateMinutes: 12 }),
      session({ id: 's3', date: '2026-10-07', paidMinutes: 0, late: true, lateMinutes: 7 }),
      session({ id: 's4', date: '2026-09-30', paidMinutes: 480 }), // other month
    ];
    const input = {
      month: '2026-10',
      hourlyWage: 12,
      sessions,
      tips: [
        { date: '2026-10-05', amount: 30.5 },
        { date: '2026-10-06', amount: 20 },
        { date: '2026-09-30', amount: 99 },
      ],
      adjustments: [
        { id: 'b1', amount: 50, reason: 'Eid bonus', date: '2026-10-02' },
        { id: 'b2', amount: -15, reason: 'Correction', date: '2026-10-03' },
        { id: 'b3', amount: 25, reason: 'Birthday', date: '2026-09-12' },
      ],
      settings: S,
    };

    // Act
    const pay = computePay({ ...input, today: '2026-10-09' });
    const closed = computePay({ ...input, today: '2026-11-01' });

    // Assert
    expect(pay.paidHours).toBe(10);
    expect(pay.base).toBe(120);
    expect(pay.tips).toBe(50.5);
    expect(pay.bonuses.map((b) => b.reason)).toEqual(['Eid bonus', 'Correction']);
    expect(pay.bonusTotal).toBe(35);
    expect(pay.latePenalties).toEqual([
      { date: '2026-10-06', minutes: 12, amount: 5 },
      { date: '2026-10-07', minutes: 7, amount: 5 },
    ]);
    expect(pay.latePenaltyTotal).toBe(10);
    expect(pay.net).toBe(120 + 50.5 + 35 - 10);
    expect(pay.estimated).toBe(true);
    expect(closed.estimated).toBe(false);
  });
});

describe('visibility', () => {
  it('gives managers waiter and chef records with pay: null and forbids them admins', async () => {
    // Arrange
    const m = mock();

    // Act
    const waiter = await m.workforceUser(ACTORS.manager, 'usr_waiter');
    const forbidden = m.workforceUser(ACTORS.manager, 'usr_admin');

    // Assert
    expect(waiter.user.name).toBe('Will Waiter');
    expect(waiter.pay).toBeNull();
    expect(waiter.summary.paidMinutes).toBeGreaterThan(0);
    await expectApiError(forbidden, 403);
  });

  it("forbids a waiter from anyone else's record and the overview, but shows their own pay", async () => {
    // Arrange
    const m = mock();

    // Act
    const own = await m.workforceMe(ACTORS.waiter, { from: '2026-10-01', to: '2026-10-31' });

    // Assert
    await expectApiError(m.workforceUser(ACTORS.waiter, 'usr_waiter2'), 403);
    await expectApiError(m.overview(ACTORS.waiter, '2026-10'), 403);
    expect(own.pay).not.toBeNull();
    expect(own.pay?.hourlyWage).toBe(12);
    expect(own.pay?.estimated).toBe(true);
  });

  it('shows managers only waiters and chefs in the overview, without any money', async () => {
    // Arrange
    const m = mock();

    // Act
    const o = await m.overview(ACTORS.manager, '2026-10');

    // Assert
    expect(o.rows.map((r) => r.user.role).sort()).toEqual(['chef', 'chef', 'waiter', 'waiter']);
    expect(o.rows.every((r) => r.pay === null)).toBe(true);
    expect(o.totals.payroll).toBeNull();
  });

  it('shows admins everyone with pay, and payroll is the sum of net pay', async () => {
    // Arrange
    const m = mock();

    // Act
    const o = await m.overview(ACTORS.admin, '2026-10');

    // Assert
    expect(o.rows).toHaveLength(6);
    const sum = o.rows.reduce((s, r) => s + (r.pay?.net ?? 0), 0);
    expect(o.totals.payroll).toBeCloseTo(sum, 2);
    expect(o.series.hour).toHaveLength(24);
  });

  it('scopes presence by role', async () => {
    // Arrange
    const m = mock();
    const rolesSeenBy = async (a: MockActor) => Array.from(new Set((await m.presence(a)).people.map((p) => p.role))).sort();

    // Act / Assert
    expect(await rolesSeenBy(ACTORS.waiter)).toEqual(['waiter']);
    expect(await rolesSeenBy(ACTORS.chef)).toEqual(['chef']);
    expect(await rolesSeenBy(ACTORS.manager)).toEqual(['chef', 'manager', 'waiter']);
    expect((await m.presence(ACTORS.admin)).people).toHaveLength(6);
  });

  it('lets only admins change wages and bonuses, and pay reflects the change', async () => {
    // Arrange
    const m = mock();

    // Act
    await m.setWage(ACTORS.admin, 'usr_waiter', 14);
    const { adjustment } = await m.addAdjustment(ACTORS.admin, 'usr_waiter', { amount: 30, reason: 'Birthday', date: '2026-10-08' });
    const after = await m.workforceUser(ACTORS.admin, 'usr_waiter', { from: '2026-10-01', to: '2026-10-31' });

    // Assert
    await expectApiError(m.setWage(ACTORS.manager, 'usr_waiter', 99), 403);
    expect(after.pay?.hourlyWage).toBe(14);
    expect(after.pay?.bonuses.some((b) => b.id === adjustment.id && b.amount === 30)).toBe(true);
    await m.removeAdjustment(ACTORS.admin, 'usr_waiter', adjustment.id);
    const removed = await m.workforceUser(ACTORS.admin, 'usr_waiter', { from: '2026-10-01', to: '2026-10-31' });
    expect(removed.pay?.bonuses.some((b) => b.id === adjustment.id)).toBe(false);
  });
});

describe('demo data', () => {
  it('is deterministic and covers missed shifts, lateness, auto breaks and waiter tips', async () => {
    // Arrange
    const a = mock();
    const b = mock();
    const range = { from: '2026-07-11', to: '2026-10-08' };

    // Act
    const runs = await Promise.all(
      ['usr_waiter', 'usr_waiter2', 'usr_chef', 'usr_chef2'].map((id) => a.workforceUser(ACTORS.admin, id, range)),
    );
    const again = await b.workforceUser(ACTORS.admin, 'usr_waiter', range);

    // Assert
    expect(again).toEqual(runs[0]);
    const all = runs.flatMap((r) => r.sessions);
    expect(runs.reduce((s, r) => s + r.summary.shiftsMissed, 0)).toBeGreaterThan(0);
    expect(all.some((s) => s.late)).toBe(true);
    expect(all.some((s) => s.autoBreakMinutes > 0)).toBe(true);
    expect(all.some((s) => s.breaks.length > 0)).toBe(true);
    expect(runs[0].pay?.tips).toBeGreaterThan(0);
    expect(runs[2].pay?.tips).toBe(0);
  });

  it('has colleagues working or on a break right now', async () => {
    // Arrange
    const m = mock();

    // Act
    const { people } = await m.presence(ACTORS.admin);

    // Assert
    expect(people.filter((p) => p.userId !== 'usr_admin' && p.state !== 'off').length).toBeGreaterThan(0);
  });
});

describe('clock transitions', () => {
  it('walks check in → break → check out and rejects invalid transitions with 409', async () => {
    // Arrange
    let now = new Date(NOW);
    const m = mock(() => now);
    const me = ACTORS.waiter;

    // Act / Assert
    expect((await m.attendanceMe(me)).state).toBe('off');
    expect((await m.clockIn(me)).state).toBe('working');
    await expectApiError(m.clockIn(me), 409);
    now = new Date(2026, 9, 9, 16, 0);
    expect((await m.startBreak(me)).state).toBe('on_break');
    const err = await expectApiError(m.clockOut(me), 409);
    expect(err.message).toMatch(/break/i);
    now = new Date(2026, 9, 9, 16, 30);
    expect((await m.endBreak(me)).state).toBe('working');
    now = new Date(2026, 9, 9, 18, 3);
    const out = await m.clockOut(me);
    expect(out.state).toBe('off');
    expect(out.session?.paidMinutes).toBe(4 * 60 - 30);
    await expectApiError(m.endBreak(me), 409);
  });

  it('marks a check-in after the grace period as late against today\'s shift', async () => {
    // Arrange — the demo shift starts on the half hour before the first visit (14:00).
    const m = mock(() => new Date(2026, 9, 9, 14, 20));

    // Act
    const s = await m.clockIn(ACTORS.chef);

    // Assert
    expect(s.todayShift?.start).toBe('14:00');
    expect(s.session?.late).toBe(true);
    expect(s.session?.lateMinutes).toBe(20);
  });

  it('persists clock actions per user so a reload keeps the state', async () => {
    // Arrange
    const storage = memoryStorage();
    await mock(() => NOW, storage).clockIn(ACTORS.waiter);

    // Act
    const reloaded = await mock(() => new Date(2026, 9, 9, 15, 0), storage).attendanceMe(ACTORS.waiter);

    // Assert
    expect(reloaded.state).toBe('working');
    expect(reloaded.since).toBe(NOW.toISOString());
  });

  it('rejects calls from signed-out users and customers', async () => {
    // Arrange
    const m = mock();

    // Act / Assert
    await expectApiError(m.attendanceMe(null), 401);
    await expectApiError(m.attendanceMe({ id: 'usr_customer', name: 'Casey', role: 'customer' }), 403);
  });
});

describe('attendance settings', () => {
  it('validates ranges with the server message format and applies new values', async () => {
    // Arrange
    const m = mock();

    // Act
    const bad = await expectApiError(m.updateSettings(ACTORS.manager, { lateGraceMinutes: 90 }), 400);
    const saved = await m.updateSettings(ACTORS.manager, { latePenalty: 7.5 });

    // Assert
    expect(bad.message).toBe('lateGraceMinutes must be between 0 and 60.');
    expect(saved.latePenalty).toBe(7.5);
    await expectApiError(m.updateSettings(ACTORS.waiter, { latePenalty: 1 }), 403);
  });
});

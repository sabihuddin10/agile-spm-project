import type {
  AttendanceSettings,
  MyStatus,
  PayAdjustment,
  PresenceEntry,
  Settings,
  StaffAnalytics,
  User,
  WorkforceOverview,
} from '@/types';
import { api, settingsApi } from '@/lib/api';
import { DEFAULT_ATTENDANCE_SETTINGS } from '@/lib/attendance-defaults';
// Type only: erased at compile time, so it cannot pull the mock module into a bundle.
import type { WorkforceMock } from '@/lib/workforce-mock';

/**
 * Attendance, presence, hours and pay. Pages and components call only this.
 *
 * Calls go to the server's /api/attendance/* and /api/workforce/*. Set
 * NEXT_PUBLIC_WORKFORCE_MOCK=true to use the in-browser demo instead
 * (`workforce-mock.ts`); the unit tests do. Only the exact value `true` enables it; anything else
 * (unset, `TRUE`, `1`, a typo) selects the real API.
 *
 * The mock is loaded lazily and only in mock mode, so a production build contains neither the mock
 * module nor its demo seed data. See getWorkforceMock() for how that is guaranteed.
 */
export const WORKFORCE_MOCK = process.env.NEXT_PUBLIC_WORKFORCE_MOCK === 'true';

let mockInstance: Promise<WorkforceMock> | undefined;

/**
 * The in-browser demo, created once and shared by the adapter and the tests (`.reset()`).
 *
 * The comparison below is deliberately written out in full inside the `if`: Next replaces
 * `process.env.NEXT_PUBLIC_*` with its literal value at build time, so in a production build the
 * condition is the constant `"false" === "true"` and the bundler drops the whole branch, including
 * the `import()`. The mock module is then never discovered, so it never ships. Do not hoist the
 * comparison into a variable or move the import out of the branch: that would put the mock back
 * into the production bundle (`pnpm --dir frontend run check:bundle` fails the build if it does).
 */
export function getWorkforceMock(): Promise<WorkforceMock> {
  if (process.env.NEXT_PUBLIC_WORKFORCE_MOCK === 'true') {
    mockInstance ??= import('@/lib/workforce-mock').then(
      (mod) => mod.createWorkforceMock(),
      (err: unknown) => {
        mockInstance = undefined;
        const reason = err instanceof Error ? err.message : String(err);
        throw new Error(`Could not load the workforce mock (NEXT_PUBLIC_WORKFORCE_MOCK=true): ${reason}`);
      },
    );
    return mockInstance;
  }
  return Promise.reject(new Error('The workforce mock is only available when NEXT_PUBLIC_WORKFORCE_MOCK=true.'));
}

/** Runs `use` against the mock once it has loaded. */
const viaMock = <T>(use: (mock: WorkforceMock) => T | Promise<T>): Promise<T> => getWorkforceMock().then(use);

let mockUser: User | null = null;

export function setWorkforceMockUser(user: User | null) {
  if (WORKFORCE_MOCK) mockUser = user;
}

const actor = () => mockUser;

function qs(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter((e): e is [string, string] => Boolean(e[1]));
  return entries.length ? `?${new URLSearchParams(entries).toString()}` : '';
}

const ATTENDANCE_KEYS = Object.keys(DEFAULT_ATTENDANCE_SETTINGS) as (keyof AttendanceSettings)[];

function pickAttendance(s: Partial<Settings>): AttendanceSettings {
  const out = { ...DEFAULT_ATTENDANCE_SETTINGS };
  for (const k of ATTENDANCE_KEYS) {
    const v = s[k];
    if (typeof v === 'number') out[k] = v;
  }
  return out;
}

export interface RangeParams {
  from?: string;
  to?: string;
}

export const workforceApi = {
  /* attendance */
  me: (): Promise<MyStatus> => (WORKFORCE_MOCK ? viaMock((m) => m.attendanceMe(actor())) : api<MyStatus>('/attendance/me')),
  clockIn: (): Promise<MyStatus> =>
    WORKFORCE_MOCK ? viaMock((m) => m.clockIn(actor())) : api<MyStatus>('/attendance/clock-in', { method: 'POST' }),
  clockOut: (): Promise<MyStatus> =>
    WORKFORCE_MOCK ? viaMock((m) => m.clockOut(actor())) : api<MyStatus>('/attendance/clock-out', { method: 'POST' }),
  startBreak: (): Promise<MyStatus> =>
    WORKFORCE_MOCK ? viaMock((m) => m.startBreak(actor())) : api<MyStatus>('/attendance/break/start', { method: 'POST' }),
  endBreak: (): Promise<MyStatus> =>
    WORKFORCE_MOCK ? viaMock((m) => m.endBreak(actor())) : api<MyStatus>('/attendance/break/end', { method: 'POST' }),
  presence: (): Promise<{ people: PresenceEntry[] }> =>
    WORKFORCE_MOCK ? viaMock((m) => m.presence(actor())) : api<{ people: PresenceEntry[] }>('/attendance/presence'),

  /* hours, analytics and pay */
  myAnalytics: (params: RangeParams = {}): Promise<StaffAnalytics> =>
    WORKFORCE_MOCK ? viaMock((m) => m.workforceMe(actor(), params)) : api<StaffAnalytics>(`/workforce/me${qs({ ...params })}`),
  userAnalytics: (id: string, params: RangeParams = {}): Promise<StaffAnalytics> =>
    WORKFORCE_MOCK
      ? viaMock((m) => m.workforceUser(actor(), id, params))
      : api<StaffAnalytics>(`/workforce/users/${encodeURIComponent(id)}${qs({ ...params })}`),
  overview: (month?: string): Promise<WorkforceOverview> =>
    WORKFORCE_MOCK ? viaMock((m) => m.overview(actor(), month)) : api<WorkforceOverview>(`/workforce/overview${qs({ month })}`),

  /* admin pay controls */
  setWage: (id: string, hourlyWage: number): Promise<{ hourlyWage: number }> =>
    WORKFORCE_MOCK
      ? viaMock((m) => m.setWage(actor(), id, hourlyWage))
      : api<{ hourlyWage: number }>(`/workforce/users/${encodeURIComponent(id)}/wage`, { method: 'PUT', body: { hourlyWage } }),
  addAdjustment: (id: string, input: { amount: number; reason: string; date: string }): Promise<{ adjustment: PayAdjustment }> =>
    WORKFORCE_MOCK
      ? viaMock((m) => m.addAdjustment(actor(), id, input))
      : api<{ adjustment: PayAdjustment }>(`/workforce/users/${encodeURIComponent(id)}/adjustments`, { method: 'POST', body: input }),
  removeAdjustment: (id: string, adjId: string): Promise<unknown> =>
    WORKFORCE_MOCK
      ? viaMock((m) => m.removeAdjustment(actor(), id, adjId))
      : api(`/workforce/users/${encodeURIComponent(id)}/adjustments/${encodeURIComponent(adjId)}`, { method: 'DELETE' }),

  /* attendance & pay settings (part of /api/settings on the server) */
  getSettings: async (): Promise<AttendanceSettings> => {
    if (WORKFORCE_MOCK) return viaMock((m) => m.getSettings(actor()));
    const { settings } = await settingsApi.get();
    return pickAttendance(settings);
  },
  updateSettings: async (patch: Partial<AttendanceSettings>): Promise<AttendanceSettings> => {
    if (WORKFORCE_MOCK) return viaMock((m) => m.updateSettings(actor(), patch));
    const { settings } = await settingsApi.update(patch);
    return pickAttendance(settings);
  },
};

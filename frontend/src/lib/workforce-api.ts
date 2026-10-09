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
import { api, getStoredUser, settingsApi } from '@/lib/api';
import { createWorkforceMock, DEFAULT_ATTENDANCE_SETTINGS } from '@/lib/workforce-mock';

/**
 * Attendance, presence, hours and pay. Pages and components call only this.
 *
 * Calls go to the server's /api/attendance/* and /api/workforce/*. Set
 * NEXT_PUBLIC_WORKFORCE_MOCK=true to use the in-browser demo instead
 * (`workforce-mock.ts`); the unit tests do.
 */
export const WORKFORCE_MOCK = process.env.NEXT_PUBLIC_WORKFORCE_MOCK === 'true';

export const workforceMock = createWorkforceMock();

/** The signed-in user, as the auth context stored it. */
function actor() {
  return getStoredUser<User>();
}

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
  me: (): Promise<MyStatus> => (WORKFORCE_MOCK ? workforceMock.attendanceMe(actor()) : api<MyStatus>('/attendance/me')),
  clockIn: (): Promise<MyStatus> =>
    WORKFORCE_MOCK ? workforceMock.clockIn(actor()) : api<MyStatus>('/attendance/clock-in', { method: 'POST' }),
  clockOut: (): Promise<MyStatus> =>
    WORKFORCE_MOCK ? workforceMock.clockOut(actor()) : api<MyStatus>('/attendance/clock-out', { method: 'POST' }),
  startBreak: (): Promise<MyStatus> =>
    WORKFORCE_MOCK ? workforceMock.startBreak(actor()) : api<MyStatus>('/attendance/break/start', { method: 'POST' }),
  endBreak: (): Promise<MyStatus> =>
    WORKFORCE_MOCK ? workforceMock.endBreak(actor()) : api<MyStatus>('/attendance/break/end', { method: 'POST' }),
  presence: (): Promise<{ people: PresenceEntry[] }> =>
    WORKFORCE_MOCK ? workforceMock.presence(actor()) : api<{ people: PresenceEntry[] }>('/attendance/presence'),

  /* hours, analytics and pay */
  myAnalytics: (params: RangeParams = {}): Promise<StaffAnalytics> =>
    WORKFORCE_MOCK ? workforceMock.workforceMe(actor(), params) : api<StaffAnalytics>(`/workforce/me${qs({ ...params })}`),
  userAnalytics: (id: string, params: RangeParams = {}): Promise<StaffAnalytics> =>
    WORKFORCE_MOCK
      ? workforceMock.workforceUser(actor(), id, params)
      : api<StaffAnalytics>(`/workforce/users/${encodeURIComponent(id)}${qs({ ...params })}`),
  overview: (month?: string): Promise<WorkforceOverview> =>
    WORKFORCE_MOCK ? workforceMock.overview(actor(), month) : api<WorkforceOverview>(`/workforce/overview${qs({ month })}`),

  /* admin pay controls */
  setWage: (id: string, hourlyWage: number): Promise<{ hourlyWage: number }> =>
    WORKFORCE_MOCK
      ? workforceMock.setWage(actor(), id, hourlyWage)
      : api<{ hourlyWage: number }>(`/workforce/users/${encodeURIComponent(id)}/wage`, { method: 'PUT', body: { hourlyWage } }),
  addAdjustment: (id: string, input: { amount: number; reason: string; date: string }): Promise<{ adjustment: PayAdjustment }> =>
    WORKFORCE_MOCK
      ? workforceMock.addAdjustment(actor(), id, input)
      : api<{ adjustment: PayAdjustment }>(`/workforce/users/${encodeURIComponent(id)}/adjustments`, { method: 'POST', body: input }),
  removeAdjustment: (id: string, adjId: string): Promise<unknown> =>
    WORKFORCE_MOCK
      ? workforceMock.removeAdjustment(actor(), id, adjId)
      : api(`/workforce/users/${encodeURIComponent(id)}/adjustments/${encodeURIComponent(adjId)}`, { method: 'DELETE' }),

  /* attendance & pay settings (part of /api/settings on the server) */
  getSettings: async (): Promise<AttendanceSettings> => {
    if (WORKFORCE_MOCK) return workforceMock.getSettings(actor());
    const { settings } = await settingsApi.get();
    return pickAttendance(settings);
  },
  updateSettings: async (patch: Partial<AttendanceSettings>): Promise<AttendanceSettings> => {
    if (WORKFORCE_MOCK) return workforceMock.updateSettings(actor(), patch);
    const { settings } = await settingsApi.update(patch);
    return pickAttendance(settings);
  },
};

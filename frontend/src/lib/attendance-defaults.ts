import type { AttendanceSettings } from '@/types';

/**
 * Attendance and pay settings defaults. Real screens (the settings form, the time clock, the workforce
 * API adapter) need these, so they live here and not in workforce-mock.ts: importing the mock module
 * would pull the whole demo layer into the production bundle.
 */
export const DEFAULT_ATTENDANCE_SETTINGS: AttendanceSettings = {
  lateGraceMinutes: 5,
  latePenalty: 5,
  autoBreakMinutes: 60,
  autoBreakAfterHours: 6,
};

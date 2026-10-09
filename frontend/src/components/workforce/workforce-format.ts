import type { AttendanceState, StaffAnalytics, WorkShift } from '@/types';
import type { Tone } from '@/lib/format';
import { localDateISO } from '@/lib/format';

const pad = (n: number) => String(n).padStart(2, '0');

/** What each attendance state looks like. Colour is reserved for state. */
export const STATE_META: Record<AttendanceState, { label: string; tone: Tone; dot: string }> = {
  working: { label: 'Working', tone: 'emerald', dot: 'bg-emerald-500' },
  on_break: { label: 'On break', tone: 'amber', dot: 'bg-amber-500' },
  off: { label: 'Off', tone: 'stone', dot: 'bg-stone-300' },
};

/** 24-hour clock time of an ISO timestamp: '14:05'. */
export function clockTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Minutes → hours with one decimal: 450 → '7.5 h'. */
export function hoursText(minutes: number): string {
  return `${Math.round((minutes / 60) * 10) / 10} h`;
}

/** Elapsed milliseconds as 'H:MM:SS'. */
export function elapsedText(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 3600)}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

/** Spoken form for screen readers: '1 hour 5 minutes'. */
export function elapsedSpoken(ms: number): string {
  const mins = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const parts = [];
  if (h) parts.push(`${h} hour${h === 1 ? '' : 's'}`);
  parts.push(`${m} minute${m === 1 ? '' : 's'}`);
  return parts.join(' ');
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** '2026-10' → 'October 2026'. */
export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

/** Current month as 'YYYY-MM'. */
export function currentMonth(now: Date = new Date()): string {
  return localDateISO(now).slice(0, 7);
}

/** The current month and the `count - 1` before it, newest first. */
export function recentMonths(count = 4, now: Date = new Date()): string[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return localDateISO(d).slice(0, 7);
  });
}

/** First and last day of a month. */
export function monthBounds(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number);
  return { from: `${month}-01`, to: localDateISO(new Date(y, m, 0)) };
}

/** Three months ending with `month` (for the week and month trend charts). */
export function trendBounds(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number);
  return { from: localDateISO(new Date(y, m - 3, 1)), to: monthBounds(month).to };
}

/** Length of a 'HH:MM'–'HH:MM' shift in minutes. */
export function shiftMinutes(s: { start: string; end: string }): number {
  const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  return Math.max(0, toMin(s.end) - toMin(s.start));
}

/** Minutes of scheduled shifts still ahead (status 'scheduled'). */
export function remainingScheduledMinutes(shifts: WorkShift[]): number {
  return shifts.filter((s) => s.status === 'scheduled').reduce((sum, s) => sum + shiftMinutes(s), 0);
}

/** Missed shift minutes (scheduled but never worked, unpaid). */
export function missedMinutes(shifts: WorkShift[]): number {
  return shifts.filter((s) => s.status === 'missed').reduce((sum, s) => sum + shiftMinutes(s), 0);
}

/** Pay so far plus the remaining scheduled hours at the hourly wage. */
export function projectedPay(data: Pick<StaffAnalytics, 'pay' | 'shifts'>): number | null {
  const pay = data.pay;
  if (!pay) return null;
  const remaining = remainingScheduledMinutes(data.shifts.filter((s) => s.date.startsWith(pay.month)));
  return Math.round((pay.net + (remaining / 60) * pay.hourlyWage) * 100) / 100;
}

/** 0.873 → '87%'. */
export function ratePct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

/** Signed money for adjustments: '+$50.00', '−$15.00'. */
export function signedMoney(amount: number): string {
  return `${amount < 0 ? '−' : '+'}$${Math.abs(amount).toFixed(2)}`;
}

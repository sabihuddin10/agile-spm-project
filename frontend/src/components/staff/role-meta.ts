import type { Role, StaffRole } from '@/types';
import type { Tone } from '@/lib/format';

/** Display order for roles across the staff-management screens. */
export const ROLE_ORDER: Role[] = ['admin', 'manager', 'chef', 'waiter', 'customer'];

export const STAFF_ROLE_ORDER: StaffRole[] = ['admin', 'manager', 'chef', 'waiter'];

export const ROLE_META: Record<Role, { label: string; plural: string; tone: Tone }> = {
  admin: { label: 'Admin', plural: 'Admins', tone: 'brand' },
  manager: { label: 'Manager', plural: 'Managers', tone: 'blue' },
  chef: { label: 'Chef', plural: 'Chefs', tone: 'amber' },
  waiter: { label: 'Waiter', plural: 'Waiters', tone: 'emerald' },
  customer: { label: 'Customer', plural: 'Customers', tone: 'stone' },
};

export function roleRank(role: Role | null | undefined): number {
  const i = role ? ROLE_ORDER.indexOf(role) : -1;
  return i === -1 ? ROLE_ORDER.length : i;
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/** 'HH:MM' → minutes since midnight. */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Hours between two 'HH:MM' times (0 if the end is not after the start). */
export function hoursBetween(start: string, end: string): number {
  if (!start || !end) return 0;
  return Math.max(0, Math.round(((timeToMinutes(end) - timeToMinutes(start)) / 60) * 10) / 10);
}

/** Monday of the week containing `d`, as 'YYYY-MM-DD' (mirrors the server's weekStart). */
export function mondayOf(d: Date = new Date()): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  out.setDate(out.getDate() - ((out.getDay() + 6) % 7));
  return out;
}

/** 'YYYY-MM-DD' → local Date at midnight. */
export function parseISODate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** 1 → '1 h', 4.5 → '4.5 h'. */
export function formatHours(hours: number): string {
  return `${Math.round(hours * 10) / 10} h`;
}

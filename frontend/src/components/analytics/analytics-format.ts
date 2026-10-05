import type { Granularity } from '@/types';

/** '$12,901.61' — thousands-separated money for KPI tiles and tables. */
export function currency(amount: number): string {
  return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

/** '$12.9k' — compact money for chart axes. */
export function compactCurrency(amount: number): string {
  if (Math.abs(amount) >= 1000) return `$${(amount / 1000).toFixed(amount >= 10000 ? 0 : 1)}k`;
  return `$${Math.round(amount)}`;
}

/** '1,284'. */
export function count(n: number): string {
  return n.toLocaleString('en-US');
}

/** Server percentages are already 0–100 with one decimal: 14.4 → '14.4%'. */
export function pct(value: number): string {
  return `${Number.isInteger(value) ? value : value.toFixed(1)}%`;
}

function parseISO(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

// Fixed English names so labels read '29 Sep' everywhere (ICU's en-GB now prints 'Sept').
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const mon = (d: Date) => MONTHS[d.getMonth()].slice(0, 3);
const dayMonth = (d: Date) => `${d.getDate()} ${mon(d)}`;

/** '5 Oct 2026'. */
export function longDate(date: string): string {
  const d = parseISO(date);
  return `${dayMonth(d)} ${d.getFullYear()}`;
}

/** Axis label for a trend bucket: '5 Oct', 'w/c 29 Sep', 'Oct 2026'. */
export function periodLabel(period: string, granularity: Granularity): string {
  const d = parseISO(period);
  if (granularity === 'month') return `${mon(d)} ${d.getFullYear()}`;
  if (granularity === 'week') return `w/c ${dayMonth(d)}`;
  return dayMonth(d);
}

/**
 * Tooltip / table label for a trend bucket, flagging buckets the selected range
 * only partly covers (e.g. a week that starts before `from`).
 */
export function periodLongLabel(period: string, granularity: Granularity, from: string, to: string): string {
  const start = parseISO(period);
  if (granularity === 'day') return `${WEEKDAYS[start.getDay()]} ${longDate(period)}`;
  const end = new Date(start);
  if (granularity === 'week') end.setDate(end.getDate() + 6);
  else end.setMonth(end.getMonth() + 1, 0);
  const partial = start < parseISO(from) || end > parseISO(to);
  const label =
    granularity === 'week' ? `Week commencing ${longDate(period)}` : `${MONTHS[start.getMonth()]} ${start.getFullYear()}`;
  return partial ? `${label} (partial)` : label;
}

/** 19 → '19:00'. */
export function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

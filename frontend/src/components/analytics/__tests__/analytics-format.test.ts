import { describe, expect, it } from 'vitest';
import { compactCurrency, count, currency, hourLabel, longDate, pct, periodLabel, periodLongLabel } from '@/components/analytics/analytics-format';

describe('currency / compactCurrency / count / pct', () => {
  it('formats full currency with thousands separators', () => {
    expect(currency(12901.6)).toBe('$12,901.60');
  });

  it('compacts large amounts to a "k" suffix', () => {
    expect(compactCurrency(12900)).toBe('$13k');
    expect(compactCurrency(9500)).toBe('$9.5k');
    expect(compactCurrency(42)).toBe('$42');
  });

  it('formats counts with thousands separators', () => {
    expect(count(1284)).toBe('1,284');
  });

  it('shows one decimal only for non-integer percentages', () => {
    expect(pct(14.44)).toBe('14.4%');
    expect(pct(20)).toBe('20%');
  });
});

describe('longDate / periodLabel / periodLongLabel', () => {
  it('formats a long date as "5 Oct 2026"', () => {
    expect(longDate('2026-10-05')).toBe('5 Oct 2026');
  });

  it('labels a period axis tick by granularity', () => {
    expect(periodLabel('2026-10-05', 'day')).toBe('5 Oct');
    expect(periodLabel('2026-09-29', 'week')).toBe('w/c 29 Sep');
    expect(periodLabel('2026-10-01', 'month')).toBe('Oct 2026');
  });

  it('flags a bucket the selected range only partly covers', () => {
    const label = periodLongLabel('2026-09-29', 'week', '2026-10-01', '2026-10-31');
    expect(label).toMatch(/\(partial\)$/);
  });

  it('does not flag a bucket fully inside the range', () => {
    const label = periodLongLabel('2026-10-05', 'week', '2026-10-01', '2026-10-31');
    expect(label).not.toMatch(/\(partial\)$/);
  });
});

describe('hourLabel', () => {
  it('pads single-digit hours', () => {
    expect(hourLabel(9)).toBe('09:00');
    expect(hourLabel(19)).toBe('19:00');
  });
});

import { describe, expect, it } from 'vitest';
import { formatHours, hoursBetween, initials, mondayOf, parseISODate, roleRank, timeToMinutes } from '@/components/staff/role-meta';

describe('roleRank', () => {
  it('orders roles admin first, customer last', () => {
    expect(roleRank('admin')).toBeLessThan(roleRank('manager'));
    expect(roleRank('manager')).toBeLessThan(roleRank('chef'));
    expect(roleRank('chef')).toBeLessThan(roleRank('waiter'));
    expect(roleRank('waiter')).toBeLessThan(roleRank('customer'));
  });

  it('ranks a missing role last of all', () => {
    expect(roleRank(null)).toBeGreaterThan(roleRank('customer'));
  });
});

describe('initials', () => {
  it('takes the first letter of up to two words', () => {
    expect(initials('Will Waiter')).toBe('WW');
    expect(initials('Madonna')).toBe('M');
    expect(initials('A B C')).toBe('AB');
  });
});

describe('timeToMinutes / hoursBetween', () => {
  it('converts HH:MM to minutes since midnight', () => {
    expect(timeToMinutes('01:30')).toBe(90);
    expect(timeToMinutes('00:00')).toBe(0);
  });

  it('computes hours between two times', () => {
    expect(hoursBetween('12:00', '18:00')).toBe(6);
    expect(hoursBetween('12:00', '12:45')).toBe(0.8);
  });

  it('is zero when the end is not after the start', () => {
    expect(hoursBetween('18:00', '12:00')).toBe(0);
    expect(hoursBetween('', '12:00')).toBe(0);
  });
});

describe('mondayOf / parseISODate', () => {
  it('finds the Monday of the week containing a date', () => {
    const wednesday = new Date(2024, 0, 3);
    const monday = mondayOf(wednesday);
    expect(monday.getFullYear()).toBe(2024);
    expect(monday.getMonth()).toBe(0);
    expect(monday.getDate()).toBe(1);
  });

  it('parses an ISO date string to local midnight', () => {
    const d = parseISODate('2026-10-07');
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 9, 7]);
  });
});

describe('formatHours', () => {
  it('rounds to one decimal and appends h', () => {
    expect(formatHours(4.449)).toBe('4.4 h');
    expect(formatHours(1)).toBe('1 h');
  });
});

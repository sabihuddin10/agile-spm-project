import { describe, expect, it } from 'vitest';
import {
  addDaysISO,
  errorMessage,
  formatDate,
  formatDateTime,
  formatMinutes,
  formatTime,
  ITEM_STATUS,
  localDateISO,
  minutesSince,
  modifierText,
  money,
  ORDER_FLOW,
  ORDER_STATUS,
  PAYMENT_STATUS,
  percent,
  RESERVATION_STATUS,
  SHIFT_STATUS,
  TABLE_STATUS,
  timeAgo,
  titleCase,
} from '@/lib/format';
import type { ItemStatus, OrderStatus, PaymentStatus, ReservationStatus, ShiftStatus, TableStatus } from '@/types';

describe('money', () => {
  it('formats a number as a two-decimal dollar amount', () => {
    expect(money(12)).toBe('$12.00');
    expect(money(4.5)).toBe('$4.50');
  });

  it('treats null/undefined as zero', () => {
    expect(money(null)).toBe('$0.00');
    expect(money(undefined)).toBe('$0.00');
  });
});

describe('percent', () => {
  it('formats a rate as a rounded percentage', () => {
    expect(percent(0.1)).toBe('10%');
    expect(percent(0.055)).toBe('5.5%');
  });
});

describe('localDateISO / addDaysISO', () => {
  it('formats a Date as YYYY-MM-DD', () => {
    expect(localDateISO(new Date(2026, 9, 7))).toBe('2026-10-07');
  });

  it('adds days relative to a given date, crossing month boundaries', () => {
    expect(addDaysISO(1, new Date(2026, 0, 31))).toBe('2026-02-01');
  });
});

describe('formatDate / formatDateTime / formatTime', () => {
  it('formats a YYYY-MM-DD string as a short weekday/day/month', () => {
    const label = formatDate('2026-10-07');
    expect(label).toMatch(/\d{1,2}/);
    expect(typeof label).toBe('string');
  });

  it('returns an em dash placeholder for a missing timestamp', () => {
    expect(formatDateTime(null)).toBe('—');
    expect(formatDateTime(undefined)).toBe('—');
    expect(formatTime(null)).toBe('—');
  });

  it('formats a real ISO timestamp', () => {
    expect(formatDateTime('2026-10-07T12:00:00.000Z')).not.toBe('—');
    expect(formatTime('2026-10-07T12:00:00.000Z')).not.toBe('—');
  });
});

describe('minutesSince / formatMinutes / timeAgo', () => {
  it('computes elapsed minutes relative to a reference time', () => {
    const iso = new Date('2026-10-07T12:00:00.000Z').toISOString();
    const now = new Date('2026-10-07T12:45:00.000Z').getTime();
    expect(minutesSince(iso, now)).toBe(45);
  });

  it('returns 0 for a missing timestamp', () => {
    expect(minutesSince(null)).toBe(0);
  });

  it('formats minutes under an hour plainly, and hours+minutes beyond that', () => {
    expect(formatMinutes(3)).toBe('3 min');
    expect(formatMinutes(65)).toBe('1 h 05 min');
  });

  it('describes recency in increasingly coarse buckets', () => {
    const iso = new Date('2026-10-07T12:00:00.000Z').toISOString();
    expect(timeAgo(iso, new Date('2026-10-07T12:00:30.000Z').getTime())).toBe('just now');
    expect(timeAgo(iso, new Date('2026-10-07T12:30:00.000Z').getTime())).toBe('30 min ago');
    expect(timeAgo(iso, new Date('2026-10-07T15:00:00.000Z').getTime())).toBe('3 h ago');
    expect(timeAgo(iso, new Date('2026-10-09T12:00:00.000Z').getTime())).not.toMatch(/ago$/);
  });

  it('returns an empty string for a missing timestamp', () => {
    expect(timeAgo(null)).toBe('');
  });
});

describe('modifierText', () => {
  it('joins modifiers, showing a price delta only when non-zero', () => {
    expect(modifierText([{ group: 'Size', label: 'Large', priceDelta: 4 }, { group: 'Extras', label: 'Olives', priceDelta: 0 }]))
      .toBe('Large (+$4.00), Olives');
  });

  it('returns an empty string for no modifiers', () => {
    expect(modifierText(undefined)).toBe('');
    expect(modifierText([])).toBe('');
  });
});

describe('titleCase', () => {
  it('replaces underscores with spaces and capitalizes each word', () => {
    expect(titleCase('no_show')).toBe('No Show');
    expect(titleCase('ready')).toBe('Ready');
  });
});

describe('status label maps', () => {
  it('has an entry for every OrderStatus used in ORDER_FLOW', () => {
    const statuses: OrderStatus[] = ['placed', 'confirmed', 'preparing', 'ready', 'served', 'closed', 'cancelled'];
    for (const s of statuses) expect(ORDER_STATUS[s]).toBeDefined();
    for (const s of ORDER_FLOW) expect(ORDER_STATUS[s]).toBeDefined();
  });

  it('has an entry for every ItemStatus', () => {
    const statuses: ItemStatus[] = ['pending', 'queued', 'preparing', 'ready', 'served'];
    for (const s of statuses) expect(ITEM_STATUS[s]).toBeDefined();
  });

  it('has an entry for every PaymentStatus', () => {
    const statuses: PaymentStatus[] = ['unpaid', 'paid', 'refunded'];
    for (const s of statuses) expect(PAYMENT_STATUS[s]).toBeDefined();
  });

  it('has an entry for every ReservationStatus', () => {
    const statuses: ReservationStatus[] = ['requested', 'confirmed', 'seated', 'cancelled', 'no_show'];
    for (const s of statuses) expect(RESERVATION_STATUS[s]).toBeDefined();
  });

  it('has an entry for every TableStatus', () => {
    const statuses: TableStatus[] = ['free', 'occupied', 'reserved', 'cleaning'];
    for (const s of statuses) expect(TABLE_STATUS[s]).toBeDefined();
  });

  it('has an entry for every ShiftStatus', () => {
    const statuses: ShiftStatus[] = ['scheduled', 'completed', 'missed'];
    for (const s of statuses) expect(SHIFT_STATUS[s]).toBeDefined();
  });
});

describe('errorMessage', () => {
  it('uses the Error message when given one', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom');
  });

  it('falls back to the default message for a non-Error value', () => {
    expect(errorMessage('not an error')).toBe('Something went wrong.');
    expect(errorMessage(null, 'custom fallback')).toBe('custom fallback');
  });
});

import { describe, expect, it } from 'vitest';
import { billWhere, fromCents, isOpen, isReadyToBill, previewEvenSplit, previewItemSplit, toCents } from '@/components/billing/bill-utils';
import type { Invoice } from '@/types';

describe('toCents / fromCents', () => {
  it('round-trips a dollar amount through integer cents', () => {
    expect(toCents(12.5)).toBe(1250);
    expect(fromCents(1250)).toBe(12.5);
    expect(toCents(null)).toBe(0);
    expect(toCents(undefined)).toBe(0);
  });
});

describe('billWhere', () => {
  it('prefers the table number, then fulfillment, then dine-in', () => {
    expect(billWhere({ tableNumber: 4, fulfillment: 'dine-in' })).toBe('Table 4');
    expect(billWhere({ tableNumber: null, fulfillment: 'pickup' })).toBe('Pickup');
    expect(billWhere({ tableNumber: null, fulfillment: 'delivery' })).toBe('Delivery');
    expect(billWhere({ tableNumber: null, fulfillment: 'dine-in' })).toBe('Dine-in');
  });
});

describe('isReadyToBill / isOpen', () => {
  it('is ready to bill only when served and unpaid', () => {
    expect(isReadyToBill({ status: 'served', paymentStatus: 'unpaid' })).toBe(true);
    expect(isReadyToBill({ status: 'closed', paymentStatus: 'unpaid' })).toBe(false);
    expect(isReadyToBill({ status: 'served', paymentStatus: 'paid' })).toBe(false);
  });

  it('is open while unpaid and not cancelled', () => {
    expect(isOpen({ status: 'served', paymentStatus: 'unpaid' })).toBe(true);
    expect(isOpen({ status: 'cancelled', paymentStatus: 'unpaid' })).toBe(false);
    expect(isOpen({ status: 'served', paymentStatus: 'paid' })).toBe(false);
  });
});

describe('previewEvenSplit', () => {
  it('splits a total into parts that differ by at most one cent and sum exactly', () => {
    for (const [total, ways] of [[100, 3], [39.5, 3], [0.01, 2]] as const) {
      const parts = previewEvenSplit(total, ways);
      expect(parts).toHaveLength(ways);
      expect(Math.round(parts.reduce((s, p) => s + p, 0) * 100)).toBe(toCents(total));
      const cents = parts.map(toCents);
      expect(Math.max(...cents) - Math.min(...cents)).toBeLessThanOrEqual(1);
    }
  });
});

describe('previewItemSplit', () => {
  it('splits proportionally to each group\'s share of the subtotal and sums exactly', () => {
    // Arrange
    const invoice = {
      total: 47.33,
      lines: [
        { id: 'a', lineTotal: 18 },
        { id: 'b', lineTotal: 12.5 },
        { id: 'c', lineTotal: 7 },
      ],
    } as unknown as Invoice;

    // Act
    const [first, second] = previewItemSplit(invoice, [['a'], ['b', 'c']]);

    // Assert
    expect(toCents(first) + toCents(second)).toBe(toCents(invoice.total));
    expect(first).toBeGreaterThan(22);
    expect(first).toBeLessThan(23);
  });
});

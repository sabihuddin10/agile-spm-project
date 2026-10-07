import { describe, expect, it } from 'vitest';
import { lineTotal, placementLabel } from '@/components/orders/labels';

describe('placementLabel', () => {
  it('names the table for a seated dine-in order', () => {
    expect(placementLabel({ type: 'dine-in', fulfillment: 'dine-in', tableNumber: 4 })).toBe('Table 4');
  });

  it('flags a dine-in order with no table yet', () => {
    expect(placementLabel({ type: 'dine-in', fulfillment: 'dine-in', tableNumber: null })).toBe('Dine-in · no table');
  });

  it('labels online orders by fulfillment', () => {
    expect(placementLabel({ type: 'online', fulfillment: 'delivery', tableNumber: null })).toBe('Delivery');
    expect(placementLabel({ type: 'online', fulfillment: 'pickup', tableNumber: null })).toBe('Pickup');
  });
});

describe('lineTotal', () => {
  it('multiplies in cents to avoid floating-point drift', () => {
    expect(lineTotal(6.1, 3)).toBe(18.3);
  });
});

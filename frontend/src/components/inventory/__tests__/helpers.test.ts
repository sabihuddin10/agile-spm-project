import { describe, expect, it } from 'vitest';
import { movementLabel, qty, recipeCost, signedQty, suggestedQty, toNumber } from '@/components/inventory/helpers';
import type { InventoryItem, StockMovement } from '@/types';

describe('qty / signedQty', () => {
  it('shows up to 3 decimal places', () => {
    expect(qty(0.1234)).toBe('0.123');
    expect(qty(5)).toBe('5');
  });

  it('prefixes with a sign and a true minus', () => {
    expect(signedQty(5, 'kg')).toBe('+5 kg');
    expect(signedQty(-0.15, 'kg')).toBe('−0.15 kg');
  });
});

describe('movementLabel', () => {
  it('names a sale movement by its order number', () => {
    expect(movementLabel({ reason: 'sale', orderNumber: 1042 } as StockMovement)).toBe('Sale #1042');
  });

  it('falls back to the reason label otherwise', () => {
    expect(movementLabel({ reason: 'restock', orderNumber: null } as StockMovement)).toBe('Restock');
  });
});

describe('suggestedQty', () => {
  it('suggests topping back up to twice the reorder level', () => {
    expect(suggestedQty({ stock: 9, reorderLevel: 10, unit: 'kg' })).toBe(11);
  });

  it('rounds up to whole units for countable units', () => {
    expect(suggestedQty({ stock: 2, reorderLevel: 5, unit: 'units' })).toBe(8);
  });

  it('never suggests less than the reorder level, even above it', () => {
    expect(suggestedQty({ stock: 15, reorderLevel: 10, unit: 'kg' })).toBe(10);
  });
});

describe('recipeCost', () => {
  it('sums each line\'s cost per unit times its quantity', () => {
    const inventory = [
      { id: 'inv_1', costPerUnit: 2 },
      { id: 'inv_2', costPerUnit: 10 },
    ] as InventoryItem[];
    expect(recipeCost([{ inventoryId: 'inv_1', qty: 0.5 }, { inventoryId: 'inv_2', qty: 0.1 }], inventory)).toBe(2);
  });

  it('ignores a line whose ingredient no longer exists', () => {
    expect(recipeCost([{ inventoryId: 'missing', qty: 1 }], [])).toBe(0);
  });
});

describe('toNumber', () => {
  it('parses a numeric string and is NaN for blank input', () => {
    expect(toNumber('4.5')).toBe(4.5);
    expect(Number.isNaN(toNumber(''))).toBe(true);
    expect(Number.isNaN(toNumber('  '))).toBe(true);
  });
});

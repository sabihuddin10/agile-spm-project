import { describe, expect, it } from 'vitest';
import { allergyConflicts, defaultSelections, priceSelections, selectionKey, unitPriceFor } from '@/lib/menu';
import type { MenuItem } from '@/types';

function makeItem(overrides: Partial<MenuItem> = {}): MenuItem {
  return {
    id: 'item_1',
    name: 'Margherita Pizza',
    categoryId: 'cat_1',
    price: 18,
    description: 'Classic.',
    dietaryTags: [],
    allergens: ['gluten', 'dairy'],
    modifiers: [
      { id: 'mod_1', name: 'Size', type: 'single', options: [{ label: 'Regular', priceDelta: 0 }, { label: 'Large', priceDelta: 4 }] },
      { id: 'mod_2', name: 'Extras', type: 'multi', options: [{ label: 'Olives', priceDelta: 1 }] },
    ],
    available: true,
    outOfStockReason: '',
    ...overrides,
  };
}

describe('defaultSelections', () => {
  it('picks the first option of every single-choice group', () => {
    // Arrange
    const item = makeItem();

    // Act
    const selections = defaultSelections(item);

    // Assert
    expect(selections).toEqual([{ group: 'Size', label: 'Regular' }]);
  });
});

describe('priceSelections', () => {
  it('attaches the price delta of each chosen option', () => {
    // Arrange
    const item = makeItem();
    const chosen = [{ group: 'Size', label: 'Large' }, { group: 'Extras', label: 'Olives' }];

    // Act
    const priced = priceSelections(item, chosen);

    // Assert
    expect(priced).toEqual([
      { group: 'Size', label: 'Large', priceDelta: 4 },
      { group: 'Extras', label: 'Olives', priceDelta: 1 },
    ]);
  });

  it('drops a selection that no longer matches a real option', () => {
    // Arrange
    const item = makeItem();
    const stale = [{ group: 'Size', label: 'Extra Large' }];

    // Act
    const priced = priceSelections(item, stale);

    // Assert
    expect(priced).toEqual([]);
  });
});

describe('unitPriceFor', () => {
  it('adds every selected option delta to the base price', () => {
    // Arrange
    const item = makeItem();
    const chosen = [{ group: 'Size', label: 'Large' }, { group: 'Extras', label: 'Olives' }];

    // Act
    const unit = unitPriceFor(item, chosen);

    // Assert
    expect(unit).toBe(23);
  });
});

describe('selectionKey', () => {
  it('is stable regardless of selection order', () => {
    // Arrange
    const a = [{ group: 'Size', label: 'Large' }, { group: 'Extras', label: 'Olives' }];
    const b = [{ group: 'Extras', label: 'Olives' }, { group: 'Size', label: 'Large' }];

    // Act
    const keyA = selectionKey('item_1', a);
    const keyB = selectionKey('item_1', b);

    // Assert
    expect(keyA).toBe(keyB);
  });

  it('differs for a different menu item or a different selection', () => {
    // Arrange
    const base = selectionKey('item_1', [{ group: 'Size', label: 'Large' }]);

    // Act
    const otherItem = selectionKey('item_2', [{ group: 'Size', label: 'Large' }]);
    const otherSelection = selectionKey('item_1', [{ group: 'Size', label: 'Regular' }]);

    // Assert
    expect(otherItem).not.toBe(base);
    expect(otherSelection).not.toBe(base);
  });
});

describe('allergyConflicts', () => {
  it('returns the allergens that are also on the customer\'s allergy list', () => {
    // Arrange
    const item = makeItem({ allergens: ['Gluten', 'Peanuts'] });

    // Act
    const conflicts = allergyConflicts(item, ['peanuts']);

    // Assert
    expect(conflicts).toEqual(['Peanuts']);
  });

  it('returns no conflicts when the customer has no recorded allergies', () => {
    // Arrange
    const item = makeItem({ allergens: ['Gluten'] });

    // Act
    const conflicts = allergyConflicts(item, undefined);

    // Assert
    expect(conflicts).toEqual([]);
  });
});

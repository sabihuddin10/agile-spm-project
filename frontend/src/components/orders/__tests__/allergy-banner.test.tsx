import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AllergyBanner, orderAllergyFlags } from '@/components/orders/allergy-banner';
import type { MenuItem, Order } from '@/types';

function makeMenuItem(overrides: Partial<MenuItem> = {}): MenuItem {
  return {
    id: 'item_1',
    name: 'Peanut Satay Skewers',
    categoryId: 'cat_1',
    price: 12,
    description: '',
    dietaryTags: [],
    allergens: ['peanuts'],
    modifiers: [],
    available: true,
    outOfStockReason: '',
    ...overrides,
  };
}

describe('orderAllergyFlags', () => {
  it('flags order lines whose dish clashes with the guest\'s allergies', () => {
    // Arrange
    const dish = makeMenuItem();
    const order = {
      items: [{ id: 'line_1', menuItemId: dish.id }],
      customer: { preferences: { allergies: ['peanuts'], dietary: [] } },
    } as unknown as Pick<Order, 'items' | 'customer'>;
    const menuById = new Map([[dish.id, dish]]);

    // Act
    const flags = orderAllergyFlags(order, menuById);

    // Assert
    expect(flags).toEqual({ line_1: ['peanuts'] });
  });

  it('returns no flags when the guest has no recorded allergies', () => {
    // Arrange
    const order = { items: [{ id: 'line_1', menuItemId: 'item_1' }], customer: null } as unknown as Pick<Order, 'items' | 'customer'>;

    // Act / Assert
    expect(orderAllergyFlags(order, new Map())).toEqual({});
  });

  it('skips a line whose dish is not in the menu index', () => {
    // Arrange
    const order = {
      items: [{ id: 'line_1', menuItemId: 'missing' }],
      customer: { preferences: { allergies: ['peanuts'], dietary: [] } },
    } as unknown as Pick<Order, 'items' | 'customer'>;

    // Act / Assert
    expect(orderAllergyFlags(order, new Map())).toEqual({});
  });
});

describe('AllergyBanner', () => {
  it('renders nothing when there are no allergies or dietary notes', () => {
    // Arrange / Act
    const { container } = render(<AllergyBanner allergies={[]} dietary={[]} />);

    // Assert
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the allergy alert with the flagged dish names', () => {
    // Arrange / Act
    render(<AllergyBanner allergies={['peanuts']} flaggedDishes={['Pad Thai']} />);

    // Assert
    expect(screen.getByText(/allergy alert: peanuts/i)).toBeInTheDocument();
    expect(screen.getByText(/check: pad thai/i)).toBeInTheDocument();
  });

  it('shows dietary notes separately from allergies', () => {
    // Arrange / Act
    render(<AllergyBanner allergies={[]} dietary={['vegan']} />);

    // Assert
    expect(screen.getByText(/dietary/i)).toBeInTheDocument();
    expect(screen.getByText(/vegan/i)).toBeInTheDocument();
  });
});

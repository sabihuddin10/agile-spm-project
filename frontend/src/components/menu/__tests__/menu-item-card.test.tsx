import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MenuItemCard } from '@/components/menu/menu-item-card';
import type { MenuItem } from '@/types';

function makeItem(overrides: Partial<MenuItem> = {}): MenuItem {
  return {
    id: 'item_1',
    name: 'Peanut Satay Skewers',
    categoryId: 'cat_1',
    price: 12,
    description: 'Grilled chicken skewers with peanut sauce.',
    dietaryTags: ['gluten-free'],
    allergens: ['peanuts'],
    modifiers: [],
    available: true,
    outOfStockReason: '',
    ...overrides,
  };
}

describe('MenuItemCard', () => {
  it('shows the dish name, price and dietary/allergen tags', () => {
    // Arrange
    const item = makeItem();

    // Act
    render(<MenuItemCard item={item} onAdd={vi.fn()} />);

    // Assert
    expect(screen.getByText('Peanut Satay Skewers')).toBeInTheDocument();
    expect(screen.getByText('$12.00')).toBeInTheDocument();
    expect(screen.getByText('gluten-free')).toBeInTheDocument();
    expect(screen.getByText('peanuts')).toBeInTheDocument();
  });

  it('adds the item with its default selections when it has no modifiers', async () => {
    // Arrange
    const onAdd = vi.fn();
    const item = makeItem();
    const user = userEvent.setup();
    render(<MenuItemCard item={item} onAdd={onAdd} canOrder />);

    // Act
    await user.click(screen.getByRole('button', { name: /add .* to order/i }));

    // Assert
    expect(onAdd).toHaveBeenCalledWith(item, [], 1);
  });

  it('disables the button and explains why when the item is unavailable', () => {
    // Arrange
    const item = makeItem({ available: false, outOfStockReason: 'Fryer down' });

    // Act
    render(<MenuItemCard item={item} onAdd={vi.fn()} />);

    // Assert
    const button = screen.getByRole('button', { name: /unavailable/i });
    expect(button).toBeDisabled();
    expect(screen.getByText('Fryer down')).toBeInTheDocument();
  });

  it('flags an allergen that is on the signed-in customer\'s allergy list', () => {
    // Arrange
    const item = makeItem({ allergens: ['Peanuts'] });

    // Act
    render(<MenuItemCard item={item} onAdd={vi.fn()} allergies={['peanuts']} />);

    // Assert
    expect(screen.getByText(/on your allergy list/i)).toBeInTheDocument();
  });

  it('opens the options dialog instead of adding directly when the dish has modifiers and the customer can order', async () => {
    // Arrange
    const item = makeItem({
      modifiers: [{ id: 'mod_1', name: 'Size', type: 'single', options: [{ label: 'Regular', priceDelta: 0 }, { label: 'Large', priceDelta: 2 }] }],
    });
    const onAdd = vi.fn();
    const user = userEvent.setup();
    render(<MenuItemCard item={item} onAdd={onAdd} canOrder />);

    // Act
    await user.click(screen.getByRole('button', { name: /add .* to order/i }));

    // Assert — the modal opened instead of calling onAdd straight away
    expect(onAdd).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog', { name: item.name });
    expect(within(dialog).getByRole('heading', { name: item.name })).toBeInTheDocument();
  });
});

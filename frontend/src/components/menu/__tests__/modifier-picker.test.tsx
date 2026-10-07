import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ModifierPicker } from '@/components/menu/modifier-picker';
import type { MenuItem } from '@/types';

function makeItem(overrides: Partial<MenuItem> = {}): MenuItem {
  return {
    id: 'item_1',
    name: 'Pizza',
    categoryId: 'cat_1',
    price: 18,
    description: '',
    dietaryTags: [],
    allergens: [],
    modifiers: [
      { id: 'mod_1', name: 'Size', type: 'single', options: [{ label: 'Regular', priceDelta: 0 }, { label: 'Large', priceDelta: 4 }] },
      { id: 'mod_2', name: 'Extras', type: 'multi', options: [{ label: 'Olives', priceDelta: 1 }, { label: 'Mushrooms', priceDelta: 1.5 }] },
    ],
    available: true,
    outOfStockReason: '',
    ...overrides,
  };
}

describe('ModifierPicker', () => {
  it('renders nothing for a dish with no modifiers', () => {
    // Arrange / Act
    const { container } = render(<ModifierPicker item={makeItem({ modifiers: [] })} value={[]} onChange={vi.fn()} />);

    // Assert
    expect(container).toBeEmptyDOMElement();
  });

  it('a single-choice group replaces the previous selection in that group', async () => {
    // Arrange
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ModifierPicker item={makeItem()} value={[{ group: 'Size', label: 'Regular' }]} onChange={onChange} />);

    // Act
    await user.click(screen.getByRole('radio', { name: /large/i }));

    // Assert
    expect(onChange).toHaveBeenCalledWith([{ group: 'Size', label: 'Large' }]);
  });

  it('a multi-choice group toggles independently of other selections', async () => {
    // Arrange
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ModifierPicker item={makeItem()} value={[{ group: 'Size', label: 'Regular' }]} onChange={onChange} />);

    // Act — add an extra
    await user.click(screen.getByRole('checkbox', { name: /olives/i }));
    // Assert
    expect(onChange).toHaveBeenLastCalledWith([{ group: 'Size', label: 'Regular' }, { group: 'Extras', label: 'Olives' }]);
  });

  it('a second click on a checked multi-choice option removes it', async () => {
    // Arrange
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <ModifierPicker
        item={makeItem()}
        value={[{ group: 'Size', label: 'Regular' }, { group: 'Extras', label: 'Olives' }]}
        onChange={onChange}
      />,
    );

    // Act
    await user.click(screen.getByRole('checkbox', { name: /olives/i }));

    // Assert
    expect(onChange).toHaveBeenCalledWith([{ group: 'Size', label: 'Regular' }]);
  });

  it('shows the price delta next to an option that costs extra', () => {
    // Arrange / Act
    render(<ModifierPicker item={makeItem()} value={[]} onChange={vi.fn()} />);

    // Assert
    expect(screen.getByText('+$4.00')).toBeInTheDocument();
  });
});

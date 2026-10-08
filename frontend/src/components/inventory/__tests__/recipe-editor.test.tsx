import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecipeEditor } from '@/components/inventory/recipe-editor';
import { menuApi } from '@/lib/api';
import type { InventoryItem, MenuItem } from '@/types';

vi.mock('@/lib/api', () => ({ menuApi: { setRecipe: vi.fn() } }));
vi.mock('@/components/ui/toast', () => ({ useToast: () => vi.fn() }));

function makeMenuItem(overrides: Partial<MenuItem> = {}): MenuItem {
  return { id: 'item_1', name: 'Garlic Bread', categoryId: 'cat_1', price: 6, description: '', dietaryTags: [], allergens: [], modifiers: [], available: true, outOfStockReason: '', recipe: [], ...overrides } as MenuItem;
}

const inventory: InventoryItem[] = [
  { id: 'inv_flour', name: 'Flour', category: 'Dry Goods', unit: 'kg', stock: 60, reorderLevel: 25, costPerUnit: 1.2, health: 'ok' } as InventoryItem,
  { id: 'inv_oil', name: 'Olive Oil', category: 'Pantry', unit: 'L', stock: 14, reorderLevel: 8, costPerUnit: 11, health: 'ok' } as InventoryItem,
];

describe('RecipeEditor', () => {
  it('rejects a zero-or-blank quantity on a chosen ingredient', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    render(<RecipeEditor item={makeMenuItem()} inventory={inventory} onClose={vi.fn()} onSaved={vi.fn()} />);
    await user.click(screen.getByText(/add ingredient/i));

    // Act
    await user.selectOptions(screen.getByLabelText('Ingredient'), 'inv_flour');
    await user.click(screen.getByRole('button', { name: /save recipe/i }));

    // Assert
    expect(screen.getByText(/quantity must be greater than zero/i)).toBeInTheDocument();
    expect(menuApi.setRecipe).not.toHaveBeenCalled();
  });

  it('saves a valid recipe with the chosen ingredients and quantities', async () => {
    // Arrange
    const onSaved = vi.fn();
    const updated = makeMenuItem({ recipe: [{ inventoryId: 'inv_flour', qty: 0.2, name: 'Flour' }] });
    vi.mocked(menuApi.setRecipe).mockResolvedValue({ item: updated });
    const user = userEvent.setup({ delay: null });
    render(<RecipeEditor item={makeMenuItem()} inventory={inventory} onClose={vi.fn()} onSaved={onSaved} />);
    await user.click(screen.getByText(/add ingredient/i));

    // Act
    await user.selectOptions(screen.getByLabelText('Ingredient'), 'inv_flour');
    await user.type(screen.getByLabelText(/quantity of flour/i), '0.2');
    await user.click(screen.getByRole('button', { name: /save recipe/i }));

    // Assert
    expect(menuApi.setRecipe).toHaveBeenCalledWith('item_1', [{ inventoryId: 'inv_flour', qty: 0.2 }]);
    expect(onSaved).toHaveBeenCalledWith(updated);
  });

  it('shows the food cost per portion as ingredients are added', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    render(<RecipeEditor item={makeMenuItem({ price: 6 })} inventory={inventory} onClose={vi.fn()} onSaved={vi.fn()} />);
    await user.click(screen.getByText(/add ingredient/i));

    // Act
    await user.selectOptions(screen.getByLabelText('Ingredient'), 'inv_oil');
    await user.type(screen.getByLabelText(/quantity of olive oil/i), '0.1');

    // Assert — 0.1 L * $11/L = $1.10 (shown both on the row and in the summary)
    expect(screen.getAllByText('$1.10')).toHaveLength(2);
  });

  it('prevents choosing the same ingredient twice', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    render(<RecipeEditor item={makeMenuItem()} inventory={inventory} onClose={vi.fn()} onSaved={vi.fn()} />);
    await user.click(screen.getByText(/add ingredient/i));
    await user.selectOptions(screen.getByLabelText('Ingredient'), 'inv_flour');
    await user.click(screen.getByText(/add ingredient/i));

    // Act
    const selects = screen.getAllByLabelText('Ingredient');
    const flourOption = Array.from(selects[1].querySelectorAll('option')).find((o) => o.value === 'inv_flour') as HTMLOptionElement;

    // Assert
    expect(flourOption.disabled).toBe(true);
  });
});

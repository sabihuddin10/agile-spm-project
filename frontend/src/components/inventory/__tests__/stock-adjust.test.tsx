import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StockAdjust } from '@/components/inventory/stock-adjust';
import { inventoryApi } from '@/lib/api';
import type { InventoryItem } from '@/types';

vi.mock('@/lib/api', () => ({ inventoryApi: { update: vi.fn() } }));
vi.mock('@/components/ui/toast', () => ({ useToast: () => vi.fn() }));

function makeItem(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return { id: 'inv_1', name: 'Flour', category: 'Dry Goods', unit: 'kg', stock: 10, reorderLevel: 5, costPerUnit: 1.2, health: 'ok', ...overrides } as InventoryItem;
}

describe('StockAdjust', () => {
  it('receives a delivery, sending a positive delta', async () => {
    // Arrange
    const onSaved = vi.fn();
    const updated = makeItem({ stock: 15 });
    vi.mocked(inventoryApi.update).mockResolvedValue({ item: updated });
    const user = userEvent.setup({ delay: null });
    render(<StockAdjust item={makeItem()} onClose={vi.fn()} onSaved={onSaved} />);

    // Act
    await user.type(screen.getByLabelText('Quantity'), '5');
    await user.click(screen.getByRole('button', { name: /receive stock/i }));

    // Assert
    expect(inventoryApi.update).toHaveBeenCalledWith('inv_1', { delta: 5 });
    expect(onSaved).toHaveBeenCalledWith(updated);
  });

  it('records wastage as a negative delta', async () => {
    // Arrange
    const updated = makeItem({ stock: 8 });
    vi.mocked(inventoryApi.update).mockResolvedValue({ item: updated });
    const user = userEvent.setup({ delay: null });
    render(<StockAdjust item={makeItem()} onClose={vi.fn()} onSaved={vi.fn()} />);

    // Act
    await user.click(screen.getByRole('radio', { name: /record wastage/i }));
    await user.type(screen.getByLabelText('Quantity'), '2');
    await user.click(screen.getByRole('button', { name: /record wastage/i }));

    // Assert
    expect(inventoryApi.update).toHaveBeenCalledWith('inv_1', { delta: -2 });
  });

  it('refuses to waste more than is in stock', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    render(<StockAdjust item={makeItem({ stock: 3 })} onClose={vi.fn()} onSaved={vi.fn()} />);

    // Act
    await user.click(screen.getByRole('radio', { name: /record wastage/i }));
    await user.type(screen.getByLabelText('Quantity'), '5');

    // Assert — the submit button is disabled; the over-waste hint is shown
    expect(screen.getByText(/you can't record more wastage than that/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /record wastage/i })).toBeDisabled();
  });

  it('requires a quantity greater than zero', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    render(<StockAdjust item={makeItem()} onClose={vi.fn()} onSaved={vi.fn()} />);

    // Assert — nothing entered yet, button disabled
    expect(screen.getByRole('button', { name: /receive stock/i })).toBeDisabled();
  });
});

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LowStockBanner } from '@/components/inventory/low-stock-banner';
import type { InventoryItem } from '@/types';

function makeItem(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return { id: 'inv_1', name: 'Lemons', category: 'Produce', unit: 'units', stock: 5, reorderLevel: 10, costPerUnit: 0.5, health: 'low', ...overrides } as InventoryItem;
}

describe('LowStockBanner', () => {
  it('shows an all-clear message when nothing is low', () => {
    // Arrange / Act
    render(<LowStockBanner items={[]} nearCount={0} canReorder={false} onOpenReorder={vi.fn()} />);

    // Assert
    expect(screen.getByText(/all ingredients are above their reorder levels/i)).toBeInTheDocument();
  });

  it('names the low ingredients and lets a manager open the reorder form', async () => {
    // Arrange
    const onOpenReorder = vi.fn();
    const user = userEvent.setup({ delay: null });
    render(<LowStockBanner items={[makeItem()]} nearCount={2} canReorder onOpenReorder={onOpenReorder} />);

    // Assert
    expect(screen.getByText('Lemons')).toBeInTheDocument();
    expect(screen.getByText(/2 more near reorder/i)).toBeInTheDocument();

    // Act
    await user.click(screen.getByRole('button', { name: /open reorder form/i }));

    // Assert
    expect(onOpenReorder).toHaveBeenCalled();
  });

  it('tells non-managers that managers have been alerted instead of offering the reorder form', () => {
    // Arrange / Act
    render(<LowStockBanner items={[makeItem()]} nearCount={0} canReorder={false} onOpenReorder={vi.fn()} />);

    // Assert
    expect(screen.queryByRole('button', { name: /open reorder form/i })).not.toBeInTheDocument();
    expect(screen.getByText(/managers have been alerted/i)).toBeInTheDocument();
  });
});

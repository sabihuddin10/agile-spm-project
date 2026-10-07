import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InventoryHealth } from '@/components/analytics/inventory-health';
import type { AnalyticsDashboard } from '@/types';

type Row = AnalyticsDashboard['inventory'][number];

function makeRow(overrides: Partial<Row> = {}): Row {
  return { id: 'inv_1', name: 'Lemons', unit: 'units', stock: 5, reorderLevel: 10, coverage: 50, status: 'low', ...overrides } as Row;
}

describe('InventoryHealth', () => {
  it('shows an all-clear message when nothing is at risk', () => {
    // Arrange / Act
    render(<InventoryHealth items={[makeRow({ status: 'ok', coverage: 200 })]} />);

    // Assert
    expect(screen.getByText(/every ingredient is comfortably above/i)).toBeInTheDocument();
  });

  it('lists at-risk items first, with low/near/healthy counts', () => {
    // Arrange
    const items = [makeRow({ id: 'a', name: 'Lemons', status: 'low' }), makeRow({ id: 'b', name: 'Flour', status: 'near', coverage: 80 })];

    // Act
    render(<InventoryHealth items={items} />);

    // Assert
    expect(screen.getByText('1 low')).toBeInTheDocument();
    expect(screen.getByText('1 near reorder')).toBeInTheDocument();
    expect(screen.getByText('0 healthy')).toBeInTheDocument();
    expect(screen.getByText('Lemons')).toBeInTheDocument();
    expect(screen.getByText('Flour')).toBeInTheDocument();
  });

  it('hides healthy items behind a toggle', async () => {
    // Arrange
    const items = [makeRow({ id: 'a', status: 'low' }), makeRow({ id: 'b', name: 'Mozzarella', status: 'ok', coverage: 150 })];
    const user = userEvent.setup();
    render(<InventoryHealth items={items} />);

    // Assert — healthy item not shown yet
    expect(screen.queryByText('Mozzarella')).not.toBeInTheDocument();

    // Act
    await user.click(screen.getByRole('button', { name: /show 1 healthy item/i }));

    // Assert
    expect(screen.getByText('Mozzarella')).toBeInTheDocument();
  });
});

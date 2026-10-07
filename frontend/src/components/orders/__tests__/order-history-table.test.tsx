import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OrderHistoryTable } from '@/components/orders/order-history-table';
import type { Order } from '@/types';

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'ord_1',
    number: 101,
    type: 'dine-in',
    fulfillment: 'dine-in',
    tableId: null,
    tableNumber: 4,
    status: 'closed',
    paymentStatus: 'paid',
    total: 42,
    createdAt: '2026-10-07T12:00:00.000Z',
    closedAt: '2026-10-07T13:00:00.000Z',
    cancelledAt: null,
    items: [],
    ...overrides,
  } as Order;
}

describe('OrderHistoryTable', () => {
  it('shows a placeholder when there is no history yet', () => {
    // Arrange / Act
    render(<OrderHistoryTable orders={[]} />);

    // Assert
    expect(screen.getByText(/no closed or cancelled orders yet today/i)).toBeInTheDocument();
  });

  it('lists each order with its table, status, payment and total', () => {
    // Arrange
    const order = makeOrder();

    // Act
    render(<OrderHistoryTable orders={[order]} />);

    // Assert
    expect(screen.getByText('#101')).toBeInTheDocument();
    expect(screen.getByText(/Table 4/)).toBeInTheDocument();
    expect(screen.getByText('Closed')).toBeInTheDocument();
    expect(screen.getByText('Paid')).toBeInTheDocument();
    expect(screen.getByText('$42.00')).toBeInTheDocument();
  });
});

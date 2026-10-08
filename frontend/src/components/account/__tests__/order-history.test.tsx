import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OrderHistory } from '@/components/account/order-history';
import type { Order } from '@/types';

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'ord_1',
    number: 101,
    type: 'online',
    fulfillment: 'pickup',
    tableId: null,
    tableNumber: null,
    status: 'closed',
    paymentStatus: 'paid',
    paymentMethod: 'card',
    total: 24,
    pointsEarned: 2,
    pointsUsed: 0,
    refund: null,
    createdAt: '2026-10-01T12:00:00.000Z',
    items: [{ id: 'it_1', name: 'Soda', qty: 2 }],
    ...overrides,
  } as Order;
}

describe('OrderHistory', () => {
  it('shows a placeholder when there is no history yet', () => {
    // Arrange / Act
    render(<OrderHistory orders={[]} onReceipt={vi.fn()} receiptLoadingId={null} />);

    // Assert
    expect(screen.getByText(/no past orders yet/i)).toBeInTheDocument();
  });

  it('lists orders newest first with items, total and payment status', () => {
    // Arrange
    const older = makeOrder({ id: 'a', number: 1, createdAt: '2026-09-01T12:00:00.000Z' });
    const newer = makeOrder({ id: 'b', number: 2, createdAt: '2026-10-01T12:00:00.000Z' });

    // Act
    render(<OrderHistory orders={[older, newer]} onReceipt={vi.fn()} receiptLoadingId={null} />);

    // Assert
    const numbers = screen.getAllByText(/^#\d+/).map((el) => el.textContent);
    expect(numbers[0]).toContain('#2');
    expect(screen.getAllByText(/2× Soda/)).toHaveLength(2);
  });

  it('requests a receipt for a paid order', async () => {
    // Arrange
    const onReceipt = vi.fn();
    const order = makeOrder();
    const user = userEvent.setup({ delay: null });
    render(<OrderHistory orders={[order]} onReceipt={onReceipt} receiptLoadingId={null} />);

    // Act
    await user.click(screen.getByRole('button', { name: /receipt for order 101/i }));

    // Assert
    expect(onReceipt).toHaveBeenCalledWith(order);
  });

  it('hides the receipt button for an unpaid order', () => {
    // Arrange / Act
    render(<OrderHistory orders={[makeOrder({ paymentStatus: 'unpaid' })]} onReceipt={vi.fn()} receiptLoadingId={null} />);

    // Assert
    expect(screen.queryByRole('button', { name: /receipt/i })).not.toBeInTheDocument();
  });

  it('shows the refund reason on a refunded order', () => {
    // Arrange / Act
    render(
      <OrderHistory
        orders={[makeOrder({ paymentStatus: 'refunded', refund: { amount: 24, reason: 'Cold food', at: '2026-10-02T12:00:00.000Z', by: 'usr_manager' } })]}
        onReceipt={vi.fn()}
        receiptLoadingId={null}
      />,
    );

    // Assert
    expect(screen.getByText(/refunded \$24\.00/i)).toBeInTheDocument();
    expect(screen.getByText(/cold food/i)).toBeInTheDocument();
  });

  it('paginates, showing more orders on request', async () => {
    // Arrange
    const orders = Array.from({ length: 10 }, (_, i) => makeOrder({ id: `o${i}`, number: i, createdAt: `2026-10-0${(i % 9) + 1}T12:00:00.000Z` }));
    const user = userEvent.setup({ delay: null });
    render(<OrderHistory orders={orders} onReceipt={vi.fn()} receiptLoadingId={null} />);
    expect(screen.getByText(/show more \(2 older\)/i)).toBeInTheDocument();

    // Act
    await user.click(screen.getByRole('button', { name: /show more/i }));

    // Assert
    expect(screen.queryByText(/show more/i)).not.toBeInTheDocument();
  });
});

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PaidActions, PayActions } from '@/components/billing/payment-actions';
import { billingApi } from '@/lib/api';
import type { Invoice } from '@/types';

vi.mock('@/lib/api', () => ({ billingApi: { pay: vi.fn(), unpay: vi.fn() } }));
vi.mock('@/components/ui/toast', () => ({ useToast: () => vi.fn() }));

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 'inv_1',
    number: 101,
    total: 50,
    status: 'served',
    paymentStatus: 'unpaid',
    paymentMethod: null,
    split: null,
    refund: null,
    refundedAmount: 0,
    tableNumber: null,
    fulfillment: 'dine-in',
    ...overrides,
  } as Invoice;
}

describe('PayActions', () => {
  it('records a card payment', async () => {
    // Arrange
    const onUpdated = vi.fn();
    const paid = makeInvoice({ paymentStatus: 'paid' });
    vi.mocked(billingApi.pay).mockResolvedValue({ invoice: paid, alreadyPaid: false });
    const user = userEvent.setup();
    render(<PayActions invoice={makeInvoice()} onUpdated={onUpdated} />);

    // Act
    await user.click(screen.getByRole('button', { name: /paid by card/i }));

    // Assert
    expect(billingApi.pay).toHaveBeenCalledWith('inv_1', 'card');
    expect(onUpdated).toHaveBeenCalledWith(paid);
  });

  it('shows guidance instead of pay buttons while shares are being paid', () => {
    // Arrange
    const invoice = makeInvoice({ split: { mode: 'even', createdAt: '', parts: [{ label: 'Guest 1', amount: 25, itemIds: [], paid: true }] } });

    // Act
    render(<PayActions invoice={invoice} onUpdated={vi.fn()} />);

    // Assert
    expect(screen.queryByRole('button', { name: /paid by card/i })).not.toBeInTheDocument();
    expect(screen.getByText(/guests are paying their shares/i)).toBeInTheDocument();
  });
});

describe('PaidActions', () => {
  it('shows the refund button only to a role that can refund', () => {
    // Arrange
    const invoice = makeInvoice({ paymentStatus: 'paid' });

    // Act
    const { rerender } = render(<PaidActions invoice={invoice} role="waiter" onUpdated={vi.fn()} onRefund={vi.fn()} />);
    // Assert
    expect(screen.queryByRole('button', { name: /refund/i })).not.toBeInTheDocument();
    expect(screen.getByText(/handled by a manager/i)).toBeInTheDocument();

    // Act
    rerender(<PaidActions invoice={invoice} role="manager" onUpdated={vi.fn()} onRefund={vi.fn()} />);
    // Assert
    expect(screen.getByRole('button', { name: /refund…/i })).toBeInTheDocument();
  });

  it('requires a confirm step before marking a payment unpaid', async () => {
    // Arrange
    const onUpdated = vi.fn();
    const unpaid = makeInvoice({ paymentStatus: 'unpaid', status: 'served' });
    vi.mocked(billingApi.unpay).mockResolvedValue({ invoice: unpaid });
    const user = userEvent.setup();
    render(<PaidActions invoice={makeInvoice({ paymentStatus: 'paid' })} role="manager" onUpdated={onUpdated} onRefund={vi.fn()} />);

    // Act
    await user.click(screen.getByRole('button', { name: /mark unpaid/i }));
    // Assert — not yet called, confirmation is showing
    expect(billingApi.unpay).not.toHaveBeenCalled();
    expect(screen.getByText(/reverse this payment/i)).toBeInTheDocument();

    // Act
    await user.click(screen.getByRole('button', { name: /yes, mark unpaid/i }));
    // Assert
    expect(billingApi.unpay).toHaveBeenCalledWith('inv_1');
    expect(onUpdated).toHaveBeenCalledWith(unpaid);
  });

  it('shows refund details and the net total once refunded', () => {
    // Arrange
    const invoice = makeInvoice({
      paymentStatus: 'refunded',
      refund: { amount: 50, reason: 'Cold food', at: '2026-10-07T12:00:00.000Z', by: 'usr_manager' },
      refundedAmount: 50,
      netTotal: 0,
    });

    // Act
    render(<PaidActions invoice={invoice} role="manager" onUpdated={vi.fn()} onRefund={vi.fn()} />);

    // Assert
    expect(screen.getByText(/fully refunded/i)).toBeInTheDocument();
    expect(screen.getByText(/cold food/i)).toBeInTheDocument();
  });
});

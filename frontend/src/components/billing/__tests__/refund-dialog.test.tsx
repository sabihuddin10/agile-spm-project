import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RefundDialog } from '@/components/billing/refund-dialog';
import { billingApi } from '@/lib/api';
import type { Invoice } from '@/types';

vi.mock('@/lib/api', () => ({ billingApi: { refund: vi.fn() } }));
vi.mock('@/components/ui/toast', () => ({ useToast: () => vi.fn() }));

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 'inv_1',
    number: 101,
    total: 50,
    refundedAmount: 0,
    paymentStatus: 'paid',
    ...overrides,
  } as Invoice;
}

describe('RefundDialog', () => {
  it('requires a reason of at least 3 characters', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    render(<RefundDialog invoice={makeInvoice()} onClose={vi.fn()} onUpdated={vi.fn()} />);

    // Act
    await user.type(screen.getByLabelText(/reason/i), 'ab');
    await user.click(screen.getByRole('button', { name: /^refund/i }));

    // Assert
    expect(screen.getByText(/give a reason/i)).toBeInTheDocument();
    expect(billingApi.refund).not.toHaveBeenCalled();
  });

  it('rejects an amount above what remains refundable', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    render(<RefundDialog invoice={makeInvoice({ total: 50, refundedAmount: 40 })} onClose={vi.fn()} onUpdated={vi.fn()} />);

    // Act
    await user.type(screen.getByLabelText(/reason/i), 'Wrong dish served');
    await user.type(screen.getByLabelText(/amount/i), '20');
    await user.click(screen.getByRole('button', { name: /^refund/i }));

    // Assert
    expect(screen.getByText(/enter an amount between/i)).toBeInTheDocument();
    expect(billingApi.refund).not.toHaveBeenCalled();
  });

  it('defaults to a full refund of whatever remains when no amount is given', async () => {
    // Arrange
    const onClose = vi.fn();
    const refunded = makeInvoice({ paymentStatus: 'refunded', refundedAmount: 50 });
    vi.mocked(billingApi.refund).mockResolvedValue({ invoice: refunded });
    const user = userEvent.setup({ delay: null });
    render(<RefundDialog invoice={makeInvoice()} onClose={onClose} onUpdated={vi.fn()} />);

    // Act
    await user.type(screen.getByLabelText(/reason/i), 'Cold food');
    await user.click(screen.getByRole('button', { name: /^refund/i }));

    // Assert
    expect(billingApi.refund).toHaveBeenCalledWith('inv_1', 'Cold food', undefined);
    expect(onClose).toHaveBeenCalled();
  });

  it('submits a partial refund amount', async () => {
    // Arrange
    const updated = makeInvoice({ refundedAmount: 15 });
    vi.mocked(billingApi.refund).mockResolvedValue({ invoice: updated });
    const user = userEvent.setup({ delay: null });
    render(<RefundDialog invoice={makeInvoice()} onClose={vi.fn()} onUpdated={vi.fn()} />);

    // Act
    await user.type(screen.getByLabelText(/reason/i), 'Partial goodwill refund');
    await user.type(screen.getByLabelText(/amount/i), '15');
    await user.click(screen.getByRole('button', { name: /^refund/i }));

    // Assert
    expect(billingApi.refund).toHaveBeenCalledWith('inv_1', 'Partial goodwill refund', 15);
  });
});

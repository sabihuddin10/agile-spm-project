import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TipControl } from '@/components/billing/tip-control';
import { billingApi } from '@/lib/api';
import type { Invoice } from '@/types';

vi.mock('@/lib/api', () => ({ billingApi: { tip: vi.fn() } }));
vi.mock('@/components/ui/toast', () => ({ useToast: () => vi.fn() }));

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 'inv_1',
    number: 101,
    subtotal: 50,
    tip: 0,
    total: 50,
    split: null,
    ...overrides,
  } as Invoice;
}

describe('TipControl', () => {
  beforeEach(() => vi.mocked(billingApi.tip).mockReset());

  it('highlights the preset matching the current tip', () => {
    // Arrange
    const invoice = makeInvoice({ subtotal: 100, tip: 10 });

    // Act
    render(<TipControl invoice={invoice} onUpdated={vi.fn()} />);

    // Assert
    expect(screen.getByRole('button', { name: '10%' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '15%' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('applies a percentage preset', async () => {
    // Arrange
    const onUpdated = vi.fn();
    const updated = makeInvoice({ tip: 7.5 });
    vi.mocked(billingApi.tip).mockResolvedValue({ invoice: updated });
    const user = userEvent.setup();
    render(<TipControl invoice={makeInvoice({ subtotal: 50 })} onUpdated={onUpdated} />);

    // Act
    await user.click(screen.getByRole('button', { name: '15%' }));

    // Assert
    expect(billingApi.tip).toHaveBeenCalledWith('inv_1', { percent: 15 });
    expect(onUpdated).toHaveBeenCalledWith(updated);
  });

  it('rejects an invalid custom tip without calling the API', async () => {
    // Arrange
    render(<TipControl invoice={makeInvoice()} onUpdated={vi.fn()} />);
    const input = screen.getByLabelText('Custom tip amount');

    // Act — fireEvent.change sets the value atomically (userEvent.type would
    // reject the lone "-" keystroke on a number input before "5" ever lands),
    // and fireEvent.submit bypasses the browser's own min=0 constraint
    // validation so the component's own JS validation actually runs.
    fireEvent.change(input, { target: { value: '-5' } });
    fireEvent.submit(input.closest('form')!);

    // Assert
    expect(screen.getByText(/enter a tip of \$0\.00 or more/i)).toBeInTheDocument();
    expect(billingApi.tip).not.toHaveBeenCalled();
  });

  it('submits a valid custom tip amount', async () => {
    // Arrange
    const updated = makeInvoice({ tip: 12 });
    vi.mocked(billingApi.tip).mockResolvedValue({ invoice: updated });
    const user = userEvent.setup();
    render(<TipControl invoice={makeInvoice()} onUpdated={vi.fn()} />);

    // Act
    await user.type(screen.getByLabelText('Custom tip amount'), '12');
    await user.click(screen.getByRole('button', { name: /set tip/i }));

    // Assert
    expect(billingApi.tip).toHaveBeenCalledWith('inv_1', { amount: 12 });
  });

  it('locks every control once a split share has already been paid', () => {
    // Arrange
    const invoice = makeInvoice({ split: { mode: 'even', createdAt: '', parts: [{ label: 'Guest 1', amount: 25, itemIds: [], paid: true }] } });

    // Act
    render(<TipControl invoice={invoice} onUpdated={vi.fn()} />);

    // Assert
    expect(screen.getByRole('button', { name: /no tip/i })).toBeDisabled();
    expect(screen.getByText(/a guest has already paid their share/i)).toBeInTheDocument();
  });
});

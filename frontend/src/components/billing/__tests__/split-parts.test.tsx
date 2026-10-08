import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SplitParts } from '@/components/billing/split-parts';
import { billingApi } from '@/lib/api';
import type { Invoice } from '@/types';

vi.mock('@/lib/api', () => ({ billingApi: { paySplitPart: vi.fn(), clearSplit: vi.fn() } }));
vi.mock('@/components/ui/toast', () => ({ useToast: () => vi.fn() }));

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 'inv_1',
    number: 101,
    total: 50,
    paymentStatus: 'unpaid',
    lines: [],
    split: {
      mode: 'even',
      createdAt: '',
      parts: [
        { label: 'Guest 1', amount: 25, itemIds: [], paid: false },
        { label: 'Guest 2', amount: 25, itemIds: [], paid: false },
      ],
    },
    ...overrides,
  } as Invoice;
}

describe('SplitParts', () => {
  it('renders nothing when the invoice has no split', () => {
    // Arrange / Act
    const { container } = render(<SplitParts invoice={makeInvoice({ split: null })} onUpdated={vi.fn()} />);

    // Assert
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the shares adding up to the bill total', () => {
    // Arrange / Act
    render(<SplitParts invoice={makeInvoice()} onUpdated={vi.fn()} />);

    // Assert
    expect(screen.getByText(/shares total \$50\.00 = bill total \$50\.00/i)).toBeInTheDocument();
    expect(screen.getByText(/0 of 2 paid/)).toBeInTheDocument();
  });

  it('flags when the shares do not add up to the total', () => {
    // Arrange
    const invoice = makeInvoice({ total: 60 });

    // Act
    render(<SplitParts invoice={invoice} onUpdated={vi.fn()} />);

    // Assert
    expect(screen.getByText(/shares total \$50\.00 ≠ bill total \$60\.00/i)).toBeInTheDocument();
  });

  it('pays a share and reports the outcome', async () => {
    // Arrange
    const onUpdated = vi.fn();
    const updated = makeInvoice({ paymentStatus: 'paid' });
    vi.mocked(billingApi.paySplitPart).mockResolvedValue({ invoice: updated });
    const user = userEvent.setup({ delay: null });
    render(<SplitParts invoice={makeInvoice()} onUpdated={onUpdated} />);

    // Act
    await user.click(screen.getByRole('button', { name: /guest 1: pay \$25\.00 by card/i }));

    // Assert
    expect(billingApi.paySplitPart).toHaveBeenCalledWith('inv_1', 0, 'card');
    expect(onUpdated).toHaveBeenCalledWith(updated);
  });

  it('offers Undo split only before any share is paid', () => {
    // Arrange
    const paidOne = makeInvoice({
      split: {
        mode: 'even',
        createdAt: '',
        parts: [
          { label: 'Guest 1', amount: 25, itemIds: [], paid: true },
          { label: 'Guest 2', amount: 25, itemIds: [], paid: false },
        ],
      },
    });

    // Act
    render(<SplitParts invoice={paidOne} onUpdated={vi.fn()} />);

    // Assert
    expect(screen.queryByRole('button', { name: /undo split/i })).not.toBeInTheDocument();
    expect(screen.getByText(/can't be undone/i)).toBeInTheDocument();
  });

  it('shows "Settled with bill" once the whole bill is paid', () => {
    // Arrange
    const invoice = makeInvoice({ paymentStatus: 'paid' });

    // Act
    render(<SplitParts invoice={invoice} onUpdated={vi.fn()} />);

    // Assert
    expect(screen.getAllByText('Settled with bill')).toHaveLength(2);
  });
});

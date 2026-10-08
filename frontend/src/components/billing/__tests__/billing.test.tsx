/**
 * Tests for the billing container/presentational components that don't have
 * their own file in this folder: bill-list, bill-panel, receipt and
 * split-dialog. bill-summary, bill-utils, payment-actions, refund-dialog,
 * split-parts, tip-control and use-bill-action have their own test files.
 *
 * Every test follows Arrange-Act-Assert, with each phase commented.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BillList } from '@/components/billing/bill-list';
import { BillPanel } from '@/components/billing/bill-panel';
import { Receipt } from '@/components/billing/receipt';
import { SplitDialog } from '@/components/billing/split-dialog';
import { ApiError, billingApi } from '@/lib/api';
import type { BillLine, Invoice, Role } from '@/types';

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  auth: { user: { role: 'manager' } as { role: string } | null },
}));

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  billingApi: {
    get: vi.fn(),
    tip: vi.fn(),
    splitEven: vi.fn(),
    splitByItems: vi.fn(),
    clearSplit: vi.fn(),
    paySplitPart: vi.fn(),
    pay: vi.fn(),
    unpay: vi.fn(),
    refund: vi.fn(),
  },
}));
vi.mock('@/components/ui/toast', () => ({ useToast: () => mocks.toast }));
vi.mock('@/context/auth-context', () => ({ useAuth: () => mocks.auth }));
// Keep the panel from polling in the background during tests.
vi.mock('@/hooks/use-polling', () => ({ usePolling: vi.fn() }));

const LINES: BillLine[] = [
  {
    id: 'ln_burger',
    name: 'Burger',
    qty: 2,
    basePrice: 12,
    modifiers: [{ groupId: 'g1', optionId: 'o1', label: 'Extra cheese', priceDelta: 1 }] as unknown as BillLine['modifiers'],
    unitPrice: 12,
    lineTotal: 24,
  },
  { id: 'ln_salad', name: 'Salad', qty: 1, basePrice: 16, modifiers: [], unitPrice: 16, lineTotal: 16 },
];

/** Subtotal 40 + 10% service 4 + 8% tax 3.20 = 47.20. */
function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 'inv_1',
    number: 101,
    receiptNumber: 'R-000101',
    type: 'dine-in',
    fulfillment: 'dine-in',
    tableNumber: 4,
    customerName: null,
    waiterName: 'Sam',
    status: 'served',
    paymentStatus: 'unpaid',
    paymentMethod: null,
    paid: false,
    lines: LINES,
    subtotal: 40,
    discount: 0,
    pointsUsed: 0,
    pointsEarned: 0,
    serviceCharge: 4,
    serviceChargeRate: 0.1,
    tax: 3.2,
    taxRate: 0.08,
    tip: 0,
    total: 47.2,
    refund: null,
    refundedAmount: 0,
    netTotal: 47.2,
    split: null,
    createdAt: '2026-01-15T12:00:00.000Z',
    servedAt: null,
    paidAt: null,
    closedAt: null,
    restaurant: { name: 'Ember & Oak', address: '1 Fire Lane' },
    ...overrides,
  };
}

function paidInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return makeInvoice({
    status: 'closed',
    paymentStatus: 'paid',
    paymentMethod: 'card',
    paid: true,
    paidAt: '2026-01-15T13:00:00.000Z',
    ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.user = { role: 'manager' };
});

/* ------------------------------------------------------------------ BillList */

describe('BillList', () => {
  it('lists each bill with where it is, who it is for and its total', () => {
    // Arrange
    const bills = [
      makeInvoice({ id: 'b1', number: 101, tableNumber: 4, total: 47.2 }),
      makeInvoice({ id: 'b2', number: 102, type: 'online', fulfillment: 'pickup', tableNumber: null, customerName: 'Ana Diaz', total: 18 }),
    ];

    // Act
    render(<BillList bills={bills} selectedId={null} onSelect={vi.fn()} />);

    // Assert — desktop table rows (the phone list repeats the same bills)
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText('Table 4')).toBeInTheDocument();
    expect(within(rows[0]).getByText('Walk-in')).toBeInTheDocument();
    expect(within(rows[0]).getByText('$47.20')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Pickup')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Ana Diaz')).toBeInTheDocument();
    expect(within(rows[1]).getByText('$18.00')).toBeInTheDocument();
  });

  it('flags served-but-unpaid bills as ready to bill and shows split progress and refunds', () => {
    // Arrange
    const bills = [
      makeInvoice({ id: 'b1', number: 101, status: 'served' }),
      makeInvoice({
        id: 'b2',
        number: 102,
        status: 'preparing',
        split: {
          mode: 'even',
          createdAt: '',
          parts: [
            { label: 'Guest 1', amount: 23.6, itemIds: [], paid: true },
            { label: 'Guest 2', amount: 23.6, itemIds: [], paid: false },
          ],
        },
      }),
      paidInvoice({ id: 'b3', number: 103, paymentStatus: 'refunded', refundedAmount: 5 }),
    ];

    // Act
    render(<BillList bills={bills} selectedId={null} onSelect={vi.fn()} />);

    // Assert
    const [served, preparing, refunded] = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(within(served).getByText('Ready to bill')).toBeInTheDocument();
    expect(within(served).queryByText('Served')).not.toBeInTheDocument();
    expect(within(preparing).getByText('Preparing')).toBeInTheDocument();
    expect(within(preparing).getByText('Split 1/2')).toBeInTheDocument();
    expect(within(refunded).getByText('Refunded')).toBeInTheDocument();
    expect(within(refunded).getByText('−$5.00 refunded')).toBeInTheDocument();
  });

  it('picks a bill from the desktop table, the row itself or the phone list', async () => {
    // Arrange
    const onSelect = vi.fn();
    const first = makeInvoice({ id: 'b1', number: 101 });
    const second = makeInvoice({ id: 'b2', number: 102, tableNumber: 7 });
    const user = userEvent.setup({ delay: null });
    render(<BillList bills={[first, second]} selectedId={null} onSelect={onSelect} />);

    // Act
    await user.click(screen.getByRole('button', { name: 'Open bill #102' }));
    // Assert — the button doesn't also trigger the row's handler
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenLastCalledWith(second);

    // Act
    await user.click(within(screen.getByRole('table')).getByText('Table 4'));
    // Assert
    expect(onSelect).toHaveBeenCalledTimes(2);
    expect(onSelect).toHaveBeenLastCalledWith(first);

    // Act — phone card
    await user.click(within(screen.getByRole('list')).getByRole('button', { name: /#102/ }));
    // Assert
    expect(onSelect).toHaveBeenCalledTimes(3);
    expect(onSelect).toHaveBeenLastCalledWith(second);
  });

  it('highlights the selected bill', () => {
    // Arrange
    const bills = [makeInvoice({ id: 'b1', number: 101 }), makeInvoice({ id: 'b2', number: 102 })];

    // Act
    render(<BillList bills={bills} selectedId="b2" onSelect={vi.fn()} />);

    // Assert
    expect(screen.getByRole('button', { name: 'Open bill #102' }).closest('tr')).toHaveClass('bg-brand-50');
    expect(screen.getByRole('button', { name: 'Open bill #101' }).closest('tr')).not.toHaveClass('bg-brand-50');
  });
});

/* ----------------------------------------------------------------- BillPanel */

describe('BillPanel', () => {
  it('loads the bill and assembles lines, tip, split and pay actions for an open bill', async () => {
    // Arrange
    vi.mocked(billingApi.get).mockResolvedValue({ invoice: makeInvoice() });

    // Act
    render(<BillPanel billId="inv_1" onChanged={vi.fn()} onClose={vi.fn()} />);

    // Assert — spinner first, then the bill
    expect(screen.getByText('Loading bill…')).toBeInTheDocument();
    expect(await screen.findByRole('region', { name: 'Itemized bill' })).toBeInTheDocument();
    expect(billingApi.get).toHaveBeenCalledWith('inv_1');
    expect(screen.getByText('Ready to bill')).toBeInTheDocument();
    expect(screen.getByText('2 × Burger')).toBeInTheDocument();
    expect(screen.getByText('1 × Salad')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /tip/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Split bill…' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /paid by card/i })).toBeInTheDocument();
    expect(screen.getByText(/service charge 10% \(dine-in only\)/i)).toBeInTheDocument();
  });

  it('shows the list row instantly while the fresh invoice loads', () => {
    // Arrange
    vi.mocked(billingApi.get).mockReturnValue(new Promise(() => {}));

    // Act
    render(<BillPanel billId="inv_1" initial={makeInvoice()} onChanged={vi.fn()} onClose={vi.fn()} />);

    // Assert
    expect(screen.queryByText('Loading bill…')).not.toBeInTheDocument();
    expect(screen.getByText('2 × Burger')).toBeInTheDocument();
  });

  it('records a payment, reports the change and switches to the paid view', async () => {
    // Arrange
    const onChanged = vi.fn();
    vi.mocked(billingApi.get).mockResolvedValue({ invoice: makeInvoice() });
    vi.mocked(billingApi.pay).mockResolvedValue({ invoice: paidInvoice(), alreadyPaid: false });
    const user = userEvent.setup({ delay: null });
    render(<BillPanel billId="inv_1" onChanged={onChanged} onClose={vi.fn()} />);
    await screen.findByRole('region', { name: 'Itemized bill' });

    // Act
    await user.click(screen.getByRole('button', { name: /paid by card/i }));

    // Assert
    expect(billingApi.pay).toHaveBeenCalledWith('inv_1', 'card');
    expect(onChanged).toHaveBeenCalled();
    expect(await screen.findByRole('region', { name: 'Receipt' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Split bill…' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /mark unpaid/i })).toBeInTheDocument();
  });

  it('opens the split dialog and reports it as open', async () => {
    // Arrange
    const onDialogChange = vi.fn();
    vi.mocked(billingApi.get).mockResolvedValue({ invoice: makeInvoice() });
    const user = userEvent.setup({ delay: null });
    render(<BillPanel billId="inv_1" onChanged={vi.fn()} onClose={vi.fn()} onDialogChange={onDialogChange} />);
    await screen.findByRole('region', { name: 'Itemized bill' });

    // Act
    await user.click(screen.getByRole('button', { name: 'Split bill…' }));

    // Assert
    expect(screen.getByRole('dialog', { name: 'Split bill #101' })).toBeInTheDocument();
    expect(onDialogChange).toHaveBeenLastCalledWith(true);

    // Act
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));

    // Assert
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onDialogChange).toHaveBeenLastCalledWith(false);
  });

  it('shows the paid receipt with refund for a manager, and a read-only note for a waiter', async () => {
    // Arrange
    vi.mocked(billingApi.get).mockResolvedValue({ invoice: paidInvoice() });
    const { unmount } = render(<BillPanel billId="inv_1" onChanged={vi.fn()} onClose={vi.fn()} />);

    // Act
    await screen.findByRole('region', { name: 'Receipt' });

    // Assert — manager
    expect(screen.getByRole('button', { name: /refund…/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/staff/settings');
    expect(screen.queryByRole('button', { name: /paid by card/i })).not.toBeInTheDocument();

    // Arrange
    unmount();
    mocks.auth.user = { role: 'waiter' as Role };

    // Act
    render(<BillPanel billId="inv_1" onChanged={vi.fn()} onClose={vi.fn()} />);
    await screen.findByRole('region', { name: 'Receipt' });

    // Assert — waiter
    expect(screen.queryByRole('button', { name: /refund…/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /mark unpaid/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument();
    expect(screen.getByText(/settings by a manager/i)).toBeInTheDocument();
  });

  it('warns that a cancelled order can\'t be billed and offers no actions', async () => {
    // Arrange
    vi.mocked(billingApi.get).mockResolvedValue({ invoice: makeInvoice({ status: 'cancelled' }) });

    // Act
    render(<BillPanel billId="inv_1" onChanged={vi.fn()} onClose={vi.fn()} />);

    // Assert
    expect(await screen.findByText(/cancelled and can't be billed/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Split bill…' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /paid by card/i })).not.toBeInTheDocument();
  });

  it('closes with a toast when the bill no longer exists', async () => {
    // Arrange
    const onClose = vi.fn();
    vi.mocked(billingApi.get).mockRejectedValue(new ApiError('Not found', 404, null));

    // Act
    render(<BillPanel billId="inv_gone" onChanged={vi.fn()} onClose={onClose} />);

    // Assert
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mocks.toast).toHaveBeenCalledWith('This bill no longer exists.', 'error');
  });

  it('closes from the header button when asked to show one', async () => {
    // Arrange
    const onClose = vi.fn();
    vi.mocked(billingApi.get).mockResolvedValue({ invoice: makeInvoice() });
    const user = userEvent.setup({ delay: null });
    render(<BillPanel billId="inv_1" onChanged={vi.fn()} onClose={onClose} showHeaderClose />);
    await screen.findByRole('region', { name: 'Itemized bill' });

    // Act
    await user.click(screen.getByRole('button', { name: 'Close bill details' }));

    // Assert
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

/* ------------------------------------------------------------------- Receipt */

describe('Receipt', () => {
  it('renders a paid invoice with its lines, totals and payment', () => {
    // Arrange
    const invoice = paidInvoice({ tip: 5, total: 52.2, netTotal: 52.2, pointsEarned: 52, customerName: 'Ana Diaz' });

    // Act
    render(<Receipt invoice={invoice} />);

    // Assert — header
    expect(screen.getByText('Ember & Oak')).toBeInTheDocument();
    expect(screen.getByText('Receipt')).toBeInTheDocument();
    expect(screen.getByText('R-000101')).toBeInTheDocument();
    expect(screen.getByText('Table 4')).toBeInTheDocument();
    expect(screen.getByText('Server: Sam')).toBeInTheDocument();
    expect(screen.getByText('Guest: Ana Diaz')).toBeInTheDocument();
    // Lines, with modifiers and per-unit price for qty > 1
    expect(screen.getByText('2 × Burger')).toBeInTheDocument();
    expect(screen.getByText('Extra cheese (+$1.00)')).toBeInTheDocument();
    expect(screen.getByText('@ $12.00 each')).toBeInTheDocument();
    expect(screen.getByText('1 × Salad')).toBeInTheDocument();
    expect(screen.queryByText('@ $16.00 each')).not.toBeInTheDocument();
    // Totals
    expect(screen.getByText('Subtotal').nextSibling).toHaveTextContent('$40.00');
    expect(screen.getByText('Service charge (10%)').nextSibling).toHaveTextContent('$4.00');
    expect(screen.getByText('Tax (8%)').nextSibling).toHaveTextContent('$3.20');
    expect(screen.getByText('Tip').nextSibling).toHaveTextContent('$5.00');
    expect(screen.getByText('Total').nextSibling).toHaveTextContent('$52.20');
    // Payment
    expect(screen.getByText(/paid by card · \+52 flame points/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Print receipt' })).toBeInTheDocument();
  });

  it('shows a points discount, refund and net paid, and the shares of a split', () => {
    // Arrange
    const invoice = paidInvoice({
      paymentStatus: 'refunded',
      discount: 2,
      pointsUsed: 200,
      total: 45.2,
      refund: { amount: 10, reason: 'Cold food', at: '2026-01-15T14:00:00.000Z', by: 'usr_manager' },
      refundedAmount: 10,
      netTotal: 35.2,
      split: {
        mode: 'items',
        createdAt: '',
        parts: [
          { label: 'Guest 1', amount: 27.12, itemIds: ['ln_burger'], paid: true, method: 'cash' },
          { label: 'Guest 2', amount: 18.08, itemIds: ['ln_salad'], paid: true, method: 'card' },
        ],
      },
    });

    // Act
    render(<Receipt invoice={invoice} />);

    // Assert
    expect(screen.getByText('Flame Points (200)').nextSibling).toHaveTextContent('−$2.00');
    expect(screen.getByText('Refunded — Cold food').nextSibling).toHaveTextContent('−$10.00');
    expect(screen.getByText('Net paid').nextSibling).toHaveTextContent('$35.20');
    expect(screen.getByText('Split by items')).toBeInTheDocument();
    expect(screen.getByText('Guest 1 · paid cash').nextSibling).toHaveTextContent('$27.12');
    expect(screen.getByText('Guest 2 · paid card').nextSibling).toHaveTextContent('$18.08');
    expect(screen.getByText(/paid by card · refunded/i)).toBeInTheDocument();
  });

  it('renders an unpaid bill as a bill, not a receipt, without the zero-value rows', () => {
    // Arrange
    const invoice = makeInvoice({ type: 'online', fulfillment: 'pickup', tableNumber: null, serviceCharge: 0, waiterName: null });

    // Act
    render(<Receipt invoice={invoice} showPrint={false} />);

    // Assert
    expect(screen.getByText('Bill')).toBeInTheDocument();
    expect(screen.getByText('Order #101')).toBeInTheDocument();
    expect(screen.getByText('Pickup')).toBeInTheDocument();
    expect(screen.getByText(/unpaid — please settle with your server/i)).toBeInTheDocument();
    expect(screen.queryByText(/service charge/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Tip')).not.toBeInTheDocument();
    expect(screen.queryByText(/flame points/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /print/i })).not.toBeInTheDocument();
  });

  it('prints from the Print button', async () => {
    // Arrange
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    const user = userEvent.setup({ delay: null });
    render(<Receipt invoice={makeInvoice()} />);

    // Act
    await user.click(screen.getByRole('button', { name: 'Print bill' }));

    // Assert
    expect(print).toHaveBeenCalledTimes(1);
    print.mockRestore();
  });
});

/* --------------------------------------------------------------- SplitDialog */

describe('SplitDialog', () => {
  it('previews an even split that adds up to the total and submits it', async () => {
    // Arrange
    const onClose = vi.fn();
    const onUpdated = vi.fn();
    const updated = makeInvoice({ split: { mode: 'even', createdAt: '', parts: [] } });
    vi.mocked(billingApi.splitEven).mockResolvedValue({ invoice: updated });
    const user = userEvent.setup({ delay: null });
    render(<SplitDialog invoice={makeInvoice()} onClose={onClose} onUpdated={onUpdated} />);

    // Act
    await user.click(screen.getByRole('button', { name: 'More payers' }));

    // Assert — $47.20 three ways: shares differ by at most one cent
    const shares = screen.getAllByRole('listitem');
    expect(shares).toHaveLength(3);
    expect(shares[0]).toHaveTextContent('Guest 1$15.74');
    expect(shares[1]).toHaveTextContent('Guest 2$15.73');
    expect(shares[2]).toHaveTextContent('Guest 3$15.73');
    expect(screen.getByText(/shares total \$47\.20 = bill total \$47\.20/i)).toBeInTheDocument();

    // Act
    await user.click(screen.getByRole('button', { name: 'Split 3 ways' }));

    // Assert
    expect(billingApi.splitEven).toHaveBeenCalledWith('inv_1', 3);
    expect(onUpdated).toHaveBeenCalledWith(updated);
    expect(mocks.toast).toHaveBeenCalledWith('Bill split evenly between 3 payers.', 'success');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps the number of payers between 2 and 20', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    render(<SplitDialog invoice={makeInvoice()} onClose={vi.fn()} onUpdated={vi.fn()} />);

    // Assert — starts at the minimum
    expect(screen.getByRole('button', { name: 'Fewer payers' })).toBeDisabled();

    // Act
    for (let i = 0; i < 25; i++) await user.click(screen.getByRole('button', { name: 'More payers' }));

    // Assert
    expect(screen.getByRole('button', { name: 'More payers' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Split 20 ways' })).toBeInTheDocument();
  });

  it('rejects a by-items split until every item is assigned to a guest', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    render(<SplitDialog invoice={makeInvoice()} onClose={vi.fn()} onUpdated={vi.fn()} />);

    // Act
    await user.click(screen.getByRole('tab', { name: 'By items' }));

    // Assert — nothing assigned yet
    expect(screen.getByRole('tab', { name: 'By items' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Assign all 2 remaining items to a guest.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /split between/i })).toBeDisabled();

    // Act
    await user.selectOptions(screen.getByLabelText('Guest paying for Burger'), 'Guest 1');

    // Assert — one item still uncovered
    expect(screen.getByText('Assign the last item to a guest.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /split between/i })).toBeDisabled();
    expect(billingApi.splitByItems).not.toHaveBeenCalled();
  });

  it('rejects a by-items split that gives every item to a single guest', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    render(<SplitDialog invoice={makeInvoice()} onClose={vi.fn()} onUpdated={vi.fn()} />);
    await user.click(screen.getByRole('tab', { name: 'By items' }));

    // Act
    await user.selectOptions(screen.getByLabelText('Guest paying for Burger'), 'Guest 1');
    await user.selectOptions(screen.getByLabelText('Guest paying for Salad'), 'Guest 1');

    // Assert
    expect(screen.getByText('Give items to at least two guests.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Split between 1 guest' })).toBeDisabled();
  });

  it('previews proportional shares for a valid by-items split and submits the groups', async () => {
    // Arrange
    const onClose = vi.fn();
    const updated = makeInvoice({ split: { mode: 'items', createdAt: '', parts: [] } });
    vi.mocked(billingApi.splitByItems).mockResolvedValue({ invoice: updated });
    const user = userEvent.setup({ delay: null });
    render(<SplitDialog invoice={makeInvoice()} onClose={onClose} onUpdated={vi.fn()} />);
    await user.click(screen.getByRole('tab', { name: 'By items' }));

    // Act
    await user.selectOptions(screen.getByLabelText('Guest paying for Burger'), 'Guest 1');
    await user.selectOptions(screen.getByLabelText('Guest paying for Salad'), 'Guest 2');

    // Assert — burger is 24/40 of the subtotal, so 60% of $47.20
    const preview = within(screen.getByText('Preview').nextElementSibling as HTMLElement).getAllByRole('listitem');
    expect(preview[0]).toHaveTextContent('Guest 1 · Burger$28.32');
    expect(preview[1]).toHaveTextContent('Guest 2 · Salad$18.88');
    expect(screen.getByText(/shares total \$47\.20 = bill total \$47\.20/i)).toBeInTheDocument();

    // Act
    await user.click(screen.getByRole('button', { name: 'Split between 2 guests' }));

    // Assert
    expect(billingApi.splitByItems).toHaveBeenCalledWith('inv_1', [['ln_burger'], ['ln_salad']]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('returns items to unassigned when their guest is removed', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    render(<SplitDialog invoice={makeInvoice()} onClose={vi.fn()} onUpdated={vi.fn()} />);
    await user.click(screen.getByRole('tab', { name: 'By items' }));
    await user.click(screen.getByRole('button', { name: 'More guests' }));
    await user.selectOptions(screen.getByLabelText('Guest paying for Burger'), 'Guest 1');
    await user.selectOptions(screen.getByLabelText('Guest paying for Salad'), 'Guest 3');

    // Act
    await user.click(screen.getByRole('button', { name: 'Fewer guests' }));

    // Assert
    expect(screen.getByLabelText('Guest paying for Salad')).toHaveValue('0');
    expect(screen.getByText('Assign the last item to a guest.')).toBeInTheDocument();
  });

  it('only offers the by-items split when the bill has at least two lines', () => {
    // Arrange
    const invoice = makeInvoice({ lines: [LINES[0]] });

    // Act
    render(<SplitDialog invoice={invoice} onClose={vi.fn()} onUpdated={vi.fn()} />);

    // Assert
    expect(screen.getByRole('tab', { name: 'By items' })).toBeDisabled();
    expect(screen.getByText(/needs at least two lines/i)).toBeInTheDocument();
  });

  it('stays open and shows the error when the split is rejected', async () => {
    // Arrange
    const onClose = vi.fn();
    const onConflict = vi.fn();
    vi.mocked(billingApi.splitEven).mockRejectedValue(new ApiError('Bill already paid', 409, null));
    const user = userEvent.setup({ delay: null });
    render(<SplitDialog invoice={makeInvoice()} onClose={onClose} onUpdated={vi.fn()} onConflict={onConflict} />);

    // Act
    await user.click(screen.getByRole('button', { name: 'Split 2 ways' }));

    // Assert
    expect(mocks.toast).toHaveBeenCalledWith('Bill already paid', 'error');
    expect(onConflict).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Split bill #101' })).toBeInTheDocument();
  });
});

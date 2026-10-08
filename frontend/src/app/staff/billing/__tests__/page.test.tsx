import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BillingPage from '@/app/staff/billing/page';
import { billingApi } from '@/lib/api';
import type { Bill, BillingSummary } from '@/types';

const toastFn = vi.fn();
vi.mock('@/components/ui/toast', () => ({ useToast: () => toastFn }));
vi.mock('@/components/layout/staff-layout', () => ({ StaffLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return { ...actual, billingApi: { ...actual.billingApi, list: vi.fn() } };
});
vi.mock('@/components/billing/bill-summary', () => ({
  BillSummary: ({ summary }: { summary: BillingSummary | null }) => <div data-testid="bill-summary">{summary ? summary.openCount : '—'}</div>,
}));
vi.mock('@/components/billing/bill-list', () => ({
  BillList: ({ bills, onSelect }: { bills: Bill[]; onSelect: (b: Bill) => void }) => (
    <div data-testid="bill-list">
      {bills.map((b) => (
        <button key={b.id} onClick={() => onSelect(b)}>
          Bill #{b.number}
        </button>
      ))}
    </div>
  ),
}));
vi.mock('@/components/billing/bill-panel', () => ({ BillPanel: ({ billId }: { billId: string }) => <div data-testid="bill-panel">{billId}</div> }));

function makeBill(overrides: Partial<Bill> = {}): Bill {
  return {
    id: 'bill_1', number: 101, receiptNumber: 'R-101', type: 'dine-in', fulfillment: 'dine-in', tableNumber: 4,
    customerName: 'Jordan Guest', waiterName: 'Jamie', status: 'served', paymentStatus: 'unpaid', paymentMethod: null,
    paid: false, lines: [], subtotal: 20, discount: 0, pointsUsed: 0, pointsEarned: 0, serviceCharge: 2,
    serviceChargeRate: 0.1, tax: 1.6, taxRate: 0.08, tip: 0, total: 23.6, refund: null, refundedAmount: 0,
    netTotal: 23.6, split: null, createdAt: '2026-10-01T12:00:00.000Z', servedAt: '2026-10-01T12:10:00.000Z',
    ...overrides,
  } as Bill;
}

function makeSummary(overrides: Partial<BillingSummary> = {}): BillingSummary {
  return { outstanding: 100, openCount: 2, paidToday: 500, paidTodayCount: 10, ...overrides };
}

describe('BillingPage', () => {
  beforeEach(() => {
    toastFn.mockClear();
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    );
  });

  it('shows a loading spinner, then the bill summary and list', async () => {
    // Arrange
    vi.mocked(billingApi.list).mockResolvedValue({ bills: [makeBill()], summary: makeSummary() });

    // Act
    render(<BillingPage />);

    // Assert
    expect(screen.getByText('Loading bills…')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Bill #101' })).toBeInTheDocument();
    expect(screen.getByTestId('bill-summary')).toHaveTextContent('2');
  });

  it('shows an empty state for the open tab when nothing is owed', async () => {
    // Arrange
    vi.mocked(billingApi.list).mockResolvedValue({ bills: [], summary: makeSummary({ openCount: 0 }) });

    // Act
    render(<BillingPage />);

    // Assert
    expect(await screen.findByText('No open bills')).toBeInTheDocument();
  });

  it('reloads with a new scope when a tab is selected', async () => {
    // Arrange
    vi.mocked(billingApi.list).mockResolvedValue({ bills: [], summary: makeSummary() });
    const user = userEvent.setup({ delay: null });
    render(<BillingPage />);
    await screen.findByText('No open bills');

    // Act
    await user.click(screen.getByRole('tab', { name: /^Today/ }));

    // Assert
    await waitFor(() => expect(billingApi.list).toHaveBeenLastCalledWith('today'));
  });

  it('opens a bill panel when a bill is selected', async () => {
    // Arrange
    vi.mocked(billingApi.list).mockResolvedValue({ bills: [makeBill()], summary: makeSummary() });
    const user = userEvent.setup({ delay: null });
    render(<BillingPage />);
    await screen.findByRole('button', { name: 'Bill #101' });

    // Act
    await user.click(screen.getByRole('button', { name: 'Bill #101' }));

    // Assert
    expect(await screen.findByTestId('bill-panel')).toHaveTextContent('bill_1');
  });

  it('shows an error state with a retry button when loading fails', async () => {
    // Arrange
    vi.mocked(billingApi.list).mockRejectedValue(new Error('Network error'));

    // Act
    render(<BillingPage />);

    // Assert
    expect(await screen.findByText("Couldn't load bills")).toBeInTheDocument();
    expect(toastFn).toHaveBeenCalledWith('Network error', 'error');
  });
});

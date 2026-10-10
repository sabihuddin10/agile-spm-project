import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OrdersPage from '@/app/staff/orders/page';
import { useAuth } from '@/context/auth-context';
import { orderApi, tableApi } from '@/lib/api';
import type { Order, Table, User } from '@/types';

vi.mock('@/context/auth-context', () => ({ useAuth: vi.fn() }));
const toastFn = vi.fn();
vi.mock('@/components/ui/toast', () => ({ useToast: () => toastFn }));
vi.mock('@/components/layout/staff-layout', () => ({ StaffLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return { ...actual, orderApi: { ...actual.orderApi, list: vi.fn() }, tableApi: { ...actual.tableApi, list: vi.fn() } };
});
vi.mock('@/components/orders/use-order-menu', () => ({ useMenuIndex: () => new Map() }));
vi.mock('@/components/orders/order-card', () => ({
  OrderCard: ({ order }: { order: Order }) => <div data-testid={`order-card-${order.id}`}>{order.status}</div>,
}));
vi.mock('@/components/orders/new-order-modal', () => ({
  NewOrderModal: ({ onClose, onCreated }: { onClose: () => void; onCreated: (o: Order) => void }) => (
    <div data-testid="new-order-modal">
      <button onClick={onClose}>Close modal</button>
      <button onClick={() => onCreated(makeOrder({ id: 'new_1', status: 'placed' }))}>Create</button>
    </div>
  ),
}));
vi.mock('@/components/orders/edit-items-modal', () => ({ EditItemsModal: () => <div data-testid="edit-items-modal" /> }));
vi.mock('@/components/orders/order-history-table', () => ({
  OrderHistoryTable: ({ orders }: { orders: Order[] }) => <div data-testid="order-history-table">{orders.length} rows</div>,
}));

function makeUser(overrides: Partial<User> = {}): User {
  return { id: 'u1', name: 'Jamie', email: 'jamie@rest.test', role: 'waiter', active: true, ...overrides };
}

function makeOrder(overrides: Partial<Order> = {}): Order {
  return { id: 'o1', status: 'placed', createdAt: '2026-10-01T10:00:00.000Z', ...overrides } as Order;
}

describe('OrdersPage', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.mocked(orderApi.list).mockReset();
    vi.mocked(tableApi.list).mockReset();
  });

  it('polls orders every 5 s but loads tables once, refreshing them on a 30 s cycle', async () => {
    // Arrange
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(useAuth).mockReturnValue({ user: makeUser() } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(orderApi.list).mockResolvedValue({ orders: [makeOrder({ id: 'o1' })] });
    vi.mocked(tableApi.list).mockResolvedValue({ tables: [], zones: [], statuses: [] });
    render(<OrdersPage />);
    await screen.findByTestId('order-card-o1');

    // Act
    await act(async () => {
      vi.advanceTimersByTime(10000);
    });

    // Assert
    expect(orderApi.list).toHaveBeenCalledTimes(3);
    expect(tableApi.list).toHaveBeenCalledTimes(1);

    // Act
    await act(async () => {
      vi.advanceTimersByTime(20000);
    });

    // Assert
    expect(tableApi.list).toHaveBeenCalledTimes(2);
  });
  it('shows a loading spinner, then the loaded active orders', async () => {
    // Arrange
    vi.mocked(useAuth).mockReturnValue({ user: makeUser() } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(orderApi.list).mockResolvedValue({ orders: [makeOrder({ id: 'o1', status: 'placed' })] });
    vi.mocked(tableApi.list).mockResolvedValue({ tables: [], zones: [], statuses: [] });

    // Act
    render(<OrdersPage />);

    // Assert
    expect(screen.getByText('Loading orders…')).toBeInTheDocument();
    expect(await screen.findByTestId('order-card-o1')).toBeInTheDocument();
  });

  it('shows the "+ New order" action for a role that can place staff orders', async () => {
    // Arrange
    vi.mocked(orderApi.list).mockResolvedValue({ orders: [] });
    vi.mocked(tableApi.list).mockResolvedValue({ tables: [], zones: [], statuses: [] });
    vi.mocked(useAuth).mockReturnValue({ user: makeUser({ role: 'waiter' }) } as unknown as ReturnType<typeof useAuth>);

    // Act
    render(<OrdersPage />);

    // Assert
    expect(await screen.findByText(/active orders right now/i)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '+ New order' }).length).toBeGreaterThan(0);
  });

  it('filters the active orders shown by status', async () => {
    // Arrange
    vi.mocked(useAuth).mockReturnValue({ user: makeUser() } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(orderApi.list).mockResolvedValue({
      orders: [makeOrder({ id: 'placed_1', status: 'placed' }), makeOrder({ id: 'ready_1', status: 'ready' })],
    });
    vi.mocked(tableApi.list).mockResolvedValue({ tables: [], zones: [], statuses: [] });
    const user = userEvent.setup({ delay: null });
    render(<OrdersPage />);
    await screen.findByTestId('order-card-placed_1');

    // Act
    await user.click(screen.getByRole('button', { name: /Ready to serve/ }));

    // Assert
    expect(screen.getByTestId('order-card-ready_1')).toBeInTheDocument();
    expect(screen.queryByTestId('order-card-placed_1')).not.toBeInTheDocument();
  });

  it("shows today's closed/cancelled order count in the history table", async () => {
    // Arrange
    vi.mocked(useAuth).mockReturnValue({ user: makeUser() } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(orderApi.list).mockResolvedValue({
      orders: [makeOrder({ id: 'closed_1', status: 'closed', closedAt: '2026-10-01T12:00:00.000Z' } as Partial<Order>)],
    });
    vi.mocked(tableApi.list).mockResolvedValue({ tables: [], zones: [], statuses: [] });

    // Act
    render(<OrdersPage />);

    // Assert
    expect(await screen.findByTestId('order-history-table')).toHaveTextContent('1 rows');
  });

  it('opens the new-order modal and reloads once an order is created', async () => {
    // Arrange
    vi.mocked(useAuth).mockReturnValue({ user: makeUser() } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(orderApi.list).mockResolvedValueOnce({ orders: [] });
    vi.mocked(orderApi.list).mockResolvedValue({ orders: [makeOrder({ id: 'new_1', status: 'placed' })] });
    vi.mocked(tableApi.list).mockResolvedValue({ tables: [], zones: [], statuses: [] });
    const user = userEvent.setup({ delay: null });
    render(<OrdersPage />);
    await screen.findByText(/active orders right now/i);

    // Act
    await user.click(screen.getAllByRole('button', { name: '+ New order' })[0]);
    await user.click(screen.getByRole('button', { name: 'Create' }));

    // Assert
    expect(await screen.findByTestId('order-card-new_1')).toBeInTheDocument();
    expect(screen.queryByTestId('new-order-modal')).not.toBeInTheDocument();
  });

  it('shows a retry banner and recovers when the load fails', async () => {
    // Arrange
    vi.mocked(useAuth).mockReturnValue({ user: makeUser() } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(orderApi.list).mockRejectedValueOnce(new Error('Network error'));
    vi.mocked(orderApi.list).mockResolvedValue({ orders: [makeOrder({ id: 'o1' })] });
    vi.mocked(tableApi.list).mockResolvedValue({ tables: [], zones: [], statuses: [] });
    const user = userEvent.setup({ delay: null });
    render(<OrdersPage />);

    // Assert
    expect(await screen.findByText(/Couldn.t refresh orders/)).toBeInTheDocument();

    // Act
    await user.click(screen.getByRole('button', { name: 'Retry now' }));

    // Assert
    await waitFor(() => expect(screen.queryByText(/Couldn.t refresh orders/)).not.toBeInTheDocument());
  });
});

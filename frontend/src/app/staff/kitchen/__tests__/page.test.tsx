import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import KitchenPage from '@/app/staff/kitchen/page';
import { useAuth } from '@/context/auth-context';
import { orderApi } from '@/lib/api';
import type { KitchenResponse, Order, User } from '@/types';

vi.mock('@/context/auth-context', () => ({ useAuth: vi.fn() }));
const toastFn = vi.fn();
vi.mock('@/components/ui/toast', () => ({ useToast: () => toastFn }));
vi.mock('@/components/layout/staff-layout', () => ({ StaffLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return { ...actual, orderApi: { ...actual.orderApi, kitchen: vi.fn() } };
});
vi.mock('@/components/orders/use-order-menu', () => ({ useMenuIndex: () => new Map() }));
vi.mock('@/components/orders/kitchen-ticket', () => ({
  KitchenTicket: ({ order }: { order: Order }) => <div data-testid={`kitchen-ticket-${order.id}`} />,
  isDelayed: (order: Order & { confirmedAt?: string }, delayMinutes: number, now: number) => {
    const since = (now - new Date(order.confirmedAt ?? order.createdAt).getTime()) / 60000;
    return since > delayMinutes;
  },
}));
vi.mock('@/components/orders/ready-ticket', () => ({ ReadyTicket: ({ order }: { order: Order }) => <div data-testid={`ready-ticket-${order.id}`} /> }));

function makeUser(overrides: Partial<User> = {}): User {
  return { id: 'u1', name: 'Chef Lee', email: 'chef@rest.test', role: 'chef', active: true, ...overrides };
}

function makeOrder(overrides: Partial<Order> = {}): Order {
  return { id: 'o1', status: 'confirmed', priority: 'normal', createdAt: '2026-10-01T10:00:00.000Z', confirmedAt: '2026-10-01T10:00:00.000Z', ...overrides } as Order;
}

function makeKitchen(overrides: Partial<KitchenResponse> = {}): KitchenResponse {
  return { queue: [], ready: [], delayMinutes: 15, ...overrides };
}

describe('KitchenPage', () => {
  it('shows a loading spinner, then queue and ready tallies once loaded', async () => {
    // Arrange
    vi.mocked(useAuth).mockReturnValue({ user: makeUser() } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(orderApi.kitchen).mockResolvedValue(
      makeKitchen({ queue: [makeOrder({ id: 'q1' }), makeOrder({ id: 'q2', priority: 'rush' })], ready: [makeOrder({ id: 'r1', status: 'ready' })] }),
    );

    // Act
    render(<KitchenPage />);

    // Assert
    expect(screen.getByText('Loading kitchen queue…')).toBeInTheDocument();
    expect(await screen.findByTestId('kitchen-ticket-q1')).toBeInTheDocument();
    expect(screen.getByTestId('kitchen-ticket-q2')).toBeInTheDocument();
    expect(screen.getByTestId('ready-ticket-r1')).toBeInTheDocument();
  });

  it('shows empty states when the queue and the pass are both clear', async () => {
    // Arrange
    vi.mocked(useAuth).mockReturnValue({ user: makeUser() } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(orderApi.kitchen).mockResolvedValue(makeKitchen());

    // Act
    render(<KitchenPage />);

    // Assert
    expect(await screen.findByText('Kitchen is clear')).toBeInTheDocument();
    expect(screen.getByText('Nothing at the pass')).toBeInTheDocument();
  });

  it('shows an error state with a retry button when the queue fails to load', async () => {
    // Arrange
    vi.mocked(useAuth).mockReturnValue({ user: makeUser() } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(orderApi.kitchen).mockRejectedValue(new Error('Network error'));

    // Act
    render(<KitchenPage />);

    // Assert
    expect(await screen.findByText("Couldn't load the kitchen queue")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});

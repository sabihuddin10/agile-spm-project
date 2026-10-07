import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import AccountPage from '@/app/account/page';
import { useAuth } from '@/context/auth-context';
import { customerApi } from '@/lib/api';
import type { Customer, User } from '@/types';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
vi.mock('@/context/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return { ...actual, customerApi: { ...actual.customerApi, me: vi.fn() } };
});
vi.mock('@/components/layout/storefront-shell', () => ({ StorefrontShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('@/components/account/my-orders', () => ({ MyOrders: () => <div data-testid="my-orders" /> }));
vi.mock('@/components/account/my-reservations', () => ({ MyReservations: () => <div data-testid="my-reservations" /> }));
vi.mock('@/components/account/profile-editor', () => ({ ProfileEditor: ({ customer }: { customer: Customer }) => <div data-testid="profile-editor">{customer.name}</div> }));

function makeUser(overrides: Partial<User> = {}): User {
  return { id: 'u1', name: 'Casey Customer', email: 'casey@example.com', role: 'customer', active: true, ...overrides };
}

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 'cus_1', userId: 'u1', name: 'Casey Customer', email: 'casey@example.com', phone: '',
    type: 'online', loyaltyPoints: 40, totalSpend: 120, preferences: { dietary: [], allergies: [] } as never,
    notes: '', orderCount: 5, ...overrides,
  } as Customer;
}

describe('AccountPage', () => {
  it('shows a loading spinner while the session is resolving', () => {
    // Arrange / Act
    vi.mocked(useAuth).mockReturnValue({ user: null, loading: true } as unknown as ReturnType<typeof useAuth>);
    render(<AccountPage />);

    // Assert
    expect(screen.getByText('Loading account…')).toBeInTheDocument();
  });

  it('redirects a staff member to the staff console', async () => {
    // Arrange / Act
    vi.mocked(useAuth).mockReturnValue({ user: makeUser({ role: 'manager' }), loading: false } as unknown as ReturnType<typeof useAuth>);
    render(<AccountPage />);

    // Assert
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/staff'));
  });

  it("loads and shows the customer's stats, orders, profile and reservations", async () => {
    // Arrange
    vi.mocked(useAuth).mockReturnValue({ user: makeUser(), loading: false } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(customerApi.me).mockResolvedValue({ customer: makeCustomer({ loyaltyPoints: 40, totalSpend: 120 }) });

    // Act
    render(<AccountPage />);

    // Assert
    expect(await screen.findByTestId('profile-editor')).toHaveTextContent('Casey Customer');
    expect(screen.getByText('40')).toBeInTheDocument();
    expect(screen.getByText('$120.00')).toBeInTheDocument();
    expect(screen.getByTestId('my-orders')).toBeInTheDocument();
    expect(screen.getByTestId('my-reservations')).toBeInTheDocument();
  });

  it('shows an error with a retry option when the profile fails to load', async () => {
    // Arrange
    vi.mocked(useAuth).mockReturnValue({ user: makeUser(), loading: false } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(customerApi.me).mockRejectedValue(new Error('Network error'));

    // Act
    render(<AccountPage />);

    // Assert
    expect(await screen.findByText('Network error')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});

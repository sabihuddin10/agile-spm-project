import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DevShell } from '@/components/layout/dev-shell';
import { MenuDrawer } from '@/components/layout/menu-drawer';
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav';
import { NotificationBell } from '@/components/layout/notification-bell';
import { StaffLayout } from '@/components/layout/staff-layout';
import { StaffShell } from '@/components/layout/staff-shell';
import { StorefrontShell } from '@/components/layout/storefront-shell';
import { useAuth } from '@/context/auth-context';
import { useCart } from '@/context/cart-context';
import { notificationApi } from '@/lib/api';
import type { AppNotification, User } from '@/types';

const push = vi.fn();
const replace = vi.fn();
const pathname = { value: '/staff' };
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace }),
  usePathname: () => pathname.value,
}));
vi.mock('@/context/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock('@/context/cart-context', () => ({ useCart: vi.fn() }));
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return { ...actual, notificationApi: { list: vi.fn(), read: vi.fn(), readAll: vi.fn() } };
});
vi.mock('@/components/menu/cart-drawer', () => ({ CartDrawer: () => <div data-testid="cart-drawer-stub" /> }));

function makeUser(overrides: Partial<User> = {}): User {
  return { id: 'u1', name: 'Casey Chef', email: 'casey@rest.test', role: 'chef', active: true, ...overrides };
}

function makeNotification(overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id: 'n1',
    title: 'Order ready',
    message: 'Table 4 is ready to serve',
    read: false,
    createdAt: '2026-10-01T12:00:00.000Z',
    link: '/staff/orders',
    ...overrides,
  } as AppNotification;
}

beforeEach(() => {
  push.mockClear();
  replace.mockClear();
  pathname.value = '/staff';
  vi.mocked(notificationApi.list).mockResolvedValue({ notifications: [], unreadCount: 0 });
});

describe('DevShell', () => {
  it('renders nothing when there is no signed-in user', () => {
    // Arrange
    vi.mocked(useAuth).mockReturnValue({ user: null, logout: vi.fn() } as unknown as ReturnType<typeof useAuth>);

    // Act
    const { container } = render(<DevShell>content</DevShell>);

    // Assert
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the user name, role badge and a staff console link for staff roles', () => {
    // Arrange
    vi.mocked(useAuth).mockReturnValue({ user: makeUser({ role: 'manager' }), logout: vi.fn() } as unknown as ReturnType<typeof useAuth>);

    // Act
    render(<DevShell>content</DevShell>);

    // Assert
    expect(screen.getByText('Casey Chef')).toBeInTheDocument();
    expect(screen.getByText('manager')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Staff console' })).toBeInTheDocument();
  });

  it('hides the staff console link for a customer', () => {
    // Arrange
    vi.mocked(useAuth).mockReturnValue({ user: makeUser({ role: 'customer' }), logout: vi.fn() } as unknown as ReturnType<typeof useAuth>);

    // Act
    render(<DevShell>content</DevShell>);

    // Assert
    expect(screen.queryByRole('link', { name: 'Staff console' })).not.toBeInTheDocument();
  });

  it('signs out and redirects to login', async () => {
    // Arrange
    const logout = vi.fn();
    vi.mocked(useAuth).mockReturnValue({ user: makeUser(), logout } as unknown as ReturnType<typeof useAuth>);
    const user = userEvent.setup({ delay: null });
    render(<DevShell>content</DevShell>);

    // Act
    await user.click(screen.getByRole('button', { name: 'Sign out' }));

    // Assert
    expect(logout).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith('/login');
  });
});

describe('MenuDrawer', () => {
  it('renders nothing when closed', () => {
    // Arrange / Act
    vi.mocked(useAuth).mockReturnValue({ user: null, logout: vi.fn() } as unknown as ReturnType<typeof useAuth>);
    const { container } = render(<MenuDrawer open={false} onClose={vi.fn()} />);

    // Assert
    expect(container).toBeEmptyDOMElement();
  });

  it('shows sign-in and register links for a guest', () => {
    // Arrange / Act
    vi.mocked(useAuth).mockReturnValue({ user: null, logout: vi.fn() } as unknown as ReturnType<typeof useAuth>);
    render(<MenuDrawer open onClose={vi.fn()} />);

    // Assert
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create an account' })).toBeInTheDocument();
  });

  it('shows account links for a signed-in customer and closes on navigation', async () => {
    // Arrange
    const onClose = vi.fn();
    vi.mocked(useAuth).mockReturnValue({ user: makeUser({ role: 'customer' }), logout: vi.fn() } as unknown as ReturnType<typeof useAuth>);
    const user = userEvent.setup({ delay: null });
    render(<MenuDrawer open onClose={onClose} />);

    // Act
    await user.click(screen.getByRole('link', { name: 'My orders' }));

    // Assert
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('link', { name: 'Staff console' })).not.toBeInTheDocument();
  });

  it('shows a staff console link instead of account links for staff', () => {
    // Arrange / Act
    vi.mocked(useAuth).mockReturnValue({ user: makeUser({ role: 'chef' }), logout: vi.fn() } as unknown as ReturnType<typeof useAuth>);
    render(<MenuDrawer open onClose={vi.fn()} />);

    // Assert
    expect(screen.getByRole('link', { name: 'Staff console' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'My orders' })).not.toBeInTheDocument();
  });

  it('signs out and closes when "Sign out" is clicked', async () => {
    // Arrange
    const logout = vi.fn();
    const onClose = vi.fn();
    vi.mocked(useAuth).mockReturnValue({ user: makeUser({ role: 'customer' }), logout } as unknown as ReturnType<typeof useAuth>);
    const user = userEvent.setup({ delay: null });
    render(<MenuDrawer open onClose={onClose} />);

    // Act
    await user.click(screen.getByRole('button', { name: 'Sign out' }));

    // Assert
    expect(logout).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when the Escape key is pressed', async () => {
    // Arrange
    const onClose = vi.fn();
    vi.mocked(useAuth).mockReturnValue({ user: null, logout: vi.fn() } as unknown as ReturnType<typeof useAuth>);
    const user = userEvent.setup({ delay: null });
    render(<MenuDrawer open onClose={onClose} />);

    // Act
    await user.keyboard('{Escape}');

    // Assert
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('MobileBottomNav', () => {
  it('points Orders and Profile at /login for a signed-out guest', () => {
    // Arrange
    pathname.value = '/';
    vi.mocked(useAuth).mockReturnValue({ user: null } as unknown as ReturnType<typeof useAuth>);

    // Act
    render(<MobileBottomNav />);

    // Assert
    expect(screen.getByRole('link', { name: /Orders/i })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: /Profile/i })).toHaveAttribute('href', '/login');
  });

  it('routes a customer to their account and marks home active', () => {
    // Arrange
    pathname.value = '/';
    vi.mocked(useAuth).mockReturnValue({ user: makeUser({ role: 'customer' }) } as unknown as ReturnType<typeof useAuth>);

    // Act
    render(<MobileBottomNav />);

    // Assert
    expect(screen.getByRole('link', { name: /Orders/i })).toHaveAttribute('href', '/account#orders');
    expect(screen.getByRole('link', { name: /Profile/i })).toHaveAttribute('href', '/account');
    expect(screen.getByRole('link', { name: /Home/i })).toHaveAttribute('aria-current', 'page');
  });

  it('routes staff to the staff console and their orders section', () => {
    // Arrange
    pathname.value = '/staff';
    vi.mocked(useAuth).mockReturnValue({ user: makeUser({ role: 'waiter' }) } as unknown as ReturnType<typeof useAuth>);

    // Act
    render(<MobileBottomNav />);

    // Assert
    expect(screen.getByRole('link', { name: /Orders/i })).toHaveAttribute('href', '/staff/orders');
    expect(screen.getByRole('link', { name: /Console/i })).toHaveAttribute('href', '/staff');
  });

  it("sends a chef (no 'orders' access) to the kitchen screen instead", () => {
    // Arrange
    pathname.value = '/staff';
    vi.mocked(useAuth).mockReturnValue({ user: makeUser({ role: 'chef' }) } as unknown as ReturnType<typeof useAuth>);

    // Act
    render(<MobileBottomNav />);

    // Assert
    expect(screen.getByRole('link', { name: /Orders/i })).toHaveAttribute('href', '/staff/kitchen');
  });
});

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.mocked(notificationApi.read).mockResolvedValue({ notification: makeNotification({ read: true }) });
    vi.mocked(notificationApi.readAll).mockResolvedValue({ ok: true });
  });

  it('shows the unread count badge after loading notifications', async () => {
    // Arrange
    vi.mocked(notificationApi.list).mockResolvedValue({ notifications: [makeNotification()], unreadCount: 1 });

    // Act
    render(<NotificationBell />);

    // Assert
    expect(await screen.findByLabelText('Notifications, 1 unread')).toBeInTheDocument();
  });

  it('opens the dropdown and shows an empty state when there are no notifications', async () => {
    // Arrange
    vi.mocked(notificationApi.list).mockResolvedValue({ notifications: [], unreadCount: 0 });
    const user = userEvent.setup({ delay: null });
    render(<NotificationBell />);
    await screen.findByLabelText('Notifications');

    // Act
    await user.click(screen.getByLabelText('Notifications'));

    // Assert
    expect(screen.getByText("You're all caught up.")).toBeInTheDocument();
  });

  it('opens an unread item, marks it read and navigates to its link', async () => {
    // Arrange
    const n = makeNotification();
    vi.mocked(notificationApi.list).mockResolvedValue({ notifications: [n], unreadCount: 1 });
    const user = userEvent.setup({ delay: null });
    render(<NotificationBell />);
    await screen.findByLabelText('Notifications, 1 unread');

    // Act
    await user.click(screen.getByLabelText('Notifications, 1 unread'));
    await user.click(screen.getByText('Order ready'));

    // Assert
    expect(notificationApi.read).toHaveBeenCalledWith('n1');
    expect(push).toHaveBeenCalledWith('/staff/orders');
  });

  it('marks all notifications read', async () => {
    // Arrange
    vi.mocked(notificationApi.list).mockResolvedValue({
      notifications: [makeNotification({ id: 'n1' }), makeNotification({ id: 'n2' })],
      unreadCount: 2,
    });
    const user = userEvent.setup({ delay: null });
    render(<NotificationBell />);
    await screen.findByLabelText('Notifications, 2 unread');

    // Act
    await user.click(screen.getByLabelText('Notifications, 2 unread'));
    await user.click(screen.getByRole('button', { name: 'Mark all read' }));

    // Assert
    expect(notificationApi.readAll).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByLabelText('Notifications')).toBeInTheDocument());
  });
});

describe('StaffLayout', () => {
  it('shows a loading spinner while the session is resolving', () => {
    // Arrange / Act
    vi.mocked(useAuth).mockReturnValue({ user: null, loading: true } as unknown as ReturnType<typeof useAuth>);
    render(<StaffLayout>content</StaffLayout>);

    // Assert
    expect(screen.getByText('Loading session…')).toBeInTheDocument();
  });

  it('redirects to login when there is no signed-in user', () => {
    // Arrange
    vi.mocked(useAuth).mockReturnValue({ user: null, loading: false } as unknown as ReturnType<typeof useAuth>);

    // Act
    render(<StaffLayout>content</StaffLayout>);

    // Assert
    expect(replace).toHaveBeenCalledWith('/login');
  });

  it('redirects a customer to the homepage', () => {
    // Arrange
    vi.mocked(useAuth).mockReturnValue({ user: makeUser({ role: 'customer' }), loading: false, logout: vi.fn() } as unknown as ReturnType<typeof useAuth>);

    // Act
    render(<StaffLayout>content</StaffLayout>);

    // Assert
    expect(replace).toHaveBeenCalledWith('/');
  });

  it('renders the page content for a role permitted in the given section', () => {
    // Arrange
    vi.mocked(useAuth).mockReturnValue({ user: makeUser({ role: 'waiter' }), loading: false, logout: vi.fn() } as unknown as ReturnType<typeof useAuth>);

    // Act
    render(<StaffLayout section="overview">Orders dashboard</StaffLayout>);

    // Assert
    expect(screen.getByText('Orders dashboard')).toBeInTheDocument();
  });

  it('shows a 403 notice and redirects back to the dashboard for a forbidden section', () => {
    // Arrange
    vi.useFakeTimers();
    vi.mocked(useAuth).mockReturnValue({ user: makeUser({ role: 'waiter' }), loading: false, logout: vi.fn() } as unknown as ReturnType<typeof useAuth>);
    render(<StaffLayout section="staff">Staff management</StaffLayout>);
    expect(screen.getByText("You don't have access to this page")).toBeInTheDocument();

    // Act
    vi.advanceTimersByTime(2500);

    // Assert
    expect(replace).toHaveBeenCalledWith('/staff');
    vi.useRealTimers();
  });
});

describe('StaffShell', () => {
  it('renders nothing when there is no signed-in user', () => {
    // Arrange / Act
    vi.mocked(useAuth).mockReturnValue({ user: null, logout: vi.fn() } as unknown as ReturnType<typeof useAuth>);
    const { container } = render(<StaffShell>content</StaffShell>);

    // Assert
    expect(container).toBeEmptyDOMElement();
  });

  it("only shows nav sections the signed-in role can access", () => {
    // Arrange
    vi.mocked(useAuth).mockReturnValue({ user: makeUser({ role: 'chef' }), logout: vi.fn() } as unknown as ReturnType<typeof useAuth>);

    // Act
    render(<StaffShell>content</StaffShell>);

    // Assert
    expect(screen.getByRole('link', { name: /Kitchen \(KDS\)/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Staff management' })).not.toBeInTheDocument();
  });

  it('shows a "My account" link for every staff role', () => {
    for (const role of ['waiter', 'chef', 'manager', 'admin'] as const) {
      // Arrange
      vi.mocked(useAuth).mockReturnValue({ user: makeUser({ role }), logout: vi.fn() } as unknown as ReturnType<typeof useAuth>);

      // Act
      const { unmount } = render(<StaffShell>content</StaffShell>);

      // Assert
      expect(screen.getByRole('link', { name: 'My account' })).toHaveAttribute('href', '/staff/account');
      unmount();
    }
  });

  it('shows a temporary-password banner linking to My account', () => {
    // Arrange
    pathname.value = '/staff/orders';
    vi.mocked(useAuth).mockReturnValue({
      user: makeUser({ mustChangePassword: true }),
      logout: vi.fn(),
    } as unknown as ReturnType<typeof useAuth>);

    // Act
    render(<StaffShell>content</StaffShell>);

    // Assert
    expect(screen.getByText(/You're using a temporary password/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Set your own password' })).toHaveAttribute('href', '/staff/account');
  });

  it('hides the temporary-password banner on the account page itself', () => {
    // Arrange
    pathname.value = '/staff/account';
    vi.mocked(useAuth).mockReturnValue({
      user: makeUser({ mustChangePassword: true }),
      logout: vi.fn(),
    } as unknown as ReturnType<typeof useAuth>);

    // Act
    render(<StaffShell>content</StaffShell>);

    // Assert
    expect(screen.queryByText(/You're using a temporary password/)).not.toBeInTheDocument();
  });

  it('shows no banner once the user has their own password', () => {
    // Arrange
    vi.mocked(useAuth).mockReturnValue({ user: makeUser(), logout: vi.fn() } as unknown as ReturnType<typeof useAuth>);

    // Act
    render(<StaffShell>content</StaffShell>);

    // Assert
    expect(screen.queryByText(/You're using a temporary password/)).not.toBeInTheDocument();
  });

  it('signs out and routes to login', async () => {
    // Arrange
    const logout = vi.fn();
    vi.mocked(useAuth).mockReturnValue({ user: makeUser({ role: 'manager' }), logout } as unknown as ReturnType<typeof useAuth>);
    const user = userEvent.setup({ delay: null });
    render(<StaffShell>content</StaffShell>);

    // Act
    await user.click(screen.getByRole('button', { name: 'Sign out' }));

    // Assert
    expect(logout).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith('/login');
  });
});

describe('StorefrontShell', () => {
  beforeEach(() => {
    pathname.value = '/';
  });

  it('shows sign-in and join links for a guest', () => {
    // Arrange
    vi.mocked(useAuth).mockReturnValue({ user: null, logout: vi.fn() } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(useCart).mockReturnValue({ count: 0, setOpen: vi.fn() } as unknown as ReturnType<typeof useCart>);

    // Act
    render(<StorefrontShell>content</StorefrontShell>);

    // Assert
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Join' })).toBeInTheDocument();
  });

  it('shows the cart item count and opens the cart when clicked', async () => {
    // Arrange
    const setOpen = vi.fn();
    vi.mocked(useAuth).mockReturnValue({ user: null, logout: vi.fn() } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(useCart).mockReturnValue({ count: 3, setOpen } as unknown as ReturnType<typeof useCart>);
    const user = userEvent.setup({ delay: null });
    render(<StorefrontShell>content</StorefrontShell>);

    // Act
    await user.click(screen.getByLabelText('Open your order, 3 items'));

    // Assert
    expect(setOpen).toHaveBeenCalledWith(true);
  });

  it('shows a staff link and the account menu for a signed-in staff member', async () => {
    // Arrange
    const logout = vi.fn();
    vi.mocked(useAuth).mockReturnValue({ user: makeUser({ role: 'manager' }), logout } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(useCart).mockReturnValue({ count: 0, setOpen: vi.fn() } as unknown as ReturnType<typeof useCart>);
    const user = userEvent.setup({ delay: null });
    render(<StorefrontShell>content</StorefrontShell>);

    // Act
    await user.click(screen.getByLabelText('Account menu'));

    // Assert
    expect(screen.getByRole('link', { name: 'Staff console' })).toBeInTheDocument();

    // Act: sign out from the menu
    await user.click(screen.getByRole('button', { name: 'Sign out' }));

    // Assert
    expect(logout).toHaveBeenCalledTimes(1);
  });
});

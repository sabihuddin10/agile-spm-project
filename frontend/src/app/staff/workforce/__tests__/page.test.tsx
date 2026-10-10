/**
 * Workforce hub page, rendered against the in-browser workforce demo layer
 * (workforce-mock) as an admin and as a manager. Arrange-Act-Assert.
 */
import { useSyncExternalStore } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WorkforcePage from '@/app/staff/workforce/page';
import { useAuth } from '@/context/auth-context';
import { storeAuth } from '@/lib/api';
import { workforceApi, workforceMock } from '@/lib/workforce-api';
import type { User } from '@/types';

/** A tiny stand-in for the App Router: the query string lives in a store the hooks subscribe to. */
const nav = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  const state = { search: '', history: [] as string[] };
  const set = (url: string) => {
    state.search = url.includes('?') ? url.slice(url.indexOf('?')) : '';
    listeners.forEach((l) => l());
  };
  return {
    state,
    listeners,
    reset: () => {
      state.search = '';
      state.history = [];
    },
    push: vi.fn((url: string) => {
      state.history.push(state.search);
      set(url);
    }),
    replace: vi.fn((url: string) => set(url)),
    back: vi.fn(() => set(state.history.pop() ?? '')),
  };
});

vi.mock('next/navigation', () => ({
  usePathname: () => '/staff/workforce',
  useRouter: () => ({ push: nav.push, replace: nav.replace, back: nav.back }),
  useSearchParams: () => {
    const search = useSyncExternalStore(
      (cb) => {
        nav.listeners.add(cb);
        return () => nav.listeners.delete(cb);
      },
      () => nav.state.search,
    );
    return new URLSearchParams(search);
  },
}));
vi.mock('@/components/layout/staff-layout', () => ({
  StaffLayout: ({ children, section }: { children: React.ReactNode; section?: string }) => (
    <div data-testid="staff-layout" data-section={section}>
      {children}
    </div>
  ),
}));
vi.mock('@/context/auth-context', () => ({ useAuth: vi.fn() }));
const toast = vi.hoisted(() => vi.fn());
vi.mock('@/components/ui/toast', () => ({ useToast: () => toast }));
vi.mock('react-chartjs-2', () => ({
  Bar: () => <div data-testid="chart" />,
  Chart: () => <div data-testid="chart" />,
}));

const admin = { id: 'usr_admin', name: 'Alex Admin', email: 'admin@rest.test', role: 'admin', active: true } as User;
const manager = { id: 'usr_manager', name: 'Maya Manager', email: 'manager@rest.test', role: 'manager', active: true } as User;

function signIn(user: User) {
  storeAuth('token', user);
  vi.mocked(useAuth).mockReturnValue({ user } as unknown as ReturnType<typeof useAuth>);
}

beforeEach(() => {
  localStorage.clear();
  workforceMock.reset();
  toast.mockClear();
  nav.reset();
  nav.push.mockClear();
  nav.replace.mockClear();
  nav.back.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('WorkforcePage', () => {
  it('shows an admin payroll, everyone, and wage and bonus controls in the drill-down', async () => {
    // Arrange
    signIn(admin);
    const user = userEvent.setup({ delay: null });
    render(<WorkforcePage />);
    const table = (await screen.findByRole('heading', { name: 'Team' })).closest('section') as HTMLElement;

    // Act
    await user.click(within(table).getByRole('button', { name: 'Will Waiter' }));

    // Assert
    expect(screen.getByTestId('staff-layout')).toHaveAttribute('data-section', 'workforce');
    expect(await screen.findByLabelText('Hourly wage')).toHaveValue(12);
    expect(screen.getByRole('heading', { name: 'Add bonus or correction' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pay' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Back to team/ })).toBeInTheDocument();
  });

  it('lists the payroll tile and money columns for an admin', async () => {
    // Arrange
    signIn(admin);

    // Act
    render(<WorkforcePage />);

    // Assert
    expect(await screen.findByText('Payroll')).toBeInTheDocument();
    const team = screen.getByRole('heading', { name: 'Team' }).closest('section') as HTMLElement;
    const table = within(team).getAllByRole('table')[0];
    expect(within(table).getByText('Net pay')).toBeInTheDocument();
    expect(within(table).getByRole('button', { name: 'Alex Admin' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: "Who's in now" })).toBeInTheDocument();
    // Charts load lazily, after the numbers
    expect(await screen.findByRole('heading', { name: 'Team hours' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Hours by role' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Lateness' })).toBeInTheDocument();
  });

  it('shows a manager waiters and chefs with no money anywhere and no pay controls', async () => {
    // Arrange
    signIn(manager);
    const user = userEvent.setup({ delay: null });
    const { container } = render(<WorkforcePage />);
    const table = (await screen.findByRole('heading', { name: 'Team' })).closest('section') as HTMLElement;
    const overviewText = container.textContent ?? '';

    // Act
    await user.click(within(table).getByRole('button', { name: 'Carlos Chef' }));
    await screen.findByRole('heading', { name: /Sessions & shifts/ });

    // Assert
    expect(overviewText).not.toMatch(/\$/);
    expect(overviewText).not.toContain('Payroll');
    expect(within(table).queryByRole('button', { name: 'Alex Admin' })).not.toBeInTheDocument();
    expect(container.textContent).not.toMatch(/\$/);
    expect(screen.queryByLabelText('Hourly wage')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Pay' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Add bonus or correction' })).not.toBeInTheDocument();
  });

  it('puts the open drill-down in the URL so Back closes it', async () => {
    // Arrange
    signIn(admin);
    const user = userEvent.setup({ delay: null });
    render(<WorkforcePage />);
    const table = (await screen.findByRole('heading', { name: 'Team' })).closest('section') as HTMLElement;

    // Act
    await user.click(within(table).getByRole('button', { name: 'Will Waiter' }));
    // Assert
    expect(nav.push).toHaveBeenCalledWith('/staff/workforce?staff=usr_waiter');
    const back = await screen.findByRole('button', { name: /Back to team/ });

    // Act
    await user.click(back);
    // Assert — pops the history entry it pushed
    expect(nav.back).toHaveBeenCalled();
    expect(await screen.findByRole('heading', { name: 'Team' })).toBeInTheDocument();
  });

  it('opens a shared ?staff= link straight on the drill-down and closes it in place', async () => {
    // Arrange
    signIn(admin);
    nav.state.search = '?staff=usr_waiter';
    const user = userEvent.setup({ delay: null });
    render(<WorkforcePage />);
    expect(await screen.findByRole('heading', { name: 'Will Waiter' })).toBeInTheDocument();

    // Act
    await user.click(screen.getByRole('button', { name: /Back to team/ }));

    // Assert — nothing to pop, so the query is replaced
    expect(nav.replace).toHaveBeenCalledWith('/staff/workforce', { scroll: false });
    expect(nav.back).not.toHaveBeenCalled();
    expect(await screen.findByRole('heading', { name: 'Team' })).toBeInTheDocument();
  });

  it('offers Try again instead of spinning forever when the overview fails', async () => {
    // Arrange
    signIn(admin);
    const overview = vi.spyOn(workforceApi, 'overview').mockRejectedValueOnce(new Error('Network down'));
    const user = userEvent.setup({ delay: null });
    render(<WorkforcePage />);
    const retry = await screen.findByRole('button', { name: 'Try again' });
    expect(screen.getByText("Couldn't load the workforce overview")).toBeInTheDocument();

    // Act
    await user.click(retry);

    // Assert
    expect(await screen.findByRole('heading', { name: 'Team' })).toBeInTheDocument();
    expect(overview).toHaveBeenCalledTimes(2);
  });
});

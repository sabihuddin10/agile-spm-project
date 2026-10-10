import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StaffUsersPage from '@/app/staff/users/page';
import { useAuth } from '@/context/auth-context';
import { staffApi } from '@/lib/api';
import type { StaffApplication, User } from '@/types';

const toastFn = vi.fn();
vi.mock('@/components/ui/toast', () => ({ useToast: () => toastFn }));
vi.mock('@/context/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock('@/components/layout/staff-layout', () => ({ StaffLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return { ...actual, staffApi: { ...actual.staffApi, roster: vi.fn(), applications: vi.fn() } };
});
vi.mock('@/components/staff/team-panel', () => ({ TeamPanel: ({ roster }: { roster: User[] }) => <div data-testid="team-panel">{roster.length} staff</div> }));
vi.mock('@/components/staff/applications-panel', () => ({
  ApplicationsPanel: ({ applications }: { applications: StaffApplication[] }) => <div data-testid="applications-panel">{applications.length} applications</div>,
}));
vi.mock('@/components/staff/shift-planner', () => ({ ShiftPlanner: () => <div data-testid="shift-planner" /> }));
vi.mock('@/components/staff/performance-panel', () => ({ PerformancePanel: () => <div data-testid="performance-panel" /> }));
vi.mock('@/components/staff/all-accounts-panel', () => ({ AllAccountsPanel: () => <div data-testid="all-accounts-panel" /> }));

function makeUser(overrides: Partial<User> = {}): User {
  return { id: 'u1', name: 'Jamie Manager', email: 'jamie@rest.test', role: 'manager', active: true, ...overrides };
}

function makeApplication(overrides: Partial<StaffApplication> = {}): StaffApplication {
  return {
    id: 'app_1', name: 'Alex Applicant', email: 'alex@example.com', phone: '', desiredRole: 'waiter',
    experience: '', status: 'pending', createdAt: '2026-10-01T00:00:00.000Z', decidedAt: null, decidedBy: null,
    userId: null, ...overrides,
  } as StaffApplication;
}

describe('StaffUsersPage', () => {
  beforeEach(() => {
    window.location.hash = '';
    vi.mocked(staffApi.roster).mockResolvedValue({ staff: [makeUser(), makeUser({ id: 'u2', role: 'waiter' })] });
    vi.mocked(staffApi.applications).mockResolvedValue({ applications: [] });
  });

  it('shows the team roster by default, with a count badge', async () => {
    // Arrange / Act
    vi.mocked(useAuth).mockReturnValue({ user: makeUser() } as unknown as ReturnType<typeof useAuth>);
    render(<StaffUsersPage />);

    // Assert
    expect(screen.getByRole('tab', { name: /Team/ })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByTestId('team-panel')).toHaveTextContent('2 staff');
  });

  it("only shows tabs the signed-in role is permitted to use", async () => {
    // Arrange / Act: a waiter has staff-section access but none of the manager-only actions
    vi.mocked(useAuth).mockReturnValue({ user: makeUser({ role: 'waiter' }) } as unknown as ReturnType<typeof useAuth>);
    render(<StaffUsersPage />);
    await screen.findByTestId('team-panel');

    // Assert
    expect(screen.queryByRole('tab', { name: /Applications/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Shifts/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /All accounts/ })).not.toBeInTheDocument();
  });

  it('shows a pending-applications badge and switches to that tab', async () => {
    // Arrange
    vi.mocked(staffApi.applications).mockResolvedValue({ applications: [makeApplication(), makeApplication({ id: 'app_2' })] });
    vi.mocked(useAuth).mockReturnValue({ user: makeUser() } as unknown as ReturnType<typeof useAuth>);
    const user = userEvent.setup({ delay: null });
    render(<StaffUsersPage />);
    await screen.findByTestId('team-panel');

    // Assert
    expect(screen.getByLabelText('2 pending')).toBeInTheDocument();

    // Act
    await user.click(screen.getByRole('tab', { name: /Applications/ }));

    // Assert
    expect(await screen.findByTestId('applications-panel')).toHaveTextContent('2 applications');
  });

  it('shows the "All accounts" tab only for an admin', async () => {
    // Arrange / Act
    vi.mocked(useAuth).mockReturnValue({ user: makeUser({ role: 'admin' }) } as unknown as ReturnType<typeof useAuth>);
    const user = userEvent.setup({ delay: null });
    render(<StaffUsersPage />);
    await screen.findByTestId('team-panel');

    // Act
    await user.click(screen.getByRole('tab', { name: 'All accounts' }));

    // Assert
    expect(await screen.findByTestId('all-accounts-panel')).toBeInTheDocument();
  });

  it('shows Try again instead of an empty roster when the team fails to load', async () => {
    // Arrange
    vi.mocked(staffApi.roster).mockRejectedValueOnce(new Error('Network down'));
    vi.mocked(useAuth).mockReturnValue({ user: makeUser() } as unknown as ReturnType<typeof useAuth>);
    const user = userEvent.setup({ delay: null });
    render(<StaffUsersPage />);
    const retry = await screen.findByRole('button', { name: 'Try again' });
    expect(screen.getByText("Couldn't load the team")).toBeInTheDocument();
    expect(screen.queryByTestId('team-panel')).not.toBeInTheDocument();

    // Act
    await user.click(retry);

    // Assert
    expect(await screen.findByTestId('team-panel')).toHaveTextContent('2 staff');
  });

  it('keeps sprint and story IDs out of the page subtitle', async () => {
    // Arrange / Act
    vi.mocked(useAuth).mockReturnValue({ user: makeUser() } as unknown as ReturnType<typeof useAuth>);
    render(<StaffUsersPage />);
    await screen.findByTestId('team-panel');

    // Assert
    expect(screen.getByText('Team roster and roles, hiring, the weekly rota and staff performance.')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Sprint \d|US\d/);
  });
});

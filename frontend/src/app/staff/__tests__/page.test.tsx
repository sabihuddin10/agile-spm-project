import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import StaffOverviewPage from '@/app/staff/page';
import { useAuth } from '@/context/auth-context';
import type { User } from '@/types';

vi.mock('@/context/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock('@/components/layout/staff-layout', () => ({
  StaffLayout: ({ children, section }: { children: React.ReactNode; section?: string }) => (
    <div data-testid="staff-layout" data-section={section}>
      {children}
    </div>
  ),
}));
vi.mock('@/components/overview/overview-dashboard', () => ({
  OverviewDashboard: ({ user }: { user: User }) => <div data-testid="overview-dashboard">{user.name}</div>,
}));

function makeUser(overrides: Partial<User> = {}): User {
  return { id: 'u1', name: 'Jamie Manager', email: 'jamie@rest.test', role: 'manager', active: true, ...overrides };
}

describe('StaffOverviewPage', () => {
  it('wraps the overview dashboard in the "overview" staff-layout section', () => {
    // Arrange / Act
    vi.mocked(useAuth).mockReturnValue({ user: makeUser() } as unknown as ReturnType<typeof useAuth>);
    render(<StaffOverviewPage />);

    // Assert
    expect(screen.getByTestId('staff-layout')).toHaveAttribute('data-section', 'overview');
    expect(screen.getByTestId('overview-dashboard')).toHaveTextContent('Jamie Manager');
  });

  it("doesn't render the dashboard before the user is known", () => {
    // Arrange / Act
    vi.mocked(useAuth).mockReturnValue({ user: null } as unknown as ReturnType<typeof useAuth>);
    render(<StaffOverviewPage />);

    // Assert
    expect(screen.queryByTestId('overview-dashboard')).not.toBeInTheDocument();
  });
});

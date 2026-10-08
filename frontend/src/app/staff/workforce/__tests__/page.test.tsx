/**
 * Workforce hub page, rendered against the in-browser workforce demo layer
 * (workforce-mock) as an admin and as a manager. Arrange-Act-Assert.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WorkforcePage from '@/app/staff/workforce/page';
import { useAuth } from '@/context/auth-context';
import { storeAuth } from '@/lib/api';
import { workforceMock } from '@/lib/workforce-api';
import type { User } from '@/types';

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
    expect(screen.getByRole('heading', { name: 'Team hours' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Hours by role' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Lateness' })).toBeInTheDocument();
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
});

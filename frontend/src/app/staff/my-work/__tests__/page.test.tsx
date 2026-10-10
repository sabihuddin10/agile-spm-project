/**
 * My work page, rendered against the in-browser workforce demo layer
 * (workforce-mock) as the signed-in waiter. Arrange-Act-Assert.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MyWorkPage from '@/app/staff/my-work/page';
import { useAuth } from '@/context/auth-context';
import { storeAuth } from '@/lib/api';
import { workforceApi, workforceMock } from '@/lib/workforce-api';
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

const waiter: User = { id: 'usr_waiter', name: 'Will Waiter', email: 'waiter@rest.test', role: 'waiter', active: true } as User;

beforeEach(() => {
  localStorage.clear();
  workforceMock.reset();
  storeAuth('token', waiter);
  vi.mocked(useAuth).mockReturnValue({ user: waiter } as unknown as ReturnType<typeof useAuth>);
  toast.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('MyWorkPage', () => {
  it('renders every section for a waiter, including their own pay', async () => {
    // Arrange / Act
    render(<MyWorkPage />);

    // Assert
    expect(screen.getByTestId('staff-layout')).toHaveAttribute('data-section', 'mywork');
    expect(screen.getByRole('heading', { name: 'My work' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Time clock' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check in' })).toBeInTheDocument();
    expect(await screen.findByRole('img', { name: /^Hours: / })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /^On time/ })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /^Attendance/ })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /^Pay so far: \$/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pay' })).toBeInTheDocument();
    expect(screen.getByTestId('pay-net')).toHaveTextContent(/^\$\d/);
    expect(await screen.findByRole('heading', { name: 'Hours breakdown' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Sessions & shifts/ })).toBeInTheDocument();
    const colleagues = screen.getByRole('heading', { name: 'Colleagues now' }).closest('section') as HTMLElement;
    expect(await within(colleagues).findByText('Wendy Server')).toBeInTheDocument();
    expect(within(colleagues).queryByText('Carlos Chef')).not.toBeInTheDocument();
  });

  it('checks in, then offers a break or check out', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    render(<MyWorkPage />);
    const checkIn = await screen.findByRole('button', { name: 'Check in' });

    // Act
    await user.click(checkIn);

    // Assert
    expect(await screen.findByRole('button', { name: 'Check out' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start break' })).toBeInTheDocument();
    expect(toast).toHaveBeenCalledWith('Checked in.', 'success');
  });

  it('offers Try again instead of spinning forever when the time clock and hours fail to load', async () => {
    // Arrange
    vi.spyOn(workforceApi, 'me').mockRejectedValueOnce(new Error('Network down'));
    const analytics = vi
      .spyOn(workforceApi, 'myAnalytics')
      .mockRejectedValueOnce(new Error('Network down'))
      .mockRejectedValueOnce(new Error('Network down'));
    const user = userEvent.setup({ delay: null });
    render(<MyWorkPage />);
    expect(await screen.findByText("Couldn't load your time clock")).toBeInTheDocument();
    expect(await screen.findByText("Couldn't load your hours")).toBeInTheDocument();
    const [retryClock, retryHours] = screen.getAllByRole('button', { name: 'Try again' });

    // Act
    await user.click(retryClock);
    await user.click(retryHours);

    // Assert
    expect(await screen.findByRole('button', { name: 'Check in' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Hours breakdown' })).toBeInTheDocument();
    expect(analytics).toHaveBeenCalledTimes(4);
  });
});

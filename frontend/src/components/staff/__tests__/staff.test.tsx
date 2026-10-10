/**
 * Module-wise tests for src/components/staff (components).
 *
 * confirm-dialog, credentials-modal, role-meta and shift-form have their own
 * test files in this folder; this file covers the remaining components:
 * account-table, all-accounts-panel, applications-panel, careers-form,
 * my-schedule, performance-panel, shift-planner and team-panel.
 *
 * Every test follows Arrange-Act-Assert (AAA), with each phase commented.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Shift, StaffApplication, StaffPerformance, User } from '@/types';
import { authApi, staffApi } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { AccountTable } from '@/components/staff/account-table';
import { AllAccountsPanel } from '@/components/staff/all-accounts-panel';
import { ApplicationsPanel } from '@/components/staff/applications-panel';
import { CareersForm } from '@/components/staff/careers-form';
import { MySchedule } from '@/components/staff/my-schedule';
import { PerformancePanel } from '@/components/staff/performance-panel';
import { ShiftPlanner } from '@/components/staff/shift-planner';
import { TeamPanel } from '@/components/staff/team-panel';

const { toastMock, auth } = vi.hoisted(() => ({
  // A stable toast function: several components list `toast` as a hook dependency.
  toastMock: vi.fn(),
  auth: { user: null as User | null },
}));

vi.mock('@/lib/api', async () => ({
  ApiError: (await vi.importActual<typeof import('@/lib/api')>('@/lib/api')).ApiError,
  authApi: {
    users: vi.fn(),
    updateUser: vi.fn(),
    removeUser: vi.fn(),
    updateUserProfile: vi.fn(),
    resetPassword: vi.fn(),
    setUserPassword: vi.fn(),
  },
  staffApi: {
    approve: vi.fn(),
    reject: vi.fn(),
    apply: vi.fn(),
    myShifts: vi.fn(),
    performance: vi.fn(),
    shifts: vi.fn(),
    createShift: vi.fn(),
    updateShift: vi.fn(),
    removeShift: vi.fn(),
  },
}));
vi.mock('@/components/ui/toast', () => ({ useToast: () => toastMock }));
vi.mock('@/context/auth-context', () => ({ useAuth: () => ({ user: auth.user }) }));

const admin: User = { id: 'usr_admin', name: 'Ada Admin', email: 'ada@rest.test', role: 'admin', active: true };
const manager: User = { id: 'usr_manager', name: 'Mia Manager', email: 'mia@rest.test', role: 'manager', active: true };
const chef: User = { id: 'usr_chef', name: 'Carlos Chef', email: 'carlos@rest.test', role: 'chef', active: true };
const waiter: User = { id: 'usr_waiter', name: 'Will Waiter', email: 'will@rest.test', role: 'waiter', active: true };
const suspendedWaiter: User = { id: 'usr_gone', name: 'Gina Gone', email: 'gina@rest.test', role: 'waiter', active: false };
const customer: User = { id: 'usr_cust', name: 'Cora Customer', email: 'cora@example.com', role: 'customer', active: true };

function makeShift(overrides: Partial<Shift> = {}): Shift {
  return {
    id: 'shf_1',
    userId: 'usr_waiter',
    userName: 'Will Waiter',
    role: 'waiter',
    date: '2026-10-07',
    start: '12:00',
    end: '18:00',
    hours: 6,
    notes: '',
    status: 'scheduled',
    ...overrides,
  } as Shift;
}

function makeApplication(overrides: Partial<StaffApplication> = {}): StaffApplication {
  return {
    id: 'app_1',
    name: 'Jane Applicant',
    email: 'jane@example.com',
    phone: '+92 300 5550100',
    desiredRole: 'waiter',
    experience: 'Two years at a bistro.',
    status: 'pending',
    createdAt: new Date().toISOString(),
    decidedAt: null,
    decidedBy: null,
    userId: null,
    ...overrides,
  };
}

/** Pin "now" to Wednesday 7 Oct 2026, 10:00 local time (week of Mon 5 – Sun 11 Oct). */
function pinNow(date = new Date(2026, 9, 7, 10, 0)) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(date);
}

afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
  auth.user = null;
});

/* ------------------------------------------------------------ account-table */

/** Opens a row's "More" menu (secondary account actions). */
async function openMore(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole('button', { name: `More actions for ${name}` }));
}

describe('AccountTable', () => {
  it('lists accounts by role rank, marks the signed-in admin and locks their own controls', () => {
    // Arrange
    auth.user = admin;

    // Act
    render(<AccountTable users={[waiter, chef, admin]} onChanged={vi.fn()} />);

    // Assert — sorted admin → chef → waiter
    const items = screen.getAllByRole('listitem');
    expect(items.map((li) => within(li).getByText(/@rest\.test$/).textContent)).toEqual([
      'ada@rest.test',
      'carlos@rest.test',
      'will@rest.test',
    ]);
    expect(within(items[0]).getByText('(you)')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Role for Ada Admin' })).toBeDisabled();
    expect(within(items[0]).getByRole('button', { name: 'More actions for Ada Admin' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Role for Will Waiter' })).toBeEnabled();
  });

  it('asks for confirmation before changing a role, then reports the new permissions', async () => {
    // Arrange
    auth.user = admin;
    const onChanged = vi.fn();
    vi.mocked(authApi.updateUser).mockResolvedValue({ user: { ...waiter, role: 'chef' } } as never);
    const user = userEvent.setup({ delay: null });
    render(<AccountTable users={[admin, waiter]} onChanged={onChanged} />);

    // Act
    await user.selectOptions(screen.getByRole('combobox', { name: 'Role for Will Waiter' }), 'chef');
    // Assert — staged, not applied
    const dialog = screen.getByRole('dialog', { name: 'Make Will Waiter a chef?' });
    expect(dialog).toHaveTextContent(/kitchen queue/i);
    expect(authApi.updateUser).not.toHaveBeenCalled();

    // Act
    await user.click(within(dialog).getByRole('button', { name: 'Make chef' }));
    // Assert
    expect(authApi.updateUser).toHaveBeenCalledWith('usr_waiter', { role: 'chef' });
    expect(toastMock).toHaveBeenCalledWith(expect.stringContaining('Will Waiter is now a chef'), 'success');
    expect(onChanged).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('leaves the role unchanged when the role change is cancelled', async () => {
    // Arrange
    auth.user = admin;
    const user = userEvent.setup({ delay: null });
    render(<AccountTable users={[admin, waiter]} onChanged={vi.fn()} />);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Role for Will Waiter' }), 'manager');

    // Act
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    // Assert
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(authApi.updateUser).not.toHaveBeenCalled();
    expect(screen.getByRole('combobox', { name: 'Role for Will Waiter' })).toHaveValue('waiter');
  });

  it('suspends an active user only after confirming, and offers to reactivate a suspended one', async () => {
    // Arrange
    auth.user = admin;
    vi.mocked(authApi.updateUser).mockResolvedValue({ user: waiter } as never);
    const user = userEvent.setup({ delay: null });
    render(<AccountTable users={[admin, waiter, suspendedWaiter]} onChanged={vi.fn()} />);
    const ginaRow = screen.getByText('Gina Gone').closest('li')!;

    // Act
    await openMore(user, 'Will Waiter');
    await user.click(screen.getByRole('menuitem', { name: 'Suspend' }));
    // Assert — confirmation first
    expect(screen.getByRole('dialog', { name: 'Suspend Will Waiter?' })).toBeInTheDocument();
    expect(authApi.updateUser).not.toHaveBeenCalled();

    // Act
    await user.click(screen.getByRole('button', { name: 'Suspend account' }));
    // Assert
    expect(authApi.updateUser).toHaveBeenCalledWith('usr_waiter', { active: false });
    expect(toastMock).toHaveBeenCalledWith(expect.stringMatching(/will waiter suspended/i), 'success');
    expect(within(ginaRow).getByText('Suspended')).toBeInTheDocument();

    // Act
    await openMore(user, 'Gina Gone');
    // Assert
    expect(screen.getByRole('menuitem', { name: 'Reactivate' })).toBeInTheDocument();
  });

  it('opens the More menu accessibly and closes it with Escape', async () => {
    // Arrange
    auth.user = admin;
    const user = userEvent.setup({ delay: null });
    render(<AccountTable users={[admin, waiter]} onChanged={vi.fn()} />);
    const trigger = screen.getByRole('button', { name: 'More actions for Will Waiter' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    // Act
    await user.click(trigger);
    // Assert — Remove sits last, after a divider
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const items = within(screen.getByRole('menu')).getAllByRole('menuitem');
    expect(items.map((i) => i.textContent)).toEqual(['Reset password', 'Set password', 'Suspend', 'Remove']);
    expect(screen.getByRole('separator')).toBeInTheDocument();
    expect(items[0]).toHaveFocus();

    // Act
    await user.keyboard('{Escape}');
    // Assert
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveFocus();
  });

  it('removes an account only after the confirm dialog', async () => {
    // Arrange
    auth.user = admin;
    vi.mocked(authApi.removeUser).mockResolvedValue({ deleted: true } as never);
    const onChanged = vi.fn();
    const user = userEvent.setup({ delay: null });
    render(<AccountTable users={[admin, waiter]} onChanged={onChanged} />);

    // Act
    await openMore(user, 'Will Waiter');
    await user.click(screen.getByRole('menuitem', { name: 'Remove' }));
    // Assert — confirmation first, nothing removed yet
    expect(screen.getByRole('dialog', { name: 'Remove Will Waiter?' })).toBeInTheDocument();
    expect(authApi.removeUser).not.toHaveBeenCalled();

    // Act
    await user.click(screen.getByRole('button', { name: 'Remove account' }));
    // Assert
    expect(authApi.removeUser).toHaveBeenCalledWith('usr_waiter');
    expect(onChanged).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('shows roles read-only with no suspend/remove actions for a manager', async () => {
    // Arrange
    auth.user = manager;
    const user = userEvent.setup({ delay: null });
    render(<AccountTable users={[manager, waiter]} onChanged={vi.fn()} />);

    // Act
    await openMore(user, 'Will Waiter');

    // Assert
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Suspend' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Remove' })).not.toBeInTheDocument();
    expect(screen.getByText('Waiter')).toBeInTheDocument();
  });

  it('gives a manager Edit details / Reset password on waiters and chefs only', async () => {
    // Arrange
    auth.user = manager;
    const otherManager: User = { ...manager, id: 'usr_manager2', name: 'Max Manager', email: 'max@rest.test' };
    const user = userEvent.setup({ delay: null });
    render(<AccountTable users={[admin, manager, otherManager, chef, waiter]} onChanged={vi.fn()} />);

    // Act
    await openMore(user, 'Will Waiter');

    // Assert
    expect(screen.getByRole('menuitem', { name: 'Reset password for Will Waiter' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /^Set password for/ })).not.toBeInTheDocument();
    for (const name of ['Will Waiter', 'Carlos Chef']) {
      expect(screen.getByRole('button', { name: `Edit details for ${name}` })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: `More actions for ${name}` })).toBeInTheDocument();
    }
    for (const name of ['Ada Admin', 'Mia Manager', 'Max Manager']) {
      expect(screen.queryByRole('button', { name: `Edit details for ${name}` })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: `More actions for ${name}` })).not.toBeInTheDocument();
    }
  });

  it('gives an admin every control on a manager but none on another admin', async () => {
    // Arrange
    auth.user = admin;
    const otherAdmin: User = { ...admin, id: 'usr_admin2', name: 'Abe Admin', email: 'abe@rest.test' };
    const user = userEvent.setup({ delay: null });
    render(<AccountTable users={[admin, otherAdmin, manager]} onChanged={vi.fn()} />);

    // Act
    await openMore(user, 'Mia Manager');

    // Assert — manager row: full controls
    const miaRow = screen.getByText('Mia Manager').closest('li')!;
    expect(within(miaRow).getByRole('button', { name: 'Edit details for Mia Manager' })).toBeInTheDocument();
    expect(within(miaRow).getByRole('menuitem', { name: 'Reset password for Mia Manager' })).toBeInTheDocument();
    expect(within(miaRow).getByRole('menuitem', { name: 'Set password for Mia Manager' })).toBeInTheDocument();
    expect(within(miaRow).getByRole('combobox', { name: 'Role for Mia Manager' })).toBeEnabled();
    expect(within(miaRow).getByRole('menuitem', { name: 'Suspend' })).toBeEnabled();

    // Assert — other admin row: read-only
    const abeRow = screen.getByText('Abe Admin').closest('li')!;
    expect(within(abeRow).queryByRole('button')).not.toBeInTheDocument();
    expect(within(abeRow).queryByRole('combobox')).not.toBeInTheDocument();
    expect(within(abeRow).getByText('Admin')).toBeInTheDocument();
  });

  it('resets a password after confirming and shows the temporary password once', async () => {
    // Arrange
    auth.user = manager;
    const onChanged = vi.fn();
    vi.mocked(authApi.resetPassword).mockResolvedValue({
      user: { ...waiter, mustChangePassword: true },
      tempPassword: 'Temp-9876',
    } as never);
    const user = userEvent.setup({ delay: null });
    render(<AccountTable users={[manager, waiter]} onChanged={onChanged} />);

    // Act
    await openMore(user, 'Will Waiter');
    await user.click(screen.getByRole('menuitem', { name: 'Reset password for Will Waiter' }));
    // Assert — nothing happens until confirmed
    expect(screen.getByRole('dialog', { name: "Reset Will Waiter's password?" })).toBeInTheDocument();
    expect(authApi.resetPassword).not.toHaveBeenCalled();

    // Act
    await user.click(screen.getByRole('button', { name: 'Reset password' }));
    // Assert
    expect(authApi.resetPassword).toHaveBeenCalledWith('usr_waiter');
    expect(onChanged).toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Password reset' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Temporary password' })).toHaveValue('Temp-9876');
    expect(screen.getByRole('note')).toHaveTextContent('This password is shown only once.');

    // Act
    await user.click(screen.getByRole('button', { name: /saved it/i }));
    // Assert — gone for good
    expect(screen.queryByDisplayValue('Temp-9876')).not.toBeInTheDocument();
  });

  it('shows a toast when the reset is refused', async () => {
    // Arrange
    auth.user = manager;
    vi.mocked(authApi.resetPassword).mockRejectedValue(new Error('You can only manage accounts below your own rank.'));
    const user = userEvent.setup({ delay: null });
    render(<AccountTable users={[manager, waiter]} onChanged={vi.fn()} />);
    await openMore(user, 'Will Waiter');
    await user.click(screen.getByRole('menuitem', { name: 'Reset password for Will Waiter' }));

    // Act
    await user.click(screen.getByRole('button', { name: 'Reset password' }));

    // Assert
    expect(toastMock).toHaveBeenCalledWith('You can only manage accounts below your own rank.', 'error');
    expect(screen.queryByRole('dialog', { name: 'Password reset' })).not.toBeInTheDocument();
  });

  it('edits a waiter\'s details from the modal and refreshes the list', async () => {
    // Arrange
    auth.user = manager;
    const onChanged = vi.fn();
    vi.mocked(authApi.updateUserProfile).mockResolvedValue({ user: { ...waiter, phone: '+92 300 5550300' } } as never);
    const user = userEvent.setup({ delay: null });
    render(<AccountTable users={[manager, waiter]} onChanged={onChanged} />);

    // Act
    await user.click(screen.getByRole('button', { name: 'Edit details for Will Waiter' }));
    await user.clear(screen.getByLabelText('Phone (optional)'));
    await user.type(screen.getByLabelText('Phone (optional)'), '0300 5550300');
    await user.click(screen.getByRole('button', { name: 'Save details' }));

    // Assert
    expect(authApi.updateUserProfile).toHaveBeenCalledWith('usr_waiter', {
      name: 'Will Waiter',
      email: 'will@rest.test',
      phone: '+92 300 5550300',
    });
    expect(onChanged).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

/* ------------------------------------------------------- all-accounts-panel */

describe('AllAccountsPanel', () => {
  it('loads every account across all roles, customers included', async () => {
    // Arrange
    auth.user = admin;
    vi.mocked(authApi.users).mockResolvedValue({ users: [admin, manager, chef, waiter, customer] } as never);

    // Act
    render(<AllAccountsPanel />);

    // Assert
    expect(await screen.findByText('Cora Customer')).toBeInTheDocument();
    for (const name of ['Ada Admin', 'Mia Manager', 'Carlos Chef', 'Will Waiter']) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
    expect(screen.getByRole('option', { name: 'All roles (5)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Customers (1)' })).toBeInTheDocument();
  });

  it('filters by role and by search text', async () => {
    // Arrange
    auth.user = admin;
    vi.mocked(authApi.users).mockResolvedValue({ users: [admin, chef, waiter, customer] } as never);
    const user = userEvent.setup({ delay: null });
    render(<AllAccountsPanel />);
    await screen.findByText('Cora Customer');

    // Act
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter by role' }), 'customer');
    // Assert
    expect(screen.getByText('Cora Customer')).toBeInTheDocument();
    expect(screen.queryByText('Will Waiter')).not.toBeInTheDocument();

    // Act
    await user.type(screen.getByRole('searchbox', { name: 'Search accounts' }), 'nobody');
    // Assert
    expect(screen.getByText('No accounts match')).toBeInTheDocument();
  });

  it('reloads the list and notifies the parent after a change', async () => {
    // Arrange
    auth.user = admin;
    const onChanged = vi.fn();
    vi.mocked(authApi.users)
      .mockResolvedValueOnce({ users: [admin, customer] } as never)
      .mockResolvedValueOnce({ users: [admin, { ...customer, role: 'waiter' }] } as never);
    vi.mocked(authApi.updateUser).mockResolvedValue({ user: { ...customer, role: 'waiter' } } as never);
    const user = userEvent.setup({ delay: null });
    render(<AllAccountsPanel onChanged={onChanged} />);
    await screen.findByText('Cora Customer');

    // Act
    await user.selectOptions(screen.getByRole('combobox', { name: 'Role for Cora Customer' }), 'waiter');
    await user.click(screen.getByRole('button', { name: 'Make waiter' }));

    // Assert
    await waitFor(() => expect(authApi.users).toHaveBeenCalledTimes(2));
    expect(onChanged).toHaveBeenCalled();
    expect(screen.getByRole('combobox', { name: 'Role for Cora Customer' })).toHaveValue('waiter');
  });

  it('shows a toast when the accounts cannot be loaded', async () => {
    // Arrange
    auth.user = admin;
    vi.mocked(authApi.users).mockRejectedValue(new Error('Forbidden'));

    // Act
    render(<AllAccountsPanel />);

    // Assert
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith('Forbidden', 'error'));
    expect(screen.getByText('No accounts yet')).toBeInTheDocument();
  });
});

/* ------------------------------------------------------- applications-panel */

describe('ApplicationsPanel', () => {
  it('approves a pending application with the desired role and reveals the temporary password', async () => {
    // Arrange
    auth.user = manager;
    const onChanged = vi.fn();
    const newUser: User = { id: 'usr_jane', name: 'Jane Applicant', email: 'jane@example.com', role: 'waiter', active: true };
    vi.mocked(staffApi.approve).mockResolvedValue({ user: newUser, tempPassword: 'Temp-1234' } as never);
    const user = userEvent.setup({ delay: null });
    render(<ApplicationsPanel applications={[makeApplication()]} loading={false} onChanged={onChanged} />);

    // Act
    await user.click(screen.getByRole('button', { name: 'Approve' }));

    // Assert
    expect(staffApi.approve).toHaveBeenCalledWith('app_1', 'waiter');
    expect(toastMock).toHaveBeenCalledWith('Jane Applicant approved as waiter.', 'success');
    expect(onChanged).toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Staff account created' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Temporary password' })).toHaveValue('Temp-1234');
  });

  it('approves with a different role picked from "Approve as"', async () => {
    // Arrange
    auth.user = manager;
    vi.mocked(staffApi.approve).mockResolvedValue({ user: { ...chef, id: 'usr_jane' }, tempPassword: 'x' } as never);
    const user = userEvent.setup({ delay: null });
    render(<ApplicationsPanel applications={[makeApplication()]} loading={false} onChanged={vi.fn()} />);

    // Act
    await user.selectOptions(screen.getByLabelText('Approve as'), 'chef');
    await user.click(screen.getByRole('button', { name: 'Approve' }));

    // Assert
    expect(staffApi.approve).toHaveBeenCalledWith('app_1', 'chef');
  });

  it('only lets an admin approve someone as a manager', () => {
    // Arrange
    auth.user = manager;
    const { unmount } = render(<ApplicationsPanel applications={[makeApplication()]} loading={false} onChanged={vi.fn()} />);
    // Assert
    expect(screen.queryByRole('option', { name: 'Manager' })).not.toBeInTheDocument();
    expect(screen.getByText('Managers can approve waiters and chefs.')).toBeInTheDocument();
    unmount();

    // Arrange
    auth.user = admin;
    // Act
    render(<ApplicationsPanel applications={[makeApplication()]} loading={false} onChanged={vi.fn()} />);
    // Assert
    expect(screen.getByRole('option', { name: 'Manager' })).toBeInTheDocument();
  });

  it('rejects only after confirming, and cancelling leaves the application pending', async () => {
    // Arrange
    auth.user = manager;
    const onChanged = vi.fn();
    vi.mocked(staffApi.reject).mockResolvedValue({ application: makeApplication({ status: 'rejected' }) } as never);
    const user = userEvent.setup({ delay: null });
    render(<ApplicationsPanel applications={[makeApplication()]} loading={false} onChanged={onChanged} />);

    // Act — open the confirm step, then cancel
    await user.click(screen.getByRole('button', { name: 'Reject' }));
    // Assert
    expect(screen.getByRole('dialog', { name: 'Reject Jane Applicant?' })).toBeInTheDocument();
    expect(staffApi.reject).not.toHaveBeenCalled();

    // Act
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    // Assert
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(staffApi.reject).not.toHaveBeenCalled();

    // Act — reject for real
    await user.click(screen.getByRole('button', { name: 'Reject' }));
    await user.click(screen.getByRole('button', { name: 'Reject application' }));
    // Assert
    expect(staffApi.reject).toHaveBeenCalledWith('app_1');
    expect(toastMock).toHaveBeenCalledWith("Jane Applicant's application was rejected.", 'success');
    expect(onChanged).toHaveBeenCalled();
  });

  it('splits pending from decided applications', () => {
    // Arrange
    auth.user = admin;
    const apps = [
      makeApplication(),
      makeApplication({
        id: 'app_2',
        name: 'Ollie Old',
        email: 'ollie@example.com',
        desiredRole: 'waiter',
        status: 'approved',
        approvedRole: 'chef',
        decidedAt: '2026-10-01T12:00:00.000Z',
        decidedByName: 'Mia Manager',
      }),
    ];

    // Act
    render(<ApplicationsPanel applications={apps} loading={false} onChanged={vi.fn()} />);

    // Assert
    const pending = screen.getByRole('region', { name: /awaiting review/i });
    expect(within(pending).getByText('Jane Applicant')).toBeInTheDocument();
    expect(within(pending).queryByText('Ollie Old')).not.toBeInTheDocument();
    const decided = screen.getByRole('region', { name: 'Decided' });
    expect(within(decided).getByText('Ollie Old')).toBeInTheDocument();
    expect(within(decided).getByText('Approved')).toBeInTheDocument();
    expect(within(decided).getByText('as chef')).toBeInTheDocument();
    expect(within(decided).getByText(/by Mia Manager/)).toBeInTheDocument();
  });

  it('shows the empty state when nothing is pending', () => {
    // Arrange
    auth.user = manager;

    // Act
    render(<ApplicationsPanel applications={[]} loading={false} onChanged={vi.fn()} />);

    // Assert
    expect(screen.getByText('No pending applications')).toBeInTheDocument();
  });
});

/* ------------------------------------------------------------- careers-form */

describe('CareersForm', () => {
  it('does not submit while the required name and email are blank', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    render(<CareersForm />);

    // Act
    await user.click(screen.getByRole('button', { name: 'Send application' }));

    // Assert
    expect(staffApi.apply).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Full name')).toBeInvalid();
    expect(screen.getByLabelText('Email')).toBeInvalid();
  });

  it('submits a trimmed application and shows the thank-you state', async () => {
    // Arrange
    vi.mocked(staffApi.apply).mockResolvedValue({
      application: makeApplication({ name: 'Jane Applicant', desiredRole: 'chef' }),
    } as never);
    const user = userEvent.setup({ delay: null });
    render(<CareersForm />);

    // Act
    await user.click(screen.getByRole('radio', { name: /^chef/i }));
    await user.type(screen.getByLabelText('Full name'), '  Jane Applicant ');
    await user.type(screen.getByLabelText('Email'), 'jane@example.com');
    await user.type(screen.getByLabelText(/^experience/i), 'Line cook');
    await user.click(screen.getByRole('button', { name: 'Send application' }));

    // Assert
    expect(staffApi.apply).toHaveBeenCalledWith({
      name: 'Jane Applicant',
      email: 'jane@example.com',
      phone: undefined,
      desiredRole: 'chef',
      experience: 'Line cook',
    });
    expect(await screen.findByRole('heading', { name: 'Thanks, Jane' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('join as a chef');
    expect(toastMock).toHaveBeenCalledWith('Application sent — thank you!', 'success');
  });

  it('counts experience characters against the limit', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    render(<CareersForm />);

    // Act
    await user.type(screen.getByLabelText(/^experience/i), 'Hello');

    // Assert
    expect(screen.getByText('5/1000')).toBeInTheDocument();
  });

  it('shows a server error inline and keeps the form filled', async () => {
    // Arrange
    vi.mocked(staffApi.apply).mockRejectedValue(new Error('You already have a pending application.'));
    const user = userEvent.setup({ delay: null });
    render(<CareersForm />);
    await user.type(screen.getByLabelText('Full name'), 'Jane Applicant');
    await user.type(screen.getByLabelText('Email'), 'jane@example.com');

    // Act
    await user.click(screen.getByRole('button', { name: 'Send application' }));

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent('You already have a pending application.');
    expect(screen.getByLabelText('Full name')).toHaveValue('Jane Applicant');
  });
});

/* -------------------------------------------------------------- my-schedule */

describe('MySchedule', () => {
  it('shows the next shift, upcoming shifts grouped by day and recent shifts', async () => {
    // Arrange — Wed 7 Oct 2026, 10:00
    pinNow();
    auth.user = waiter;
    vi.mocked(staffApi.myShifts).mockResolvedValue({
      shifts: [
        makeShift({ id: 'past', date: '2026-10-06', start: '09:00', end: '15:00', status: 'completed' }),
        makeShift({ id: 'today', date: '2026-10-07', start: '12:00', end: '18:00' }),
        makeShift({ id: 'tomorrow', date: '2026-10-08', start: '17:00', end: '23:00', notes: 'Private party' }),
      ],
    } as never);

    // Act
    render(<MySchedule />);

    // Assert
    expect(await screen.findByText('Next shift')).toBeInTheDocument();
    expect(screen.getByText('Starts in 2 h 00 min')).toBeInTheDocument();
    const upcoming = screen.getByRole('region', { name: 'Upcoming' });
    expect(within(upcoming).getByText(formatDate('2026-10-07'))).toBeInTheDocument();
    expect(within(upcoming).getByText('Today')).toBeInTheDocument();
    expect(within(upcoming).getByText('Tomorrow')).toBeInTheDocument();
    expect(within(upcoming).getByText('17:00–23:00')).toBeInTheDocument();
    expect(within(upcoming).getByText('Private party')).toBeInTheDocument();
    const recent = screen.getByRole('region', { name: 'Recent shifts' });
    expect(within(recent).getByText('09:00–15:00')).toBeInTheDocument();
    expect(within(recent).getByText('Completed')).toBeInTheDocument();
    expect(within(upcoming).queryByText('09:00–15:00')).not.toBeInTheDocument();
    expect(screen.getByText('3 shifts scheduled, Mon–Sun')).toBeInTheDocument();
    expect(screen.getByText('18 h')).toBeInTheDocument();
  });

  it('labels a shift that is under way as the current shift', async () => {
    // Arrange — 13:30 on the day of a 12:00–18:00 shift
    pinNow(new Date(2026, 9, 7, 13, 30));
    auth.user = waiter;
    vi.mocked(staffApi.myShifts).mockResolvedValue({ shifts: [makeShift()] } as never);

    // Act
    render(<MySchedule />);

    // Assert
    expect(await screen.findByText('Current shift')).toBeInTheDocument();
    expect(screen.getByText('On shift now · finishes in 4 h 30 min')).toBeInTheDocument();
  });

  it('shows empty states when the user has no shifts', async () => {
    // Arrange
    pinNow();
    auth.user = waiter;
    vi.mocked(staffApi.myShifts).mockResolvedValue({ shifts: [] } as never);

    // Act
    render(<MySchedule />);

    // Assert
    expect(await screen.findByText('No upcoming shifts')).toBeInTheDocument();
    expect(screen.getByText('No shifts in the last week')).toBeInTheDocument();
    expect(screen.queryByText('Next shift')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Manage team rota' })).not.toBeInTheDocument();
  });

  it('offers managers a link to the team rota', async () => {
    // Arrange
    pinNow();
    auth.user = manager;
    vi.mocked(staffApi.myShifts).mockResolvedValue({ shifts: [] } as never);

    // Act
    render(<MySchedule />);

    // Assert
    expect(await screen.findByRole('link', { name: 'Manage team rota' })).toHaveAttribute('href', '/staff/users#shifts');
  });
});

/* -------------------------------------------------------- performance-panel */

describe('PerformancePanel', () => {
  const staff: StaffPerformance[] = [
    {
      userId: 'usr_waiter',
      name: 'Will Waiter',
      role: 'waiter',
      active: true,
      ordersTaken: 12,
      ordersServed: 10,
      revenueHandled: 240.5,
      tips: 30,
      itemsPrepared: 0,
      avgPrepMinutes: null,
      shiftsCompleted: 4,
      shiftsMissed: 1,
      hoursWorked: 24,
    },
    {
      userId: 'usr_chef',
      name: 'Carlos Chef',
      role: 'chef',
      active: false,
      ordersTaken: 0,
      ordersServed: 0,
      revenueHandled: 0,
      tips: 0,
      itemsPrepared: 50,
      avgPrepMinutes: 12,
      shiftsCompleted: 5,
      shiftsMissed: 0,
      hoursWorked: 30,
    },
  ];

  it('requests the last 30 days and shows per-staff figures with role-specific columns', async () => {
    // Arrange
    pinNow();
    vi.mocked(staffApi.performance).mockResolvedValue({ from: '2026-09-08', to: '2026-10-07', staff } as never);

    // Act
    render(<PerformancePanel />);

    // Assert
    expect(staffApi.performance).toHaveBeenCalledWith({ from: '2026-09-08', to: '2026-10-07' });
    const rows = (await screen.findAllByRole('row')).slice(1);
    expect(within(rows[0]).getByText('Carlos Chef')).toBeInTheDocument(); // chef ranks before waiter
    expect(within(rows[0]).getByText('Suspended')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Will Waiter')).toBeInTheDocument();
    // Chef: front-of-house columns are not applicable
    const chefCells = within(rows[0]).getAllByRole('cell');
    expect(within(chefCells[1]).getByLabelText('Not applicable')).toBeInTheDocument();
    expect(chefCells[6]).toHaveTextContent('12 min');
    // Waiter: kitchen columns are not applicable, revenue formatted as money
    const waiterCells = within(rows[1]).getAllByRole('cell');
    expect(waiterCells[3]).toHaveTextContent('$240.50');
    expect(within(waiterCells[5]).getByLabelText('Not applicable')).toBeInTheDocument();
    expect(waiterCells[7]).toHaveTextContent('4 / 1');
  });

  it('highlights the best value in each column and totals the team', async () => {
    // Arrange
    pinNow();
    vi.mocked(staffApi.performance).mockResolvedValue({ from: '2026-09-08', to: '2026-10-07', staff } as never);

    // Act
    render(<PerformancePanel />);

    // Assert
    const rows = (await screen.findAllByRole('row')).slice(1);
    const hoursCol = 8;
    expect(within(rows[0]).getAllByRole('cell')[hoursCol]).toHaveTextContent('30 h (top)');
    expect(within(rows[1]).getAllByRole('cell')[hoursCol]).not.toHaveTextContent('(top)');
    expect(screen.getByText('$240.50', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByText('54 h', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByText('1 missed shift')).toBeInTheDocument();
  });

  it('reloads for a different date range preset', async () => {
    // Arrange
    pinNow();
    vi.mocked(staffApi.performance).mockResolvedValue({ from: '2026-09-08', to: '2026-10-07', staff } as never);
    const user = userEvent.setup({ delay: null });
    render(<PerformancePanel />);
    await screen.findAllByText('Will Waiter');

    // Act
    await user.click(screen.getByRole('button', { name: 'Last 7 days' }));

    // Assert
    expect(staffApi.performance).toHaveBeenLastCalledWith({ from: '2026-10-01', to: '2026-10-07' });
    expect(screen.getByRole('button', { name: 'Last 7 days' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('stacks one card per person for phones, with only the figures that apply to their role', async () => {
    // Arrange
    pinNow();
    vi.mocked(staffApi.performance).mockResolvedValue({ from: '2026-09-08', to: '2026-10-07', staff } as never);

    // Act
    render(<PerformancePanel />);

    // Assert
    const list = await screen.findByRole('list', { name: 'Staff performance' });
    expect(list).toHaveClass('sm:hidden');
    const [chefCard, waiterCard] = within(list).getAllByRole('listitem');
    expect(chefCard).toHaveTextContent('Carlos Chef');
    expect(within(chefCard).getByText('Avg prep').nextSibling).toHaveTextContent('12 min');
    expect(within(chefCard).queryByText('Tips')).not.toBeInTheDocument();
    expect(within(waiterCard).getByText('Revenue handled').nextSibling).toHaveTextContent('$240.50');
    expect(within(waiterCard).queryByText('Items prepared')).not.toBeInTheDocument();
  });

  it('shows an empty state when there are no staff', async () => {
    // Arrange
    pinNow();
    vi.mocked(staffApi.performance).mockResolvedValue({ from: '2026-09-08', to: '2026-10-07', staff: [] } as never);

    // Act
    render(<PerformancePanel />);

    // Assert
    expect(await screen.findByText('No staff to report on')).toBeInTheDocument();
  });
});

/* ------------------------------------------------------------ shift-planner */

describe('ShiftPlanner', () => {
  const roster = [admin, chef, waiter, suspendedWaiter];

  it('loads the current Mon–Sun week and places shifts in the staff × day grid', async () => {
    // Arrange
    pinNow();
    vi.mocked(staffApi.shifts).mockResolvedValue({ shifts: [makeShift({ date: '2026-10-08' })] } as never);

    // Act
    render(<ShiftPlanner roster={roster} />);

    // Assert
    expect(staffApi.shifts).toHaveBeenCalledWith({ from: '2026-10-05', to: '2026-10-11' });
    expect(await screen.findByText(/1 shift, 6 h/)).toBeInTheDocument();
    const table = screen.getByRole('table');
    const willRow = within(table).getByText('Will Waiter').closest('tr')!;
    const cells = within(willRow).getAllByRole('cell');
    // cells: [name, Mon 5, Tue 6, Wed 7, Thu 8, ...]
    expect(within(cells[4]).getByRole('button', { name: /edit will waiter's shift 12:00 to 18:00/i })).toBeInTheDocument();
    // Suspended staff with no shifts this week get no row
    expect(within(table).queryByText('Gina Gone')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'This week' })).toBeDisabled();
  });

  it('opens ShiftForm pre-filled for the clicked staff/day slot', async () => {
    // Arrange
    pinNow();
    vi.mocked(staffApi.shifts).mockResolvedValue({ shifts: [] } as never);
    const user = userEvent.setup({ delay: null });
    render(<ShiftPlanner roster={roster} />);
    const slot = await screen.findByRole('button', { name: `Add shift for Carlos Chef on ${formatDate('2026-10-09')}` });

    // Act
    await user.click(slot);

    // Assert
    const dialog = screen.getByRole('dialog', { name: 'Add shift' });
    expect(within(dialog).getByLabelText('Staff member')).toHaveValue('usr_chef');
    expect(within(dialog).getByLabelText('Date')).toHaveValue('2026-10-09');
  });

  it('opens ShiftForm in edit mode when an existing shift is clicked', async () => {
    // Arrange
    pinNow();
    vi.mocked(staffApi.shifts).mockResolvedValue({ shifts: [makeShift()] } as never);
    const user = userEvent.setup({ delay: null });
    render(<ShiftPlanner roster={roster} />);
    const [chip] = await screen.findAllByRole('button', { name: /edit will waiter's shift/i });

    // Act
    await user.click(chip);

    // Assert
    expect(screen.getByRole('dialog', { name: 'Edit shift · Will Waiter' })).toBeInTheDocument();
  });

  it('navigates to the next week and back to this week', async () => {
    // Arrange
    pinNow();
    vi.mocked(staffApi.shifts).mockResolvedValue({ shifts: [] } as never);
    const user = userEvent.setup({ delay: null });
    render(<ShiftPlanner roster={roster} />);
    await screen.findByText(/0 shifts/);

    // Act
    await user.click(screen.getByRole('button', { name: 'Next week' }));
    // Assert
    expect(staffApi.shifts).toHaveBeenLastCalledWith({ from: '2026-10-12', to: '2026-10-18' });
    expect(screen.getByRole('button', { name: 'This week' })).toBeEnabled();

    // Act
    await user.click(screen.getByRole('button', { name: 'This week' }));
    // Assert
    expect(staffApi.shifts).toHaveBeenLastCalledWith({ from: '2026-10-05', to: '2026-10-11' });
  });

  it('defaults "+ Add shift" to today when today is in view', async () => {
    // Arrange
    pinNow();
    vi.mocked(staffApi.shifts).mockResolvedValue({ shifts: [] } as never);
    const user = userEvent.setup({ delay: null });
    render(<ShiftPlanner roster={roster} />);
    await screen.findByText(/0 shifts/);

    // Act
    await user.click(screen.getByRole('button', { name: '+ Add shift' }));

    // Assert
    const dialog = screen.getByRole('dialog', { name: 'Add shift' });
    expect(within(dialog).getByLabelText('Date')).toHaveValue('2026-10-07');
    expect(within(dialog).getByLabelText('Staff member')).toHaveValue('');
  });
});

/* --------------------------------------------------------------- team-panel */

describe('TeamPanel', () => {
  const roster = [admin, manager, chef, waiter, suspendedWaiter];

  function roleCard(plural: string) {
    return screen.getByText(plural, { selector: 'p' }).parentElement!;
  }

  it('counts the roster per role and flags suspended members', () => {
    // Arrange
    auth.user = admin;

    // Act
    render(<TeamPanel roster={roster} loading={false} onChanged={vi.fn()} />);

    // Assert
    expect(roleCard('Admins')).toHaveTextContent('1All active');
    expect(roleCard('Managers')).toHaveTextContent('1All active');
    expect(roleCard('Chefs')).toHaveTextContent('1All active');
    expect(roleCard('Waiters')).toHaveTextContent('21 suspended');
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
  });

  it('gives admins role controls and tells managers what they can manage', () => {
    // Arrange
    auth.user = admin;
    const { unmount } = render(<TeamPanel roster={roster} loading={false} onChanged={vi.fn()} />);
    // Assert
    expect(screen.getByText(/role changes apply on the user's next request/i)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Role for Will Waiter' })).toBeInTheDocument();
    unmount();

    // Arrange
    auth.user = manager;
    // Act
    render(<TeamPanel roster={roster} loading={false} onChanged={vi.fn()} />);
    // Assert
    expect(screen.getByText(/roles, suspensions and removals are managed by an admin/i)).toBeInTheDocument();
    expect(screen.getByText(/edit details and reset passwords for waiters and chefs/i)).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('shows placeholders and a spinner while loading', () => {
    // Arrange
    auth.user = admin;

    // Act
    render(<TeamPanel roster={[]} loading onChanged={vi.fn()} />);

    // Assert
    expect(screen.getByText('Loading team…')).toBeInTheDocument();
    expect(roleCard('Admins')).toHaveTextContent('–');
  });
});

describe('AccountTable — admin sets a password', () => {
  it('sends the typed password for the account and reloads the list', async () => {
    // Arrange
    auth.user = admin;
    const onChanged = vi.fn();
    vi.mocked(authApi.setUserPassword).mockResolvedValue({ user: waiter });
    const user = userEvent.setup({ delay: null });
    render(<AccountTable users={[admin, waiter]} onChanged={onChanged} />);

    // Act
    await openMore(user, 'Will Waiter');
    await user.click(screen.getByRole('menuitem', { name: 'Set password for Will Waiter' }));
    await user.type(screen.getByLabelText('New password'), 'Fresh-pass1');
    await user.type(screen.getByLabelText('Confirm new password'), 'Fresh-pass1');
    await user.click(screen.getByRole('button', { name: 'Set password' }));

    // Assert
    expect(authApi.setUserPassword).toHaveBeenCalledWith('usr_waiter', 'Fresh-pass1');
    expect(toastMock).toHaveBeenCalledWith(expect.stringContaining("Will Waiter's password was changed"), 'success');
    expect(onChanged).toHaveBeenCalled();
  });
});

describe('AccountTable — set password policy', () => {
  it('does not send a password that misses the policy, and marks the unmet rules', async () => {
    // Arrange
    auth.user = admin;
    const user = userEvent.setup({ delay: null });
    render(<AccountTable users={[admin, waiter]} onChanged={vi.fn()} />);
    await openMore(user, 'Will Waiter');
    await user.click(screen.getByRole('menuitem', { name: 'Set password for Will Waiter' }));

    // Act
    await user.type(screen.getByLabelText('New password'), 'freshpass');
    await user.type(screen.getByLabelText('Confirm new password'), 'freshpass');
    await user.click(screen.getByRole('button', { name: 'Set password' }));

    // Assert
    expect(authApi.setUserPassword).not.toHaveBeenCalled();
    expect(screen.getByLabelText('New password')).toHaveAccessibleDescription(/does not meet all the requirements yet/);
    expect(screen.getByRole('status')).toHaveTextContent('2 of 5 requirements met');
  });
});

describe('CareersForm — live field checks', () => {
  it('shows field errors under each field and does not send an invalid application', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    render(<CareersForm />);

    // Act
    await user.type(screen.getByLabelText('Email'), 'jo@');
    await user.type(screen.getByLabelText(/phone/i), '0300 12');
    await user.click(screen.getByRole('button', { name: 'Send application' }));

    // Assert
    expect(screen.getByRole('button', { name: 'Send application' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Send application' })).toHaveAccessibleDescription(
      'Complete these fields to continue: Full name, Email, Phone.',
    );
    expect(screen.getByLabelText('Full name')).not.toHaveAttribute('aria-invalid');
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Enter an email address like name@example.com.');
    expect(screen.getByLabelText(/phone/i)).toHaveAccessibleDescription('Enter a mobile number like 0300 1234567.');
    expect(staffApi.apply).not.toHaveBeenCalled();
  });
});

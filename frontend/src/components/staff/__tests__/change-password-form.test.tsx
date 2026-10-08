import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChangePasswordForm } from '@/components/staff/change-password-form';
import { ApiError, authApi } from '@/lib/api';
import type { User } from '@/types';

const { toastMock, updateSession, auth } = vi.hoisted(() => ({
  toastMock: vi.fn(),
  updateSession: vi.fn(),
  auth: { user: null as import('@/types').User | null },
}));

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return { ...actual, authApi: { changePassword: vi.fn() } };
});
vi.mock('@/components/ui/toast', () => ({ useToast: () => toastMock }));
vi.mock('@/context/auth-context', () => ({ useAuth: () => ({ user: auth.user, updateSession }) }));

const chef: User = { id: 'usr_c', name: 'Carlos Chef', email: 'carlos@rest.test', role: 'chef', active: true };

async function fill(current: string, next: string, confirm: string) {
  const user = userEvent.setup({ delay: null });
  if (current) await user.type(screen.getByLabelText('Current password'), current);
  if (next) await user.type(screen.getByLabelText('New password'), next);
  if (confirm) await user.type(screen.getByLabelText('Confirm new password'), confirm);
  await user.click(screen.getByRole('button', { name: 'Change password' }));
}

afterEach(() => {
  vi.resetAllMocks();
  auth.user = null;
});

describe('ChangePasswordForm', () => {
  it('rejects a new password shorter than 6 characters', async () => {
    // Arrange
    render(<ChangePasswordForm />);

    // Act
    await fill('oldpass', 'abc', 'abc');

    // Assert
    expect(screen.getByLabelText('New password')).toHaveAccessibleDescription('Use at least 6 characters.');
    expect(authApi.changePassword).not.toHaveBeenCalled();
  });

  it('rejects a confirmation that does not match', async () => {
    // Arrange
    render(<ChangePasswordForm />);

    // Act
    await fill('oldpass', 'newpass1', 'newpass2');

    // Assert
    expect(screen.getByLabelText('Confirm new password')).toHaveAccessibleDescription('Passwords do not match.');
    expect(authApi.changePassword).not.toHaveBeenCalled();
  });

  it('rejects a new password that is the same as the current one', async () => {
    // Arrange
    render(<ChangePasswordForm />);

    // Act
    await fill('samepass', 'samepass', 'samepass');

    // Assert
    expect(screen.getByLabelText('New password')).toHaveAccessibleDescription(
      'Choose a password different from your current one.',
    );
  });

  it('requires the current password', async () => {
    // Arrange
    render(<ChangePasswordForm />);

    // Act
    await fill('', 'newpass1', 'newpass1');

    // Assert
    expect(screen.getByLabelText('Current password')).toHaveAccessibleDescription('Enter your current password.');
  });

  it('stores the new token and user on success and confirms other sessions were signed out', async () => {
    // Arrange
    const updated = { ...chef, mustChangePassword: false };
    vi.mocked(authApi.changePassword).mockResolvedValue({ user: updated, token: 'tok_fresh' });
    render(<ChangePasswordForm />);

    // Act
    await fill('oldpass', 'newpass1', 'newpass1');

    // Assert
    expect(authApi.changePassword).toHaveBeenCalledWith('oldpass', 'newpass1');
    expect(updateSession).toHaveBeenCalledWith(updated, 'tok_fresh');
    expect(toastMock).toHaveBeenCalledWith('Password changed. Other sessions were signed out.', 'success');
    expect(screen.getByLabelText('Current password')).toHaveValue('');
    expect(screen.getByLabelText('New password')).toHaveValue('');
  });

  it("shows the server's 400 message for a wrong current password", async () => {
    // Arrange
    vi.mocked(authApi.changePassword).mockRejectedValue(new ApiError('Current password is incorrect.', 400, null));
    render(<ChangePasswordForm />);

    // Act
    await fill('wrongpass', 'newpass1', 'newpass1');

    // Assert
    expect(screen.getByLabelText('Current password')).toHaveAccessibleDescription('Current password is incorrect.');
    expect(updateSession).not.toHaveBeenCalled();
  });

  it('shows other server errors above the button', async () => {
    // Arrange
    vi.mocked(authApi.changePassword).mockRejectedValue(new ApiError('Something broke.', 500, null));
    render(<ChangePasswordForm />);

    // Act
    await fill('oldpass', 'newpass1', 'newpass1');

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent('Something broke.');
  });

  it('disables the form while the change is in flight', async () => {
    // Arrange
    vi.mocked(authApi.changePassword).mockReturnValue(new Promise(() => undefined));
    render(<ChangePasswordForm />);

    // Act
    await fill('oldpass', 'newpass1', 'newpass1');

    // Assert
    expect(screen.getByRole('button', { name: 'Changing…' })).toBeDisabled();
    expect(screen.getByLabelText('New password')).toBeDisabled();
  });
});

describe('ChangePasswordForm — admin', () => {
  it('asks an admin only for the new password and sends no current password', async () => {
    // Arrange
    auth.user = { id: 'usr_admin', name: 'Ada Admin', email: 'ada@rest.test', role: 'admin', active: true };
    vi.mocked(authApi.changePassword).mockResolvedValue({ user: auth.user, token: 'tok_admin' });
    render(<ChangePasswordForm />);

    // Act
    await fill('', 'admin-new', 'admin-new');

    // Assert
    expect(screen.queryByLabelText('Current password')).not.toBeInTheDocument();
    expect(authApi.changePassword).toHaveBeenCalledWith(undefined, 'admin-new');
    expect(updateSession).toHaveBeenCalledWith(auth.user, 'tok_admin');
  });

  it('still asks a manager for their current password', () => {
    // Arrange
    auth.user = { id: 'usr_manager', name: 'Mia Manager', email: 'mia@rest.test', role: 'manager', active: true };

    // Act
    render(<ChangePasswordForm />);

    // Assert
    expect(screen.getByLabelText('Current password')).toBeInTheDocument();
  });
});

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
  it('rejects a new password that misses the policy rules', async () => {
    // Arrange
    render(<ChangePasswordForm />);

    // Act
    await fill('oldpass', 'abc', 'abc');

    // Assert
    expect(screen.getByLabelText('New password')).toHaveAccessibleDescription(/does not meet all the requirements yet/);
    expect(authApi.changePassword).not.toHaveBeenCalled();
  });

  it('rejects a confirmation that does not match', async () => {
    // Arrange
    render(<ChangePasswordForm />);

    // Act
    await fill('oldpass', 'Newpass-12', 'Newpass-13');

    // Assert
    expect(screen.getByLabelText('Confirm new password')).toHaveAccessibleDescription(/Passwords don.t match/);
    expect(authApi.changePassword).not.toHaveBeenCalled();
  });

  it('rejects a new password that is the same as the current one', async () => {
    // Arrange
    render(<ChangePasswordForm />);

    // Act
    await fill('Same-pass1', 'Same-pass1', 'Same-pass1');

    // Assert
    expect(screen.getByLabelText('New password')).toHaveAccessibleDescription(
      /Choose a password different from your current one./,
    );
  });

  it('requires the current password', async () => {
    // Arrange
    render(<ChangePasswordForm />);

    // Act
    await fill('', 'Newpass-12', 'Newpass-12');

    // Assert
    expect(screen.getByLabelText('Current password')).toHaveAccessibleDescription('Enter your current password.');
  });

  it('stores the new token and user on success and confirms other sessions were signed out', async () => {
    // Arrange
    const updated = { ...chef, mustChangePassword: false };
    vi.mocked(authApi.changePassword).mockResolvedValue({ user: updated, token: 'tok_fresh' });
    render(<ChangePasswordForm />);

    // Act
    await fill('oldpass', 'Newpass-12', 'Newpass-12');

    // Assert
    expect(authApi.changePassword).toHaveBeenCalledWith('oldpass', 'Newpass-12');
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
    await fill('wrongpass', 'Newpass-12', 'Newpass-12');

    // Assert
    expect(screen.getByLabelText('Current password')).toHaveAccessibleDescription('Current password is incorrect.');
    expect(updateSession).not.toHaveBeenCalled();
  });

  it('shows other server errors above the button', async () => {
    // Arrange
    vi.mocked(authApi.changePassword).mockRejectedValue(new ApiError('Something broke.', 500, null));
    render(<ChangePasswordForm />);

    // Act
    await fill('oldpass', 'Newpass-12', 'Newpass-12');

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent('Something broke.');
  });

  it('disables the form while the change is in flight', async () => {
    // Arrange
    vi.mocked(authApi.changePassword).mockReturnValue(new Promise(() => undefined));
    render(<ChangePasswordForm />);

    // Act
    await fill('oldpass', 'Newpass-12', 'Newpass-12');

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
    await fill('', 'Admin-new-1', 'Admin-new-1');

    // Assert
    expect(screen.queryByLabelText('Current password')).not.toBeInTheDocument();
    expect(authApi.changePassword).toHaveBeenCalledWith(undefined, 'Admin-new-1');
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

describe('ChangePasswordForm — live feedback', () => {
  it('updates the requirement checklist and strength as you type', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    render(<ChangePasswordForm />);

    // Act
    await user.type(screen.getByLabelText('New password'), 'abcdefgh');

    // Assert
    expect(screen.getByRole('status')).toHaveTextContent('2 of 5 requirements met');
    expect(screen.getByText('Strength: Weak')).toBeInTheDocument();

    // Act
    await user.type(screen.getByLabelText('New password'), 'A1!xyzw');

    // Assert
    expect(screen.getByRole('status')).toHaveTextContent('5 of 5 requirements met');
    expect(screen.getByText('Strength: Strong')).toBeInTheDocument();
  });

  it('shows "Passwords match" live and lets you reveal the password', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    render(<ChangePasswordForm />);
    await user.type(screen.getByLabelText('New password'), 'Newpass-12');

    // Act
    await user.type(screen.getByLabelText('Confirm new password'), 'Newpass-12');
    const [toggle] = screen.getAllByRole('button', { name: 'Show password' });
    await user.click(toggle);

    // Assert
    expect(screen.getByText('Passwords match')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Current password')).toHaveAttribute('type', 'text');
  });

  it('shows a server policy message under the new password', async () => {
    // Arrange
    vi.mocked(authApi.changePassword).mockRejectedValue(new ApiError('Password needs: to be less common.', 400, null));
    render(<ChangePasswordForm />);

    // Act
    await fill('oldpass', 'Newpass-12', 'Newpass-12');

    // Assert
    expect(screen.getByLabelText('New password')).toHaveAccessibleDescription(/Password needs: to be less common\./);
  });
});

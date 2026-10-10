import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AccountProfileForm } from '@/components/staff/account-profile-form';
import { ApiError, authApi } from '@/lib/api';
import type { User } from '@/types';

const { toastMock, updateSession } = vi.hoisted(() => ({ toastMock: vi.fn(), updateSession: vi.fn() }));

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return { ...actual, authApi: { updateMe: vi.fn() } };
});
vi.mock('@/components/ui/toast', () => ({ useToast: () => toastMock }));
vi.mock('@/context/auth-context', () => ({ useAuth: () => ({ updateSession }) }));

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'usr_w',
    name: 'Will Waiter',
    email: 'will@rest.test',
    role: 'waiter',
    active: true,
    phone: '',
    mustChangePassword: false,
    ...overrides,
  };
}

afterEach(() => vi.resetAllMocks());

describe('AccountProfileForm', () => {
  it('saves name and phone without asking for a password', async () => {
    // Arrange
    const updated = makeUser({ name: 'William Waiter', phone: '555-0199' });
    vi.mocked(authApi.updateMe).mockResolvedValue({ user: updated });
    const user = userEvent.setup({ delay: null });
    render(<AccountProfileForm user={makeUser()} />);

    // Act
    await user.clear(screen.getByLabelText('Name'));
    await user.type(screen.getByLabelText('Name'), 'William Waiter');
    await user.type(screen.getByLabelText('Phone (optional)'), '555-0199');
    await user.click(screen.getByRole('button', { name: 'Save profile' }));

    // Assert
    expect(screen.queryByLabelText('Current password')).not.toBeInTheDocument();
    expect(authApi.updateMe).toHaveBeenCalledWith({ name: 'William Waiter', phone: '555-0199' });
    expect(updateSession).toHaveBeenCalledWith(updated);
    expect(toastMock).toHaveBeenCalledWith('Profile saved.', 'success');
  });

  it('asks for the current password when the email changes and sends it with the new email', async () => {
    // Arrange
    const updated = makeUser({ email: 'will.w@rest.test' });
    vi.mocked(authApi.updateMe).mockResolvedValue({ user: updated });
    const user = userEvent.setup({ delay: null });
    render(<AccountProfileForm user={makeUser()} />);
    await user.clear(screen.getByLabelText('Email'));
    await user.type(screen.getByLabelText('Email'), 'will.w@rest.test');

    // Act — try to submit without the password first
    await user.click(screen.getByRole('button', { name: 'Save profile' }));

    // Assert — the button is disabled and names the missing field
    const save = screen.getByRole('button', { name: 'Save profile' });
    expect(save).toBeDisabled();
    expect(save).toHaveAccessibleDescription('Complete these fields to continue: Current password.');
    expect(authApi.updateMe).not.toHaveBeenCalled();

    // Act
    const password = screen.getByLabelText('Current password');
    await user.click(password);
    await user.tab();

    // Assert
    expect(password).toHaveAccessibleDescription('Enter your current password to change your email.');
    expect(password).toHaveAttribute('aria-invalid', 'true');

    // Act
    await user.type(password, 'secret1');
    await user.click(screen.getByRole('button', { name: 'Save profile' }));

    // Assert
    expect(authApi.updateMe).toHaveBeenCalledWith({
      name: 'Will Waiter',
      phone: '',
      email: 'will.w@rest.test',
      currentPassword: 'secret1',
    });
    expect(updateSession).toHaveBeenCalledWith(updated);
    expect(screen.queryByLabelText('Current password')).not.toBeInTheDocument();
  });

  it('shows a 409 "email in use" next to the email field', async () => {
    // Arrange
    vi.mocked(authApi.updateMe).mockRejectedValue(new ApiError('Email already in use.', 409, null));
    const user = userEvent.setup({ delay: null });
    render(<AccountProfileForm user={makeUser()} />);
    await user.clear(screen.getByLabelText('Email'));
    await user.type(screen.getByLabelText('Email'), 'taken@rest.test');
    await user.type(screen.getByLabelText('Current password'), 'secret1');

    // Act
    await user.click(screen.getByRole('button', { name: 'Save profile' }));

    // Assert
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Email already in use.');
    expect(updateSession).not.toHaveBeenCalled();
    expect(toastMock).not.toHaveBeenCalled();
  });

  it('shows a wrong current password (400) on the password field', async () => {
    // Arrange
    vi.mocked(authApi.updateMe).mockRejectedValue(new ApiError('Current password is incorrect.', 400, null));
    const user = userEvent.setup({ delay: null });
    render(<AccountProfileForm user={makeUser()} />);
    await user.clear(screen.getByLabelText('Email'));
    await user.type(screen.getByLabelText('Email'), 'new@rest.test');
    await user.type(screen.getByLabelText('Current password'), 'wrong1');

    // Act
    await user.click(screen.getByRole('button', { name: 'Save profile' }));

    // Assert
    expect(screen.getByLabelText('Current password')).toHaveAccessibleDescription('Current password is incorrect.');
  });

  it('validates a blank name and a malformed email before calling the server', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    render(<AccountProfileForm user={makeUser()} />);
    await user.clear(screen.getByLabelText('Name'));
    await user.clear(screen.getByLabelText('Email'));
    await user.type(screen.getByLabelText('Email'), 'not-an-email');
    await user.type(screen.getByLabelText('Current password'), 'secret1');

    // Act
    await user.click(screen.getByRole('button', { name: 'Save profile' }));

    // Assert
    expect(screen.getByLabelText('Name')).toHaveAccessibleDescription('Enter your name.');
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Enter an email address like name@example.com.');
    expect(authApi.updateMe).not.toHaveBeenCalled();
  });

  it('disables the form and shows a busy label while saving', async () => {
    // Arrange
    vi.mocked(authApi.updateMe).mockReturnValue(new Promise(() => undefined));
    const user = userEvent.setup({ delay: null });
    render(<AccountProfileForm user={makeUser()} />);
    await user.type(screen.getByLabelText('Phone (optional)'), '555-0101');

    // Act
    await user.click(screen.getByRole('button', { name: 'Save profile' }));

    // Assert
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    expect(screen.getByLabelText('Name')).toBeDisabled();
  });

  it('keeps Save disabled until something changes', () => {
    // Arrange / Act
    render(<AccountProfileForm user={makeUser()} />);

    // Assert
    expect(screen.getByRole('button', { name: 'Save profile' })).toBeDisabled();
  });
});

describe('AccountProfileForm — live validation', () => {
  it('checks the phone as you type, then clears the error live as you fix it', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    render(<AccountProfileForm user={makeUser()} />);
    const phone = screen.getByLabelText('Phone (optional)');

    // Assert — pristine: nothing shown
    expect(phone).not.toHaveAttribute('aria-invalid');

    // Act
    await user.type(phone, '12');

    // Assert
    expect(phone).toHaveAttribute('aria-invalid', 'true');
    expect(phone).toHaveAccessibleDescription('Phone numbers have 7 to 20 digits.');

    // Act — fixing it clears the error without another blur
    await user.type(phone, '3-4567');

    // Assert
    expect(phone).not.toHaveAttribute('aria-invalid');
  });
});

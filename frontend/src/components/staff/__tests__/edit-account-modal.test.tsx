import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditAccountModal } from '@/components/staff/edit-account-modal';
import { ApiError, authApi } from '@/lib/api';
import type { User } from '@/types';

const { toastMock } = vi.hoisted(() => ({ toastMock: vi.fn() }));

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return { ...actual, authApi: { updateUserProfile: vi.fn() } };
});
vi.mock('@/components/ui/toast', () => ({ useToast: () => toastMock }));

const waiter: User = {
  id: 'usr_w',
  name: 'Will Waiter',
  email: 'will@rest.test',
  role: 'waiter',
  active: true,
  phone: '555-0100',
};

afterEach(() => vi.resetAllMocks());

describe('EditAccountModal', () => {
  it('prefills the current details and submits the edited ones', async () => {
    // Arrange
    const updated = { ...waiter, name: 'William Waiter', phone: '555-0200' };
    vi.mocked(authApi.updateUserProfile).mockResolvedValue({ user: updated });
    const onSaved = vi.fn();
    const user = userEvent.setup({ delay: null });
    render(<EditAccountModal user={waiter} onClose={vi.fn()} onSaved={onSaved} />);
    expect(screen.getByRole('dialog', { name: "Edit Will Waiter's details" })).toBeInTheDocument();
    expect(screen.getByLabelText('Phone (optional)')).toHaveValue('555-0100');

    // Act
    await user.clear(screen.getByLabelText('Name'));
    await user.type(screen.getByLabelText('Name'), 'William Waiter');
    await user.clear(screen.getByLabelText('Phone (optional)'));
    await user.type(screen.getByLabelText('Phone (optional)'), '555-0200');
    await user.click(screen.getByRole('button', { name: 'Save details' }));

    // Assert
    expect(authApi.updateUserProfile).toHaveBeenCalledWith('usr_w', {
      name: 'William Waiter',
      email: 'will@rest.test',
      phone: '555-0200',
    });
    expect(toastMock).toHaveBeenCalledWith("William Waiter's details were updated.", 'success');
    expect(onSaved).toHaveBeenCalledWith(updated);
  });

  it('shows a 409 on the email field', async () => {
    // Arrange
    vi.mocked(authApi.updateUserProfile).mockRejectedValue(new ApiError('Email already in use.', 409, null));
    const user = userEvent.setup({ delay: null });
    render(<EditAccountModal user={waiter} onClose={vi.fn()} onSaved={vi.fn()} />);

    // Act
    await user.click(screen.getByRole('button', { name: 'Save details' }));

    // Assert
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Email already in use.');
  });

  it('shows a 403 rank refusal as a form error', async () => {
    // Arrange
    vi.mocked(authApi.updateUserProfile).mockRejectedValue(
      new ApiError('You can only manage accounts below your own rank.', 403, null),
    );
    const user = userEvent.setup({ delay: null });
    render(<EditAccountModal user={waiter} onClose={vi.fn()} onSaved={vi.fn()} />);

    // Act
    await user.click(screen.getByRole('button', { name: 'Save details' }));

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent('You can only manage accounts below your own rank.');
  });

  it('validates live before calling the server and keeps "Save details" disabled', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    render(<EditAccountModal user={waiter} onClose={vi.fn()} onSaved={vi.fn()} />);

    // Act
    await user.clear(screen.getByLabelText('Name'));
    await user.click(screen.getByRole('button', { name: 'Save details' }));

    // Assert
    expect(screen.getByLabelText('Name')).toHaveAccessibleDescription('Enter a name.');
    expect(screen.getByRole('button', { name: 'Save details' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save details' })).toHaveAccessibleDescription(
      'Complete these fields to continue: Name.',
    );
    expect(authApi.updateUserProfile).not.toHaveBeenCalled();
  });

  it('checks the name rule, phone digits and the server length caps', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    render(<EditAccountModal user={waiter} onClose={vi.fn()} onSaved={vi.fn()} />);
    const name = screen.getByLabelText('Name');
    const phone = screen.getByLabelText('Phone (optional)');

    // Act
    await user.clear(name);
    await user.type(name, 'SS');
    await user.clear(phone);
    await user.type(phone, '12-34');

    // Assert
    expect(name).toHaveAccessibleDescription(/full name/);
    expect(phone).toHaveAccessibleDescription('Phone numbers have 7 to 20 digits.');
    expect(screen.getByLabelText('Email')).toHaveAttribute('maxLength', '254');
    expect(phone).toHaveAttribute('maxLength', '30');
  });

  it('cancels without saving', async () => {
    // Arrange
    const onClose = vi.fn();
    const user = userEvent.setup({ delay: null });
    render(<EditAccountModal user={waiter} onClose={onClose} onSaved={vi.fn()} />);

    // Act
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    // Assert
    expect(onClose).toHaveBeenCalled();
    expect(authApi.updateUserProfile).not.toHaveBeenCalled();
  });
});

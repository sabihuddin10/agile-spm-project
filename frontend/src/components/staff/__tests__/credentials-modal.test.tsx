import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CredentialsModal } from '@/components/staff/credentials-modal';
import type { User } from '@/types';

vi.mock('@/components/ui/toast', () => ({ useToast: () => vi.fn() }));

function makeUser(overrides: Partial<User> = {}): User {
  return { id: 'usr_1', name: 'Rita Runner', email: 'rita@example.com', role: 'waiter', active: true, ...overrides };
}

describe('CredentialsModal', () => {
  it('shows the new account\'s email and temporary password', () => {
    // Arrange / Act
    render(<CredentialsModal user={makeUser()} tempPassword="tmp-pass-1" onClose={vi.fn()} />);

    // Assert
    expect(screen.getByLabelText('Email')).toHaveValue('rita@example.com');
    expect(screen.getByLabelText('Temporary password')).toHaveValue('tmp-pass-1');
  });

  it('shows a copy button for each credential field', () => {
    // Arrange / Act
    render(<CredentialsModal user={makeUser()} tempPassword="tmp-pass-1" onClose={vi.fn()} />);

    // Assert
    expect(screen.getByRole('button', { name: /copy email/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy temporary password/i })).toBeInTheDocument();
  });

  it('closes when the staff member confirms they saved it', async () => {
    // Arrange
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<CredentialsModal user={makeUser()} tempPassword="tmp-pass-1" onClose={onClose} />);

    // Act
    await user.click(screen.getByRole('button', { name: /saved it/i }));

    // Assert
    expect(onClose).toHaveBeenCalled();
  });
});

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

  it('says the password is shown only once and that they must set their own', () => {
    // Arrange / Act
    render(<CredentialsModal user={makeUser()} tempPassword="tmp-pass-1" onClose={vi.fn()} />);

    // Assert
    expect(screen.getByRole('note')).toHaveTextContent('This password is shown only once.');
    expect(screen.getByRole('note')).toHaveTextContent("They'll be asked to set their own password after signing in.");
  });

  it('uses reset wording for a password reset', () => {
    // Arrange / Act
    render(<CredentialsModal variant="reset" user={makeUser()} tempPassword="tmp-pass-2" onClose={vi.fn()} />);

    // Assert
    expect(screen.getByRole('dialog', { name: 'Password reset' })).toBeInTheDocument();
    expect(screen.getByText(/has been signed out everywhere/)).toBeInTheDocument();
    expect(screen.getByLabelText('Temporary password')).toHaveValue('tmp-pass-2');
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

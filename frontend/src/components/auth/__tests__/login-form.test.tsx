import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from '@/components/auth/login-form';
import { useAuth } from '@/context/auth-context';
import type { User } from '@/types';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/context/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock('@/components/ui/toast', () => ({ useToast: () => vi.fn() }));

function makeUser(overrides: Partial<User> = {}): User {
  return { id: 'usr_1', name: 'Casey Customer', email: 'casey@example.com', role: 'customer', active: true, ...overrides };
}

describe('LoginForm', () => {
  it('signs in and routes customers home, staff to the console', async () => {
    // Arrange
    const login = vi.fn().mockResolvedValue(makeUser({ role: 'manager' }));
    vi.mocked(useAuth).mockReturnValue({ login } as unknown as ReturnType<typeof useAuth>);
    const user = userEvent.setup({ delay: null });
    render(<LoginForm />);

    // Act
    await user.type(screen.getByLabelText('Email'), 'manager@rest.test');
    await user.type(screen.getByLabelText('Password'), 'password');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    // Assert
    expect(login).toHaveBeenCalledWith('manager@rest.test', 'password');
    expect(push).toHaveBeenCalledWith('/staff');
  });

  it('routes a customer to the homepage', async () => {
    // Arrange
    const login = vi.fn().mockResolvedValue(makeUser({ role: 'customer' }));
    vi.mocked(useAuth).mockReturnValue({ login } as unknown as ReturnType<typeof useAuth>);
    const user = userEvent.setup({ delay: null });
    render(<LoginForm />);

    // Act
    await user.type(screen.getByLabelText('Email'), 'customer@rest.test');
    await user.type(screen.getByLabelText('Password'), 'password');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    // Assert
    expect(push).toHaveBeenCalledWith('/');
  });

  it('shows the server error and stays on the page when login fails', async () => {
    // Arrange
    const login = vi.fn().mockRejectedValue(new Error('Invalid email or password.'));
    vi.mocked(useAuth).mockReturnValue({ login } as unknown as ReturnType<typeof useAuth>);
    const user = userEvent.setup({ delay: null });
    render(<LoginForm />);

    // Act
    await user.type(screen.getByLabelText('Email'), 'wrong@rest.test');
    await user.type(screen.getByLabelText('Password'), 'nope');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.');
    expect(push).not.toHaveBeenCalled();
  });

  it('fills in a demo account\'s email and a default password', async () => {
    // Arrange
    vi.mocked(useAuth).mockReturnValue({ login: vi.fn() } as unknown as ReturnType<typeof useAuth>);
    const user = userEvent.setup({ delay: null });
    render(<LoginForm />);

    // Act
    await user.click(screen.getByRole('button', { name: 'Chef' }));

    // Assert
    expect(screen.getByLabelText('Email')).toHaveValue('chef@rest.test');
    expect(screen.getByLabelText('Password')).toHaveValue('password');
  });
});

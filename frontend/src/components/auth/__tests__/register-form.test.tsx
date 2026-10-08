import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RegisterForm } from '@/components/auth/register-form';
import { useAuth } from '@/context/auth-context';
import type { User } from '@/types';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/context/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock('@/components/ui/toast', () => ({ useToast: () => vi.fn() }));

function makeUser(overrides: Partial<User> = {}): User {
  return { id: 'usr_1', name: 'Nina New', email: 'nina@example.com', role: 'customer', active: true, ...overrides };
}

async function fill(user: ReturnType<typeof userEvent.setup>, { name = 'Nina New', email = 'nina@example.com', password = 'secret1', confirm = 'secret1' } = {}) {
  if (name) await user.type(screen.getByLabelText('Full name'), name);
  if (email) await user.type(screen.getByLabelText('Email'), email);
  if (password) await user.type(screen.getByLabelText('Password'), password);
  if (confirm) await user.type(screen.getByLabelText('Confirm password'), confirm);
}

describe('RegisterForm', () => {
  it('rejects an empty name', async () => {
    // Arrange
    vi.mocked(useAuth).mockReturnValue({ register: vi.fn() } as unknown as ReturnType<typeof useAuth>);
    const user = userEvent.setup({ delay: null });
    render(<RegisterForm />);

    // Act
    await fill(user, { name: '' });
    await user.click(screen.getByRole('button', { name: /create account/i }));

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent('Please enter your name.');
  });

  it('rejects an invalid email', async () => {
    // Arrange
    vi.mocked(useAuth).mockReturnValue({ register: vi.fn() } as unknown as ReturnType<typeof useAuth>);
    const user = userEvent.setup({ delay: null });
    render(<RegisterForm />);

    // Act
    await fill(user, { email: 'not-an-email' });
    await user.click(screen.getByRole('button', { name: /create account/i }));

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent('Please enter a valid email address.');
  });

  it('rejects a password shorter than 6 characters', async () => {
    // Arrange
    vi.mocked(useAuth).mockReturnValue({ register: vi.fn() } as unknown as ReturnType<typeof useAuth>);
    const user = userEvent.setup({ delay: null });
    render(<RegisterForm />);

    // Act
    await fill(user, { password: 'ab1', confirm: 'ab1' });
    await user.click(screen.getByRole('button', { name: /create account/i }));

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent(/at least 6 characters/i);
  });

  it('flags a live password mismatch before submitting', async () => {
    // Arrange
    vi.mocked(useAuth).mockReturnValue({ register: vi.fn() } as unknown as ReturnType<typeof useAuth>);
    const user = userEvent.setup({ delay: null });
    render(<RegisterForm />);

    // Act
    await user.type(screen.getByLabelText('Password'), 'secret1');
    await user.type(screen.getByLabelText('Confirm password'), 'secret2');

    // Assert
    expect(screen.getByText(/passwords do not match yet/i)).toBeInTheDocument();
  });

  it('rejects mismatched passwords on submit', async () => {
    // Arrange
    vi.mocked(useAuth).mockReturnValue({ register: vi.fn() } as unknown as ReturnType<typeof useAuth>);
    const user = userEvent.setup({ delay: null });
    render(<RegisterForm />);

    // Act
    await fill(user, { password: 'secret1', confirm: 'secret2' });
    await user.click(screen.getByRole('button', { name: /create account/i }));

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent('Passwords do not match.');
  });

  it('registers a valid new customer and routes home', async () => {
    // Arrange
    const register = vi.fn().mockResolvedValue(makeUser());
    vi.mocked(useAuth).mockReturnValue({ register } as unknown as ReturnType<typeof useAuth>);
    const user = userEvent.setup({ delay: null });
    render(<RegisterForm />);

    // Act
    await fill(user);
    await user.click(screen.getByRole('button', { name: /create account/i }));

    // Assert
    expect(register).toHaveBeenCalledWith('Nina New', 'nina@example.com', 'secret1');
    expect(push).toHaveBeenCalledWith('/');
  });

  it('shows the server error (e.g. duplicate email) without crashing', async () => {
    // Arrange
    const register = vi.fn().mockRejectedValue(new Error('An account with that email already exists.'));
    vi.mocked(useAuth).mockReturnValue({ register } as unknown as ReturnType<typeof useAuth>);
    const user = userEvent.setup({ delay: null });
    render(<RegisterForm />);

    // Act
    await fill(user);
    await user.click(screen.getByRole('button', { name: /create account/i }));

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent('An account with that email already exists.');
  });
});

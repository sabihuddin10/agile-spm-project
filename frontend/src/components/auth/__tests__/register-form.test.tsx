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

const STRONG = 'Ember-grill7';

function makeUser(overrides: Partial<User> = {}): User {
  return { id: 'usr_1', name: 'Nina New', email: 'nina@example.com', role: 'customer', active: true, ...overrides };
}

function mockRegister(register = vi.fn()) {
  vi.mocked(useAuth).mockReturnValue({ register } as unknown as ReturnType<typeof useAuth>);
  return register;
}

async function fill(user: ReturnType<typeof userEvent.setup>, { name = 'Nina New', email = 'nina@example.com', password = STRONG, confirm = STRONG } = {}) {
  if (name) await user.type(screen.getByLabelText('Full name'), name);
  if (email) await user.type(screen.getByLabelText('Email'), email);
  if (password) await user.type(screen.getByLabelText('Password'), password);
  if (confirm) await user.type(screen.getByLabelText('Confirm password'), confirm);
}

const submit = (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole('button', { name: /create account/i }));

describe('RegisterForm', () => {
  it('rejects an empty name under the field', async () => {
    // Arrange
    const register = mockRegister();
    const user = userEvent.setup({ delay: null });
    render(<RegisterForm />);

    // Act
    await fill(user, { name: '' });
    await submit(user);

    // Assert
    expect(screen.getByLabelText('Full name')).toHaveAccessibleDescription('Please enter your name.');
    expect(screen.getByLabelText('Full name')).toHaveAttribute('aria-invalid', 'true');
    expect(register).not.toHaveBeenCalled();
  });

  it('checks the email when you leave the field and clears the error live once fixed', async () => {
    // Arrange
    mockRegister();
    const user = userEvent.setup({ delay: null });
    render(<RegisterForm />);
    const email = screen.getByLabelText('Email');

    // Act
    await user.type(email, 'nina@');

    // Assert — no error while still typing the first time
    expect(email).not.toHaveAttribute('aria-invalid');

    // Act
    await user.tab();

    // Assert
    expect(email).toHaveAccessibleDescription('Enter an email address like name@example.com.');

    // Act
    await user.type(email, 'example.com');

    // Assert
    expect(email).not.toHaveAttribute('aria-invalid');
  });

  it('shows the password checklist updating live, neutral until submit', async () => {
    // Arrange
    mockRegister();
    const user = userEvent.setup({ delay: null });
    render(<RegisterForm />);

    // Act
    await user.type(screen.getByLabelText('Password'), 'ember');

    // Assert
    expect(screen.getByRole('status')).toHaveTextContent('1 of 5 requirements met');
    expect(screen.getByText('A lowercase letter')).toHaveTextContent('(met)');
    expect(screen.getByText('A number').closest('li')).toHaveClass('text-bone-dim');

    // Act
    await user.type(screen.getByLabelText('Password'), '-Grill7');

    // Assert
    expect(screen.getByRole('status')).toHaveTextContent('5 of 5 requirements met');
    expect(screen.getByText('Strength: Strong')).toBeInTheDocument();
  });

  it('refuses a weak password on submit and turns unmet rules red', async () => {
    // Arrange
    const register = mockRegister();
    const user = userEvent.setup({ delay: null });
    render(<RegisterForm />);

    // Act
    await fill(user, { password: 'secret1', confirm: 'secret1' });
    await submit(user);

    // Assert
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription(/does not meet all the requirements yet/);
    expect(screen.getByText('An uppercase letter').closest('li')).toHaveClass('text-red-300');
    expect(register).not.toHaveBeenCalled();
  });

  it('refuses a very common password even though it meets every rule', async () => {
    // Arrange
    const register = mockRegister();
    const user = userEvent.setup({ delay: null });
    render(<RegisterForm />);

    // Act
    await fill(user, { password: 'Password1!', confirm: 'Password1!' });
    await submit(user);

    // Assert
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription(/too common/);
    expect(register).not.toHaveBeenCalled();
  });

  it('says live whether the confirmation matches', async () => {
    // Arrange
    mockRegister();
    const user = userEvent.setup({ delay: null });
    render(<RegisterForm />);
    await user.type(screen.getByLabelText('Password'), STRONG);

    // Act
    await user.type(screen.getByLabelText('Confirm password'), 'Ember');

    // Assert
    expect(screen.getByText("Passwords don't match")).toBeInTheDocument();

    // Act
    await user.type(screen.getByLabelText('Confirm password'), '-grill7');

    // Assert
    expect(screen.getByText('Passwords match')).toBeInTheDocument();
  });

  it('reveals the password with the show/hide toggle', async () => {
    // Arrange
    mockRegister();
    const user = userEvent.setup({ delay: null });
    render(<RegisterForm />);
    const [toggle] = screen.getAllByRole('button', { name: 'Show password' });

    // Act
    await user.click(toggle);

    // Assert
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('registers a valid new customer and routes home', async () => {
    // Arrange
    const register = mockRegister(vi.fn().mockResolvedValue(makeUser()));
    const user = userEvent.setup({ delay: null });
    render(<RegisterForm />);

    // Act
    await fill(user);
    await submit(user);

    // Assert
    expect(register).toHaveBeenCalledWith('Nina New', 'nina@example.com', STRONG);
    expect(push).toHaveBeenCalledWith('/');
  });

  it('shows the server error (e.g. duplicate email) without crashing', async () => {
    // Arrange
    mockRegister(vi.fn().mockRejectedValue(new Error('An account with that email already exists.')));
    const user = userEvent.setup({ delay: null });
    render(<RegisterForm />);

    // Act
    await fill(user);
    await submit(user);

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent('An account with that email already exists.');
  });
});

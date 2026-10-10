import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MyAccount } from '@/components/staff/my-account';
import { ROLE_CAPABILITIES } from '@/components/staff/role-meta';
import type { StaffRole, User } from '@/types';

const { auth } = vi.hoisted(() => ({ auth: { user: null as User | null } }));

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return { ...actual, authApi: { updateMe: vi.fn(), changePassword: vi.fn() } };
});
vi.mock('@/components/ui/toast', () => ({ useToast: () => vi.fn() }));
vi.mock('@/context/auth-context', () => ({ useAuth: () => ({ user: auth.user, updateSession: vi.fn() }) }));

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'usr_1',
    name: 'Sam Staff',
    email: 'sam@rest.test',
    role: 'waiter',
    active: true,
    phone: '+92 300 5550100',
    mustChangePassword: false,
    createdAt: '2025-03-14T12:00:00.000Z',
    ...overrides,
  };
}

afterEach(() => {
  auth.user = null;
});

describe('MyAccount', () => {
  const roles: [StaffRole, string][] = [
    ['waiter', 'Waiter'],
    ['chef', 'Chef'],
    ['manager', 'Manager'],
    ['admin', 'Admin'],
  ];

  for (const [role, label] of roles) {
    it(`shows the ${role}'s role badge and what the role can do`, () => {
      // Arrange
      auth.user = makeUser({ role });

      // Act
      render(<MyAccount />);

      // Assert
      expect(screen.getByRole('heading', { name: 'My account' })).toBeInTheDocument();
      expect(screen.getByText(label, { selector: '.badge' })).toBeInTheDocument();
      const canList = within(screen.getByRole('region', { name: 'You can' }));
      for (const item of ROLE_CAPABILITIES[role].can) expect(canList.getByText(item)).toBeInTheDocument();
    });
  }

  it('shows the name, email, status and member-since date in the header', () => {
    // Arrange
    auth.user = makeUser();
    const since = new Date('2025-03-14T12:00:00.000Z').toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    // Act
    render(<MyAccount />);

    // Assert
    expect(screen.getByText('Sam Staff')).toBeInTheDocument();
    expect(screen.getByText('sam@rest.test')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText(`Member since ${since}`)).toBeInTheDocument();
  });

  it('prefills the profile form and shows the password form', () => {
    // Arrange
    auth.user = makeUser();

    // Act
    render(<MyAccount />);

    // Assert
    expect(screen.getByLabelText('Name')).toHaveValue('Sam Staff');
    expect(screen.getByLabelText('Email')).toHaveValue('sam@rest.test');
    expect(screen.getByLabelText('Phone (optional)')).toHaveValue('+92 300 5550100');
    expect(screen.getByRole('button', { name: 'Change password' })).toBeInTheDocument();
  });

  it('asks the user to set their own password while on a temporary one', () => {
    // Arrange
    auth.user = makeUser({ mustChangePassword: true });

    // Act
    render(<MyAccount />);

    // Assert
    const notice = screen.getByRole('alert');
    expect(notice).toHaveTextContent("You're signed in with a temporary password.");
    expect(within(notice).getByRole('link', { name: 'Go to password' })).toHaveAttribute('href', '#change-password');
  });

  it('shows no temporary-password notice otherwise', () => {
    // Arrange
    auth.user = makeUser();

    // Act
    render(<MyAccount />);

    // Assert
    expect(screen.queryByText("You're signed in with a temporary password.")).not.toBeInTheDocument();
  });
});

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import RegisterPage, { metadata } from '@/app/register/page';

vi.mock('@/components/auth/register-form', () => ({ RegisterForm: () => <div data-testid="register-form" /> }));

describe('RegisterPage', () => {
  it('sets the page title', () => {
    // Arrange / Act / Assert
    expect(metadata.title).toBe('Create account');
  });

  it('shows the registration form and a link back to sign in', () => {
    // Arrange / Act
    render(<RegisterPage />);

    // Assert
    expect(screen.getByTestId('register-form')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
  });
});

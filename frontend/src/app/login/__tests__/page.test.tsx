import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import LoginPage, { metadata } from '@/app/login/page';

vi.mock('@/components/auth/login-form', () => ({ LoginForm: () => <div data-testid="login-form" /> }));

describe('LoginPage', () => {
  it('sets the page title', () => {
    // Arrange / Act / Assert
    expect(metadata.title).toBe('Sign in');
  });

  it('shows the brand mark and the login form', () => {
    // Arrange / Act
    render(<LoginPage />);

    // Assert
    expect(screen.getByText('Plate & Flame')).toBeInTheDocument();
    expect(screen.getByTestId('login-form')).toBeInTheDocument();
  });
});

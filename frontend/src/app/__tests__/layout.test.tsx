import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import RootLayout from '@/app/layout';

vi.mock('next/font/google', () => ({
  Inter: () => ({ variable: '--font-sans' }),
  Fraunces: () => ({ variable: '--font-display' }),
}));

const order: string[] = [];
vi.mock('@/context/auth-context', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => {
    order.push('auth');
    return <div data-testid="auth-provider">{children}</div>;
  },
}));
vi.mock('@/context/cart-context', () => ({
  CartProvider: ({ children }: { children: React.ReactNode }) => {
    order.push('cart');
    return <div data-testid="cart-provider">{children}</div>;
  },
}));
vi.mock('@/components/ui/toast', () => ({
  ToastProvider: ({ children }: { children: React.ReactNode }) => {
    order.push('toast');
    return <div data-testid="toast-provider">{children}</div>;
  },
}));

describe('RootLayout', () => {
  it('renders the page content inside Auth, Toast and Cart providers, in that order', () => {
    // Arrange
    order.length = 0;

    // Act
    render(
      <RootLayout>
        <p>Page content</p>
      </RootLayout>,
    );

    // Assert
    expect(screen.getByText('Page content')).toBeInTheDocument();
    expect(order).toEqual(['auth', 'toast', 'cart']);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import HomePage from '@/app/page';

vi.mock('@/components/layout/storefront-shell', () => ({ StorefrontShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('@/components/menu/public-menu', () => ({
  PublicMenu: ({ compact }: { compact?: boolean }) => <div data-testid="public-menu" data-compact={String(Boolean(compact))} />,
}));

describe('HomePage', () => {
  it('shows the hero heading and primary calls to action', () => {
    // Arrange / Act
    render(<HomePage />);

    // Assert
    expect(screen.getByRole('heading', { name: 'The fire sets the menu.' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Order online' })).toHaveAttribute('href', '/menu');
    expect(screen.getByRole('link', { name: 'Book a table' })).toHaveAttribute('href', '/book');
  });

  it('shows a compact preview of the public menu', () => {
    // Arrange / Act
    render(<HomePage />);

    // Assert
    expect(screen.getByTestId('public-menu')).toHaveAttribute('data-compact', 'true');
  });
});

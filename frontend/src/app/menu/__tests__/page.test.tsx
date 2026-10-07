import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import MenuPage from '@/app/menu/page';

vi.mock('@/components/layout/storefront-shell', () => ({ StorefrontShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('@/components/menu/public-menu', () => ({
  PublicMenu: ({ compact }: { compact?: boolean }) => <div data-testid="public-menu" data-compact={String(Boolean(compact))} />,
}));

describe('MenuPage', () => {
  it('shows the page heading and the full (non-compact) public menu', () => {
    // Arrange / Act
    render(<MenuPage />);

    // Assert
    expect(screen.getByRole('heading', { name: 'The menu' })).toBeInTheDocument();
    expect(screen.getByTestId('public-menu')).toHaveAttribute('data-compact', 'false');
  });
});

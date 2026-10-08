import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import MyAccountPage from '@/app/staff/account/page';

vi.mock('@/components/layout/staff-layout', () => ({
  StaffLayout: ({ children, section }: { children: React.ReactNode; section?: string }) => (
    <div data-testid="staff-layout" data-section={section}>
      {children}
    </div>
  ),
}));
vi.mock('@/components/staff/my-account', () => ({ MyAccount: () => <div data-testid="my-account" /> }));

describe('MyAccountPage', () => {
  it('wraps "My account" in the "account" staff-layout section', () => {
    // Arrange / Act
    render(<MyAccountPage />);

    // Assert
    expect(screen.getByTestId('staff-layout')).toHaveAttribute('data-section', 'account');
    expect(screen.getByTestId('my-account')).toBeInTheDocument();
  });
});

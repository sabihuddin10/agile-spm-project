import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import SettingsPage from '@/app/staff/settings/page';

vi.mock('@/components/layout/staff-layout', () => ({
  StaffLayout: ({ children, section }: { children: React.ReactNode; section?: string }) => (
    <div data-testid="staff-layout" data-section={section}>
      {children}
    </div>
  ),
}));
vi.mock('@/components/settings/settings-form', () => ({ SettingsForm: () => <div data-testid="settings-form" /> }));

describe('SettingsPage', () => {
  it('wraps the settings form and heading in the "settings" staff-layout section', () => {
    // Arrange / Act
    render(<SettingsPage />);

    // Assert
    expect(screen.getByTestId('staff-layout')).toHaveAttribute('data-section', 'settings');
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByTestId('settings-form')).toBeInTheDocument();
  });
});

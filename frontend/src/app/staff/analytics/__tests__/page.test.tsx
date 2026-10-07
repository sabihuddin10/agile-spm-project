import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AnalyticsPage from '@/app/staff/analytics/page';

vi.mock('@/components/layout/staff-layout', () => ({
  StaffLayout: ({ children, section }: { children: React.ReactNode; section?: string }) => (
    <div data-testid="staff-layout" data-section={section}>
      {children}
    </div>
  ),
}));
vi.mock('@/components/analytics/analytics-dashboard', () => ({ AnalyticsDashboard: () => <div data-testid="analytics-dashboard" /> }));

describe('AnalyticsPage', () => {
  it('wraps the analytics dashboard in the "analytics" staff-layout section', () => {
    // Arrange / Act
    render(<AnalyticsPage />);

    // Assert
    expect(screen.getByTestId('staff-layout')).toHaveAttribute('data-section', 'analytics');
    expect(screen.getByTestId('analytics-dashboard')).toBeInTheDocument();
  });
});

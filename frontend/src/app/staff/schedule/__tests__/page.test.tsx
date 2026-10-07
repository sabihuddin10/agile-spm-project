import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import MySchedulePage from '@/app/staff/schedule/page';

vi.mock('@/components/layout/staff-layout', () => ({
  StaffLayout: ({ children, section }: { children: React.ReactNode; section?: string }) => (
    <div data-testid="staff-layout" data-section={section}>
      {children}
    </div>
  ),
}));
vi.mock('@/components/staff/my-schedule', () => ({ MySchedule: () => <div data-testid="my-schedule" /> }));

describe('MySchedulePage', () => {
  it('wraps "My schedule" in the "schedule" staff-layout section', () => {
    // Arrange / Act
    render(<MySchedulePage />);

    // Assert
    expect(screen.getByTestId('staff-layout')).toHaveAttribute('data-section', 'schedule');
    expect(screen.getByTestId('my-schedule')).toBeInTheDocument();
  });
});

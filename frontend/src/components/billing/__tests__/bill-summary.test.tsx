import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BillSummary } from '@/components/billing/bill-summary';
import type { BillingSummary } from '@/types';

describe('BillSummary', () => {
  it('renders outstanding, paid-today and ready-to-bill figures', () => {
    // Arrange
    const summary: BillingSummary = { outstanding: 125.5, openCount: 3, paidToday: 480, paidTodayCount: 12 };

    // Act
    render(<BillSummary summary={summary} readyCount={2} />);

    // Assert
    expect(screen.getByText('$125.50')).toBeInTheDocument();
    expect(screen.getByText('3 open bills')).toBeInTheDocument();
    expect(screen.getByText('$480.00')).toBeInTheDocument();
    expect(screen.getByText('12 bills · net of refunds')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('shows a loading skeleton instead of fake zeros while there is no summary yet', () => {
    // Arrange / Act
    render(<BillSummary summary={null} readyCount={0} />);

    // Assert
    expect(screen.getByRole('status', { name: 'Loading billing totals' })).toBeInTheDocument();
    expect(screen.queryByText('$0.00')).not.toBeInTheDocument();
    expect(screen.queryByText('0 open bills')).not.toBeInTheDocument();
  });
});

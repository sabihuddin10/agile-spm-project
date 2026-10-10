import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KpiTiles } from '@/components/analytics/kpi-tiles';
import type { AnalyticsDashboard } from '@/types';

describe('KpiTiles', () => {
  it('renders revenue, orders and derived percentages', () => {
    // Arrange
    const kpis: AnalyticsDashboard['kpis'] = {
      revenue: 1000,
      orders: 90,
      avgOrder: 11.11,
      tips: 100,
      refunds: 20,
      cancelled: 10,
      customers: 42,
    };

    // Act
    render(<KpiTiles kpis={kpis} />);

    // Assert
    expect(screen.getByText('Revenue')).toBeInTheDocument();
    expect(screen.getByText('$1,000.00')).toBeInTheDocument();
    expect(screen.getByText('10% of revenue')).toBeInTheDocument(); // 100/1000
    expect(screen.getByText('10% of all orders')).toBeInTheDocument(); // 10/100
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('shows a no-data hint when there is nothing to divide by', () => {
    // Arrange
    const kpis: AnalyticsDashboard['kpis'] = { revenue: 0, orders: 0, avgOrder: 0, tips: 0, refunds: 0, cancelled: 0, customers: 0 };

    // Act
    render(<KpiTiles kpis={kpis} />);

    // Assert
    expect(screen.getByText('No paid orders')).toBeInTheDocument();
    expect(screen.getByText('No orders')).toBeInTheDocument();
  });

  it('lays tiles out one per row on phones', () => {
    // Arrange
    const kpis: AnalyticsDashboard['kpis'] = { revenue: 0, orders: 0, avgOrder: 0, tips: 0, refunds: 0, cancelled: 0, customers: 0 };

    // Act
    const { container } = render(<KpiTiles kpis={kpis} />);

    // Assert
    const grid = container.querySelector('dl') as HTMLElement;
    expect(grid).toHaveClass('grid-cols-1', 'sm:grid-cols-2');
    expect(screen.getByText('Revenue').parentElement).toHaveClass('sm:col-span-2');
    expect(screen.getByText('Revenue').parentElement).not.toHaveClass('col-span-2');
  });
});

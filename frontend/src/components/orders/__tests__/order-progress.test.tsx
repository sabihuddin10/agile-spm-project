import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OrderProgress } from '@/components/orders/order-progress';

describe('OrderProgress', () => {
  it('shows a cancelled order distinctly, without the step list', () => {
    // Arrange / Act
    render(<OrderProgress status="cancelled" />);

    // Assert
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('marks the current step for screen readers', () => {
    // Arrange / Act
    render(<OrderProgress status="preparing" />);

    // Assert
    const current = screen.getByText(/preparing \(current\)/i);
    expect(current).toBeInTheDocument();
    expect(screen.getByText(/placed \(done\)/i)).toBeInTheDocument();
    expect(screen.getByText('Served', { selector: '.sr-only' })).toBeInTheDocument(); // not yet reached, no suffix
  });
});

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { presetRange, RangeControls } from '@/components/analytics/range-controls';
import { addDaysISO, localDateISO } from '@/lib/format';

describe('presetRange', () => {
  it('spans the last N days ending today', () => {
    const { from, to } = presetRange('7');
    expect(to).toBe(localDateISO());
    expect(from).toBe(addDaysISO(-6));
  });

  it('spans the 1st of this month through today', () => {
    const { from, to } = presetRange('month');
    expect(to).toBe(localDateISO());
    expect(from).toBe(`${localDateISO().slice(0, 7)}-01`);
  });
});

describe('RangeControls', () => {
  it('highlights the active preset and switches to another one', async () => {
    // Arrange
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<RangeControls value={{ preset: '7', from: addDaysISO(-6), to: localDateISO(), granularity: 'day' }} onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'Last 7 days' })).toHaveAttribute('aria-pressed', 'true');

    // Act
    await user.click(screen.getByRole('button', { name: 'Last 30 days' }));

    // Assert
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ preset: '30', from: addDaysISO(-29), to: localDateISO() }));
  });

  it('switches to a custom range when a date is edited directly', () => {
    // Arrange
    const onChange = vi.fn();
    render(<RangeControls value={{ preset: '7', from: addDaysISO(-6), to: localDateISO(), granularity: 'day' }} onChange={onChange} />);

    // Act — date inputs are set atomically; userEvent.type doesn't compose them reliably
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-01-01' } });

    // Assert
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ preset: 'custom', from: '2026-01-01' }));
  });

  it('shows a validation error when given one', () => {
    // Arrange / Act
    render(<RangeControls value={{ preset: 'custom', from: '2026-10-10', to: '2026-10-01', granularity: 'day' }} onChange={vi.fn()} error="The start date must be before the end date." />);

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent(/start date must be before/i);
  });
});

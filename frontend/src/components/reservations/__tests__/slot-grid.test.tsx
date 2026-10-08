import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SlotGrid } from '@/components/reservations/slot-grid';
import { localDateISO } from '@/lib/format';

describe('SlotGrid', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('prompts for a date when none is chosen yet', () => {
    // Arrange / Act
    render(<SlotGrid date="" slots={[]} value="" onChange={vi.fn()} loading={false} />);

    // Assert
    expect(screen.getByText(/pick a date/i)).toBeInTheDocument();
  });

  it('shows a loading hint while fetching with nothing cached yet', () => {
    // Arrange / Act
    render(<SlotGrid date="2026-10-10" slots={[]} value="" onChange={vi.fn()} loading />);

    // Assert
    expect(screen.getByText(/checking availability/i)).toBeInTheDocument();
  });

  it('groups slots into lunch and dinner', () => {
    // Arrange
    const slots = [{ time: '12:00', available: true }, { time: '19:00', available: true }];

    // Act
    render(<SlotGrid date="2026-10-10" slots={slots} value="" onChange={vi.fn()} loading={false} />);

    // Assert
    expect(screen.getByText('Lunch')).toBeInTheDocument();
    expect(screen.getByText('Dinner')).toBeInTheDocument();
  });

  it('disables a full slot and labels it accordingly', () => {
    // Arrange / Act
    render(<SlotGrid date="2026-10-10" slots={[{ time: '19:00', available: false }]} value="" onChange={vi.fn()} loading={false} />);

    // Assert
    const button = screen.getByRole('button', { name: /19:00, full/i });
    expect(button).toBeDisabled();
  });

  it('selects an available slot', async () => {
    // Arrange
    const onChange = vi.fn();
    const user = userEvent.setup({ delay: null });
    render(<SlotGrid date="2026-10-10" slots={[{ time: '19:00', available: true }]} value="" onChange={onChange} loading={false} />);

    // Act
    await user.click(screen.getByRole('button', { name: '19:00' }));

    // Assert
    expect(onChange).toHaveBeenCalledWith('19:00');
  });

  it('tells the guest everything is booked when no slot is open', () => {
    // Arrange / Act
    render(<SlotGrid date="2026-10-10" slots={[{ time: '19:00', available: false }]} value="" onChange={vi.fn()} loading={false} />);

    // Assert
    expect(screen.getByText(/fully booked/i)).toBeInTheDocument();
  });

  it('marks a past time on today\'s date instead of "full"', () => {
    // Arrange — pin the clock to midday so 'an hour ago' is still today
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 9, 12, 30));
    const today = localDateISO();
    const past = new Date();
    past.setHours(past.getHours() - 1);
    const pastTime = `${String(past.getHours()).padStart(2, '0')}:00`;

    // Act
    render(<SlotGrid date={today} slots={[{ time: pastTime, available: false }]} value="" onChange={vi.fn()} loading={false} />);

    // Assert
    expect(screen.getByRole('button', { name: new RegExp(`${pastTime}, past`, 'i') })).toBeInTheDocument();
  });
});

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShiftForm } from '@/components/staff/shift-form';
import { staffApi } from '@/lib/api';
import type { Shift, User } from '@/types';

vi.mock('@/lib/api', () => ({ staffApi: { createShift: vi.fn(), updateShift: vi.fn(), removeShift: vi.fn() } }));
vi.mock('@/components/ui/toast', () => ({ useToast: () => vi.fn() }));

const roster: User[] = [
  { id: 'usr_waiter', name: 'Will Waiter', email: 'w@rest.test', role: 'waiter', active: true },
  { id: 'usr_chef', name: 'Carlos Chef', email: 'c@rest.test', role: 'chef', active: true },
  { id: 'usr_suspended', name: 'Gone Guy', email: 'g@rest.test', role: 'waiter', active: false },
];

function makeShift(overrides: Partial<Shift> = {}): Shift {
  return {
    id: 'shf_1',
    userId: 'usr_waiter',
    userName: 'Will Waiter',
    role: 'waiter',
    date: '2026-10-10',
    start: '12:00',
    end: '18:00',
    hours: 6,
    notes: '',
    status: 'scheduled',
    ...overrides,
  } as Shift;
}

describe('ShiftForm — adding a shift', () => {
  it('only offers active staff, not suspended ones', () => {
    // Arrange / Act
    render(<ShiftForm roster={roster} onClose={vi.fn()} onSaved={vi.fn()} />);

    // Assert
    expect(screen.getByRole('option', { name: /will waiter/i })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /gone guy/i })).not.toBeInTheDocument();
  });

  it('warns when the end time is not after the start time', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    render(<ShiftForm roster={roster} onClose={vi.fn()} onSaved={vi.fn()} />);

    // Act
    const end = screen.getByLabelText('End');
    await user.clear(end);
    await user.type(end, '08:00'); // before the default 11:00 start

    // Assert
    expect(screen.getByText(/must end after it starts/i)).toBeInTheDocument();
  });

  it('creates a new shift for the chosen staff member', async () => {
    // Arrange
    const onSaved = vi.fn();
    const onClose = vi.fn();
    vi.mocked(staffApi.createShift).mockResolvedValue({ shift: makeShift() });
    const user = userEvent.setup({ delay: null });
    render(<ShiftForm roster={roster} onClose={onClose} onSaved={onSaved} />);

    // Act
    await user.selectOptions(screen.getByLabelText('Staff member'), 'usr_waiter');
    await user.click(screen.getByRole('button', { name: /add shift/i }));

    // Assert
    expect(staffApi.createShift).toHaveBeenCalledWith(expect.objectContaining({ userId: 'usr_waiter', start: '11:00', end: '17:00' }));
    expect(onSaved).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});

describe('ShiftForm — editing a shift', () => {
  it('requires a second click to delete the shift', async () => {
    // Arrange
    vi.mocked(staffApi.removeShift).mockResolvedValue({ deleted: true });
    const onSaved = vi.fn();
    const user = userEvent.setup({ delay: null });
    render(<ShiftForm shift={makeShift()} roster={roster} onClose={vi.fn()} onSaved={onSaved} />);

    // Act
    await user.click(screen.getByRole('button', { name: /delete shift/i }));
    // Assert — not yet deleted, confirmation showing
    expect(staffApi.removeShift).not.toHaveBeenCalled();
    expect(screen.getByText(/delete this shift/i)).toBeInTheDocument();

    // Act
    await user.click(screen.getByRole('button', { name: /yes, delete/i }));
    // Assert
    expect(staffApi.removeShift).toHaveBeenCalledWith('shf_1');
    expect(onSaved).toHaveBeenCalled();
  });

  it('saves status changes', async () => {
    // Arrange
    vi.mocked(staffApi.updateShift).mockResolvedValue({ shift: makeShift({ status: 'completed' }) });
    const user = userEvent.setup({ delay: null });
    render(<ShiftForm shift={makeShift()} roster={roster} onClose={vi.fn()} onSaved={vi.fn()} />);

    // Act
    await user.click(screen.getByRole('button', { name: 'Completed' }));
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    // Assert
    expect(staffApi.updateShift).toHaveBeenCalledWith('shf_1', expect.objectContaining({ status: 'completed' }));
  });
});

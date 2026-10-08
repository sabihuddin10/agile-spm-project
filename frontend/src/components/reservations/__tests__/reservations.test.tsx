/**
 * Tests for src/components/reservations: new-booking-form and reservation-card.
 * (slot-grid and use-availability have their own test files in this folder.)
 *
 * Every test follows Arrange-Act-Assert, with each phase commented.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NewBookingForm } from '@/components/reservations/new-booking-form';
import { ReservationCard } from '@/components/reservations/reservation-card';
import { ApiError, reservationApi } from '@/lib/api';
import type { Reservation, Table, TimeSlot } from '@/types';

const { toast } = vi.hoisted(() => ({ toast: vi.fn() }));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ApiError: actual.ApiError,
    reservationApi: { availability: vi.fn(), create: vi.fn(), update: vi.fn() },
  };
});
vi.mock('@/components/ui/toast', () => ({ useToast: () => toast }));

function makeReservation(overrides: Partial<Reservation> = {}): Reservation {
  return {
    id: 'res_1',
    customerName: 'Ana Silva',
    email: 'ana@example.com',
    phone: '+1 555 0100',
    partySize: 4,
    date: '2026-10-08',
    time: '19:00',
    tableId: null,
    tableNumber: null,
    status: 'requested',
    specialRequests: '',
    customerId: null,
    late: false,
    hasAccount: false,
    createdAt: '2026-10-01T10:00:00.000Z',
    confirmedAt: null,
    seatedAt: null,
    cancelledAt: null,
    notifiedAt: null,
    ...overrides,
  };
}

function makeTable(overrides: Partial<Table> = {}): Table {
  return {
    id: 'tbl_1',
    number: 1,
    seats: 4,
    zone: 'Main',
    status: 'free',
    waiterId: null,
    held: false,
    reservedFor: null,
    ...overrides,
  };
}

/* -------------------------------------------------------- new-booking-form */

describe('NewBookingForm', () => {
  const OPEN: TimeSlot[] = [
    { time: '12:00', available: true },
    { time: '19:00', available: true },
  ];

  beforeEach(() => {
    // Pin "today" to 8 Oct 2026, 10:00 local — only Date is faked so promises and user-event still run.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 8, 10, 0, 0));
    toast.mockReset();
    vi.mocked(reservationApi.availability).mockReset();
    vi.mocked(reservationApi.create).mockReset();
    vi.mocked(reservationApi.update).mockReset();
    vi.mocked(reservationApi.availability).mockImplementation(async (date, partySize) => ({ date, partySize, slots: OPEN }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function renderForm() {
    const onCreated = vi.fn();
    const onCancel = vi.fn();
    render(<NewBookingForm onCreated={onCreated} onCancel={onCancel} />);
    return { onCreated, onCancel };
  }

  async function fillGuest(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText('Guest name'), '  Ana Silva ');
    await user.type(screen.getByLabelText('Email'), 'ana@example.com');
  }

  it('defaults to today for 2 guests and loads that availability', async () => {
    // Arrange / Act
    renderForm();

    // Assert
    expect(screen.getByLabelText('Date')).toHaveValue('2026-10-08');
    expect(screen.getByLabelText('Date')).toHaveAttribute('min', '2026-10-08');
    expect(screen.getByLabelText('Party size')).toHaveValue('2');
    expect(await screen.findByRole('button', { name: '19:00' })).toBeInTheDocument();
    expect(reservationApi.availability).toHaveBeenCalledWith('2026-10-08', 2);
  });

  it('lists what is missing instead of submitting an incomplete booking', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    renderForm();
    await screen.findByRole('button', { name: '19:00' });

    // Act
    await user.click(screen.getByRole('button', { name: 'Create booking' }));

    // Assert
    expect(screen.getByText("Please add the guest's name, email, time.")).toBeInTheDocument();
    expect(reservationApi.create).not.toHaveBeenCalled();
  });

  it('reloads slots for a new party size and drops a time that is no longer open', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    vi.mocked(reservationApi.availability).mockImplementation(async (date, partySize) => ({
      date,
      partySize,
      slots: partySize > 4 ? [{ time: '12:00', available: true }, { time: '19:00', available: false }] : OPEN,
    }));
    renderForm();
    await fillGuest(user);
    await user.click(await screen.findByRole('button', { name: '19:00' }));

    // Act
    await user.selectOptions(screen.getByLabelText('Party size'), '6');
    await screen.findByRole('button', { name: '19:00, full' });
    await user.click(screen.getByRole('button', { name: 'Create booking' }));

    // Assert
    expect(reservationApi.availability).toHaveBeenLastCalledWith('2026-10-08', 6);
    expect(screen.getByText("Please add the guest's time.")).toBeInTheDocument();
    expect(reservationApi.create).not.toHaveBeenCalled();
  });

  it('loads availability for a newly picked date', async () => {
    // Arrange
    renderForm();
    await screen.findByRole('button', { name: '19:00' });

    // Act
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-10-10' } });

    // Assert
    await waitFor(() => expect(reservationApi.availability).toHaveBeenLastCalledWith('2026-10-10', 2));
  });

  it('creates the booking with trimmed details and confirms it straight away', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    const requested = makeReservation();
    const confirmed = makeReservation({ status: 'confirmed' });
    vi.mocked(reservationApi.create).mockResolvedValue({ reservation: requested });
    vi.mocked(reservationApi.update).mockResolvedValue({ reservation: confirmed });
    const { onCreated } = renderForm();
    await fillGuest(user);
    await user.selectOptions(screen.getByLabelText('Party size'), '4');
    await user.click(await screen.findByRole('button', { name: '19:00' }));
    await user.type(screen.getByLabelText('Special requests'), ' Window seat ');

    // Act
    await user.click(screen.getByRole('button', { name: 'Create booking' }));

    // Assert
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(confirmed));
    expect(reservationApi.create).toHaveBeenCalledWith({
      customerName: 'Ana Silva',
      email: 'ana@example.com',
      phone: undefined,
      partySize: 4,
      date: '2026-10-08',
      time: '19:00',
      specialRequests: 'Window seat',
    });
    expect(reservationApi.update).toHaveBeenCalledWith('res_1', { status: 'confirmed' });
    expect(toast).toHaveBeenCalledWith(expect.stringMatching(/booked and confirmed for ana silva/i), 'success');
  });

  it('leaves the booking as requested when "Confirm now" is unticked', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    const requested = makeReservation();
    vi.mocked(reservationApi.create).mockResolvedValue({ reservation: requested });
    const { onCreated } = renderForm();
    await fillGuest(user);
    await user.click(await screen.findByRole('button', { name: '12:00' }));
    await user.click(screen.getByRole('checkbox', { name: /confirm now/i }));

    // Act
    await user.click(screen.getByRole('button', { name: 'Create booking' }));

    // Assert
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(requested));
    expect(reservationApi.update).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith('Booking requested for Ana Silva.', 'success');
  });

  it('offers alternative slots when the time was taken, and picking one switches date and time', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    vi.mocked(reservationApi.create).mockRejectedValueOnce(
      new ApiError('Slot full', 409, {
        error: 'That time is fully booked.',
        alternatives: [{ date: '2026-10-09', time: '20:00' }],
      }),
    );
    renderForm();
    await fillGuest(user);
    await user.click(await screen.findByRole('button', { name: '19:00' }));

    // Act
    await user.click(screen.getByRole('button', { name: 'Create booking' }));

    // Assert
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('That time is fully booked.');

    // Act
    await user.click(screen.getByRole('button', { name: 'Tomorrow · 20:00' }));

    // Assert
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Date')).toHaveValue('2026-10-09');
    await waitFor(() => expect(reservationApi.availability).toHaveBeenLastCalledWith('2026-10-09', 2));
  });

  it('shows a toast for any other server error', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    vi.mocked(reservationApi.create).mockRejectedValueOnce(new Error('Server down'));
    const { onCreated } = renderForm();
    await fillGuest(user);
    await user.click(await screen.findByRole('button', { name: '19:00' }));

    // Act
    await user.click(screen.getByRole('button', { name: 'Create booking' }));

    // Assert
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Server down', 'error'));
    expect(onCreated).not.toHaveBeenCalled();
  });
});

/* -------------------------------------------------------- reservation-card */

describe('ReservationCard', () => {
  function renderCard(reservation: Reservation, props: Partial<React.ComponentProps<typeof ReservationCard>> = {}) {
    const handlers = {
      onConfirm: vi.fn(),
      onAssign: vi.fn(),
      onSeat: vi.fn(),
      onCancel: vi.fn(),
      onNoShow: vi.fn(),
    };
    render(
      <ul>
        <ReservationCard reservation={reservation} tables={[]} busy={false} {...handlers} {...props} />
      </ul>,
    );
    return handlers;
  }

  it("shows the booking's time, party, guest, contact, request and table", () => {
    // Arrange
    const r = makeReservation({
      specialRequests: 'Birthday cake',
      hasAccount: true,
      tableId: 't2',
      tableNumber: 2,
      status: 'confirmed',
    });

    // Act
    renderCard(r);

    // Assert
    expect(screen.getByText('19:00')).toBeInTheDocument();
    expect(screen.getByText('4 guests')).toBeInTheDocument();
    expect(screen.getByText('Ana Silva')).toBeInTheDocument();
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
    expect(screen.getByText('Has account')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'ana@example.com' })).toHaveAttribute('href', 'mailto:ana@example.com');
    expect(screen.getByRole('link', { name: '+1 555 0100' })).toHaveAttribute('href', 'tel:+15550100');
    expect(screen.getByText('Birthday cake')).toBeInTheDocument();
    expect(screen.getByText('Table 2')).toBeInTheDocument();
  });

  it('confirms a requested booking (no seat or no-show yet)', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    const handlers = renderCard(makeReservation({ status: 'requested' }));
    expect(screen.getByText('Not assigned')).toBeInTheDocument();

    // Act
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    // Assert
    expect(handlers.onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Seat party' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'No-show' })).not.toBeInTheDocument();
  });

  it('seats or cancels a confirmed booking; no-show stays locked until it is late', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    const handlers = renderCard(makeReservation({ status: 'confirmed', late: false }));

    // Act
    await user.click(screen.getByRole('button', { name: 'Seat party' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    // Assert
    expect(handlers.onSeat).toHaveBeenCalledTimes(1);
    expect(handlers.onCancel).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'No-show' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'No-show' })).toHaveAttribute('title', 'Available after the grace period');
  });

  it('flags a late booking and allows marking it a no-show', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    const handlers = renderCard(makeReservation({ status: 'confirmed', late: true }));

    // Act
    await user.click(screen.getByRole('button', { name: 'No-show' }));

    // Assert
    expect(screen.getByText('Late — past grace period')).toBeInTheDocument();
    expect(handlers.onNoShow).toHaveBeenCalledTimes(1);
  });

  it('offers only tables big enough for the party, smallest first, and assigns one', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    const tables = [
      makeTable({ id: 't6', number: 6, seats: 6, zone: 'Patio' }),
      makeTable({ id: 't2', number: 2, seats: 2 }),
      makeTable({ id: 't4', number: 4, seats: 4 }),
    ];
    const handlers = renderCard(makeReservation({ partySize: 4 }), { tables });
    const select = screen.getByLabelText('Assign table for Ana Silva');

    // Act
    await user.selectOptions(select, 't6');

    // Assert
    const labels = Array.from((select as HTMLSelectElement).options).map((o) => o.textContent);
    expect(labels).toEqual(['Assign table…', 'Table 4 · 4 seats · Main', 'Table 6 · 6 seats · Patio']);
    expect(handlers.onAssign).toHaveBeenCalledWith('t6');
  });

  it('unassigns the current table', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    const tables = [makeTable({ id: 't4', number: 4, seats: 4 })];
    const handlers = renderCard(makeReservation({ tableId: 't4', tableNumber: 4 }), { tables });

    // Act
    await user.selectOptions(screen.getByLabelText('Assign table for Ana Silva'), 'Unassign table');

    // Assert
    expect(handlers.onAssign).toHaveBeenCalledWith(null);
  });

  it('says when no table can seat the party', () => {
    // Arrange / Act
    renderCard(makeReservation({ partySize: 9 }), { tables: [makeTable({ seats: 4 })] });

    // Assert
    expect(screen.getByText('No table seats 9.')).toBeInTheDocument();
  });

  it('shows no actions for a seated or cancelled booking', () => {
    // Arrange / Act
    renderCard(makeReservation({ status: 'seated', seatedAt: '2026-10-08T19:05:00.000Z' }));

    // Assert
    expect(screen.getByText('Seated')).toBeInTheDocument();
    expect(screen.getByText(/^Seated .+/)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('disables actions while busy', () => {
    // Arrange / Act
    renderCard(makeReservation({ status: 'requested' }), { busy: true });

    // Assert
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByLabelText('Assign table for Ana Silva')).toBeDisabled();
  });
});

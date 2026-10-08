import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReservationsPage from '@/app/staff/reservations/page';
import { reservationApi, tableApi } from '@/lib/api';
import type { Reservation } from '@/types';

const toastFn = vi.fn();
vi.mock('@/components/ui/toast', () => ({ useToast: () => toastFn }));
vi.mock('@/components/layout/staff-layout', () => ({ StaffLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    reservationApi: { ...actual.reservationApi, list: vi.fn(), update: vi.fn(), cancel: vi.fn() },
    tableApi: { ...actual.tableApi, list: vi.fn() },
  };
});
vi.mock('@/components/reservations/reservation-card', () => ({
  ReservationCard: ({ reservation, onConfirm, onSeat, onCancel, onNoShow }: {
    reservation: Reservation;
    onConfirm: () => void;
    onSeat: () => void;
    onCancel: () => void;
    onNoShow: () => void;
  }) => (
    <li data-testid={`reservation-${reservation.id}`}>
      <span>{reservation.customerName}</span>
      <button onClick={onConfirm}>Confirm {reservation.customerName}</button>
      <button onClick={onSeat}>Seat {reservation.customerName}</button>
      <button onClick={onCancel}>Cancel {reservation.customerName}</button>
      <button onClick={onNoShow}>No-show {reservation.customerName}</button>
    </li>
  ),
}));
vi.mock('@/components/reservations/new-booking-form', () => ({
  NewBookingForm: ({ onCreated }: { onCreated: () => void }) => (
    <div data-testid="new-booking-form">
      <button onClick={onCreated}>Submit booking</button>
    </div>
  ),
}));

function makeReservation(overrides: Partial<Reservation> = {}): Reservation {
  return {
    id: 'res_1', customerName: 'Jordan Guest', email: 'jordan@example.com', phone: '',
    partySize: 2, date: '2026-10-10', time: '19:00', tableId: null, tableNumber: null,
    status: 'requested', specialRequests: '', customerId: null, late: false, hasAccount: false,
    ...overrides,
  } as Reservation;
}

describe('ReservationsPage', () => {
  beforeEach(() => {
    toastFn.mockClear();
    vi.mocked(tableApi.list).mockResolvedValue({ tables: [], zones: [], statuses: [] });
    vi.mocked(reservationApi.update).mockResolvedValue({ reservation: makeReservation({ status: 'confirmed' }) });
    vi.mocked(reservationApi.cancel).mockResolvedValue({ reservation: makeReservation({ status: 'cancelled' }) });
    vi.stubGlobal('confirm', vi.fn(() => true));
  });

  it('shows a loading spinner, then bookings grouped by date', async () => {
    // Arrange
    vi.mocked(reservationApi.list).mockResolvedValue({ reservations: [makeReservation()], slots: [] });

    // Act
    render(<ReservationsPage />);

    // Assert
    expect(screen.getByText('Loading reservations…')).toBeInTheDocument();
    expect(await screen.findByTestId('reservation-res_1')).toBeInTheDocument();
  });

  it('shows an empty state when there are no bookings for the scope', async () => {
    // Arrange
    vi.mocked(reservationApi.list).mockResolvedValue({ reservations: [], slots: [] });

    // Act
    render(<ReservationsPage />);

    // Assert
    expect(await screen.findByText('No bookings')).toBeInTheDocument();
  });

  it('reloads with a new scope when a period tab is selected', async () => {
    // Arrange
    vi.mocked(reservationApi.list).mockResolvedValue({ reservations: [], slots: [] });
    const user = userEvent.setup({ delay: null });
    render(<ReservationsPage />);
    await screen.findByText('No bookings');

    // Act
    await user.click(screen.getByRole('tab', { name: 'Past' }));

    // Assert
    await waitFor(() => expect(reservationApi.list).toHaveBeenLastCalledWith({ scope: 'past' }));
  });

  it('confirms a requested booking', async () => {
    // Arrange
    vi.mocked(reservationApi.list).mockResolvedValue({ reservations: [makeReservation()], slots: [] });
    const user = userEvent.setup({ delay: null });
    render(<ReservationsPage />);
    await screen.findByTestId('reservation-res_1');

    // Act
    await user.click(screen.getByRole('button', { name: 'Confirm Jordan Guest' }));

    // Assert
    await waitFor(() => expect(reservationApi.update).toHaveBeenCalledWith('res_1', { status: 'confirmed' }));
    expect(toastFn).toHaveBeenCalledWith('Confirmed — guest notified', 'success');
  });

  it('cancels a booking after confirmation', async () => {
    // Arrange
    vi.mocked(reservationApi.list).mockResolvedValue({ reservations: [makeReservation()], slots: [] });
    const user = userEvent.setup({ delay: null });
    render(<ReservationsPage />);
    await screen.findByTestId('reservation-res_1');

    // Act
    await user.click(screen.getByRole('button', { name: 'Cancel Jordan Guest' }));

    // Assert
    await waitFor(() => expect(reservationApi.cancel).toHaveBeenCalledWith('res_1'));
  });

  it('opens the new-booking form and reloads once a booking is created', async () => {
    // Arrange
    vi.mocked(reservationApi.list).mockResolvedValue({ reservations: [], slots: [] });
    const user = userEvent.setup({ delay: null });
    render(<ReservationsPage />);
    await screen.findByText('No bookings');

    // Act
    await user.click(screen.getByRole('button', { name: '+ New booking' }));
    await user.click(screen.getByRole('button', { name: 'Submit booking' }));

    // Assert
    expect(screen.queryByTestId('new-booking-form')).not.toBeInTheDocument();
    await waitFor(() => expect(reservationApi.list).toHaveBeenCalledTimes(2));
  });
});

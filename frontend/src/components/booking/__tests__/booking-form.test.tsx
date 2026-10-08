import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BookingForm } from '@/components/booking/booking-form';
import { ApiError, reservationApi } from '@/lib/api';
import { useAuth } from '@/context/auth-context';
import { addDaysISO } from '@/lib/format';
import type { Reservation } from '@/types';

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return { ...actual, reservationApi: { availability: vi.fn(), create: vi.fn() } };
});
vi.mock('@/context/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock('@/components/ui/toast', () => ({ useToast: () => vi.fn() }));

const FUTURE = addDaysISO(5);

async function fillBasics(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/full name/i), 'Jordan Guest');
  await user.type(screen.getByLabelText(/^email$/i), 'jordan@example.com');
}

describe('BookingForm', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({ user: null } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(reservationApi.availability).mockResolvedValue({ date: FUTURE, partySize: 2, slots: [{ time: '19:00', available: true }] });
  });

  it('requires a name, email, date and time before submitting', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    render(<BookingForm />);

    // Act
    await user.click(screen.getByRole('button', { name: /request booking/i }));

    // Assert
    expect(screen.getByText(/please enter your name/i)).toBeInTheDocument();
    expect(screen.getByText(/please enter your email/i)).toBeInTheDocument();
    expect(screen.getByText(/please choose a date/i)).toBeInTheDocument();
    expect(reservationApi.create).not.toHaveBeenCalled();
  });

  it('rejects an invalid email', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    render(<BookingForm />);

    // Act
    await user.type(screen.getByLabelText(/^email$/i), 'not-an-email');
    await user.click(screen.getByRole('button', { name: /request booking/i }));

    // Assert
    expect(screen.getByText(/doesn.t look right/i)).toBeInTheDocument();
  });

  it('submits a valid booking and shows the confirmation', async () => {
    // Arrange
    vi.mocked(reservationApi.create).mockResolvedValue({
      reservation: { id: 'res_1', customerName: 'Jordan Guest', email: 'jordan@example.com', partySize: 2, date: FUTURE, time: '19:00', status: 'requested' } as Reservation,
    });
    const user = userEvent.setup({ delay: null });
    render(<BookingForm />);

    // Act
    await fillBasics(user);
    await user.type(screen.getByLabelText('Date'), FUTURE);
    await waitFor(() => expect(screen.getByRole('button', { name: '19:00' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: '19:00' }));
    await user.click(screen.getByRole('button', { name: /request booking/i }));

    // Assert
    await waitFor(() => expect(reservationApi.create).toHaveBeenCalled());
    expect(await screen.findByText(/booking requested/i)).toBeInTheDocument();
  });

  it('shows alternative slots when the requested time is fully booked', async () => {
    // Arrange
    vi.mocked(reservationApi.create).mockRejectedValue(
      new ApiError('Fully booked', 409, { error: 'Fully booked', alternatives: [{ date: FUTURE, time: '19:30' }] }),
    );
    const user = userEvent.setup({ delay: null });
    render(<BookingForm />);

    // Act
    await fillBasics(user);
    await user.type(screen.getByLabelText('Date'), FUTURE);
    await waitFor(() => expect(screen.getByRole('button', { name: '19:00' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: '19:00' }));
    await user.click(screen.getByRole('button', { name: /request booking/i }));

    // Assert
    expect(await screen.findByText(/fully booked/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /19:30/i })).toBeInTheDocument();
  });
});

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

  it('keeps "Request booking" disabled until name, email, date and time are filled', async () => {
    // Arrange / Act
    render(<BookingForm />);

    // Assert — no errors on a pristine form, just the hint by the button
    const submit = screen.getByRole('button', { name: /request booking/i });
    expect(submit).toBeDisabled();
    expect(submit).toHaveAccessibleDescription('Complete these fields to continue: Full name, Email, Date, Time.');
    expect(screen.queryByText(/please enter your name/i)).not.toBeInTheDocument();
    expect(reservationApi.create).not.toHaveBeenCalled();
  });

  it('rejects an invalid email as it is typed', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    render(<BookingForm />);

    // Act
    await user.type(screen.getByLabelText(/^email$/i), 'not-an-email');

    // Assert
    expect(screen.getByText(/doesn.t look right/i)).toBeInTheDocument();
  });

  it('refuses a two-letter name like "SS"', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    render(<BookingForm />);

    // Act
    await user.type(screen.getByLabelText(/full name/i), 'SS');

    // Assert
    expect(screen.getByLabelText(/full name/i)).toHaveAccessibleDescription(/full name: at least 3 letters/);
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

describe('BookingForm — live field checks', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({ user: null } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(reservationApi.availability).mockResolvedValue({ date: FUTURE, partySize: 2, slots: [{ time: '19:00', available: true }] });
  });

  it('checks the phone on blur and ties the error to the field', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    render(<BookingForm />);
    const phone = screen.getByLabelText(/phone/i);

    // Act
    await user.type(phone, 'call 0300 12');
    await user.tab();

    // Assert
    expect(phone).toHaveAttribute('aria-invalid', 'true');
    expect(phone).toHaveValue('+92 300 12');
    expect(phone).toHaveAccessibleDescription('Enter a mobile number like 0300 1234567.');

    // Act
    await user.clear(phone);
    await user.type(phone, '0300 1234567');

    // Assert
    expect(phone).toHaveAttribute('aria-invalid', 'false');
  });

  it('flags a name that is too long when you leave the field', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    render(<BookingForm />);
    const name = screen.getByLabelText(/full name/i);

    // Act
    await user.type(name, 'x'.repeat(85));
    await user.tab();

    // Assert
    expect(name).toHaveAccessibleDescription(/80 characters or fewer/);
  });
});

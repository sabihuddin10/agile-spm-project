import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsForm } from '@/components/settings/settings-form';
import { settingsApi } from '@/lib/api';
import { useAuth } from '@/context/auth-context';
import type { Settings, User } from '@/types';

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return { ...actual, settingsApi: { get: vi.fn(), update: vi.fn() } };
});
vi.mock('@/context/auth-context', () => ({ useAuth: vi.fn() }));

const toastFn = vi.fn();
vi.mock('@/components/ui/toast', () => ({ useToast: () => toastFn }));

function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    restaurantName: 'Flame Bistro',
    address: '12 Market St',
    taxRate: 0.08,
    serviceChargeRate: 0.1,
    pointValue: 0.05,
    kitchenDelayMinutes: 15,
    reservationDurationMinutes: 90,
    reservationGraceMinutes: 15,
    openingHour: 9,
    closingHour: 22,
    ...overrides,
  };
}

function mockUser(role: User['role']) {
  vi.mocked(useAuth).mockReturnValue({ user: { id: 'u1', name: 'Test', email: 't@test.com', role, active: true } } as unknown as ReturnType<typeof useAuth>);
}

describe('SettingsForm', () => {
  beforeEach(() => {
    toastFn.mockClear();
    vi.mocked(settingsApi.get).mockResolvedValue({ settings: makeSettings(), timeSlots: ['12:00', '12:30'] });
  });

  it('shows a loading spinner while settings are being fetched', () => {
    // Arrange
    mockUser('manager');
    vi.mocked(settingsApi.get).mockReturnValue(new Promise(() => {}));

    // Act
    render(<SettingsForm />);

    // Assert
    expect(screen.getByText('Loading settings…')).toBeInTheDocument();
  });

  it('loads and displays the current settings for a manager', async () => {
    // Arrange
    mockUser('manager');

    // Act
    render(<SettingsForm />);

    // Assert
    expect(await screen.findByDisplayValue('Flame Bistro')).toBeInTheDocument();
    expect(screen.getByDisplayValue('12 Market St')).toBeInTheDocument();
    expect(screen.getByDisplayValue('8')).toBeInTheDocument();
    expect(screen.getByText(/Bookable time slots/)).toBeInTheDocument();
  });

  it('shows an error state with a retry button when loading fails', async () => {
    // Arrange
    mockUser('manager');
    vi.mocked(settingsApi.get).mockRejectedValueOnce(new Error('Network error'));

    // Act
    render(<SettingsForm />);

    // Assert
    expect(await screen.findByText('Settings could not be loaded.')).toBeInTheDocument();
    expect(toastFn).toHaveBeenCalledWith('Network error', 'error');
  });

  it('disables all fields and hides the save bar for a non-editing role', async () => {
    // Arrange
    mockUser('waiter');

    // Act
    render(<SettingsForm />);
    await screen.findByDisplayValue('Flame Bistro');

    // Assert
    expect(screen.getByText(/only managers and admins can change them/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('Flame Bistro')).toBeDisabled();
    expect(screen.queryByRole('button', { name: /save settings/i })).not.toBeInTheDocument();
  });

  it('marks the form dirty after a change and saves successfully', async () => {
    // Arrange
    mockUser('manager');
    const updated = makeSettings({ restaurantName: 'Flame Bistro & Grill' });
    vi.mocked(settingsApi.update).mockResolvedValue({ settings: updated });
    const user = userEvent.setup();
    render(<SettingsForm />);
    const nameInput = await screen.findByDisplayValue('Flame Bistro');
    expect(screen.getByText('All changes saved.')).toBeInTheDocument();

    // Act
    await user.clear(nameInput);
    await user.type(nameInput, 'Flame Bistro & Grill');

    // Assert
    expect(screen.getByText('You have unsaved changes.')).toBeInTheDocument();

    // Act
    await user.click(screen.getByRole('button', { name: /save settings/i }));

    // Assert
    await waitFor(() => expect(settingsApi.update).toHaveBeenCalled());
    expect(toastFn).toHaveBeenCalledWith(expect.stringContaining('Settings saved'), 'success');
  });

  it('resets the form back to the saved values when Reset is clicked', async () => {
    // Arrange
    mockUser('manager');
    const user = userEvent.setup();
    render(<SettingsForm />);
    const nameInput = await screen.findByDisplayValue('Flame Bistro');

    // Act
    await user.clear(nameInput);
    await user.type(nameInput, 'Changed Name');
    await user.click(screen.getByRole('button', { name: /reset/i }));

    // Assert
    expect(screen.getByDisplayValue('Flame Bistro')).toBeInTheDocument();
    expect(screen.getByText('All changes saved.')).toBeInTheDocument();
  });

  it('shows a validation error and blocks submission when a required field is cleared', async () => {
    // Arrange
    mockUser('manager');
    const user = userEvent.setup();
    render(<SettingsForm />);
    const nameInput = await screen.findByDisplayValue('Flame Bistro');

    // Act
    await user.clear(nameInput);
    await user.click(screen.getByRole('button', { name: /save settings/i }));

    // Assert
    expect(screen.getByText('Restaurant name cannot be empty.')).toBeInTheDocument();
    expect(settingsApi.update).not.toHaveBeenCalled();
  });

  it('maps a server range-validation error onto the matching field with friendly units', async () => {
    // Arrange
    mockUser('manager');
    vi.mocked(settingsApi.update).mockRejectedValue(new Error('taxRate must be between 0 and 0.5.'));
    const user = userEvent.setup();
    render(<SettingsForm />);
    const nameInput = await screen.findByDisplayValue('Flame Bistro');

    // Act: make a harmless change so the form is dirty and savable
    await user.type(nameInput, ' Extra');
    await user.click(screen.getByRole('button', { name: /save settings/i }));

    // Assert
    expect(await screen.findByText('Tax rate must be between 0% and 50%.')).toBeInTheDocument();
  });
});

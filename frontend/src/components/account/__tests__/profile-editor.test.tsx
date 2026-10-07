import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProfileEditor } from '@/components/account/profile-editor';
import { ToastProvider } from '@/components/ui/toast';
import type { Customer } from '@/types';

vi.mock('@/lib/api', () => ({
  customerApi: { updateMe: vi.fn() },
}));
vi.mock('@/context/auth-context', () => ({
  useAuth: () => ({ refreshUser: vi.fn().mockResolvedValue(undefined) }),
}));

import { customerApi } from '@/lib/api';

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 'cus_1',
    name: 'Casey Customer',
    email: 'casey@example.com',
    phone: '',
    type: 'online',
    loyaltyPoints: 40,
    totalSpend: 0,
    preferences: { dietary: [], allergies: [] },
    notes: '',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function renderEditor(customer: Customer, onSaved = vi.fn()) {
  return render(
    <ToastProvider>
      <ProfileEditor customer={customer} onSaved={onSaved} />
    </ToastProvider>,
  );
}

describe('ProfileEditor', () => {
  beforeEach(() => {
    vi.mocked(customerApi.updateMe).mockReset();
  });

  it('shows the customer\'s current details', () => {
    // Arrange
    const customer = makeCustomer({ name: 'Casey Customer', email: 'casey@example.com' });

    // Act
    renderEditor(customer);

    // Assert
    expect(screen.getByLabelText('Name')).toHaveValue('Casey Customer');
    expect(screen.getByLabelText('Email')).toHaveValue('casey@example.com');
  });

  it('rejects an empty name without calling the API', async () => {
    // Arrange
    const customer = makeCustomer();
    const user = userEvent.setup();
    renderEditor(customer);

    // Act
    await user.clear(screen.getByLabelText('Name'));
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent('Name cannot be empty.');
    expect(customerApi.updateMe).not.toHaveBeenCalled();
  });

  it('rejects an invalid email without calling the API', async () => {
    // Arrange
    const customer = makeCustomer();
    const user = userEvent.setup();
    renderEditor(customer);

    // Act
    await user.clear(screen.getByLabelText('Email'));
    await user.type(screen.getByLabelText('Email'), 'not-an-email');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent('Please enter a valid email address.');
    expect(customerApi.updateMe).not.toHaveBeenCalled();
  });

  it('saves trimmed details and preferences, then reports success', async () => {
    // Arrange
    const customer = makeCustomer();
    const updated = { ...customer, name: 'Casey C.' };
    vi.mocked(customerApi.updateMe).mockResolvedValue({ customer: updated });
    const onSaved = vi.fn();
    const user = userEvent.setup();
    renderEditor(customer, onSaved);

    // Act
    await user.clear(screen.getByLabelText('Name'));
    await user.type(screen.getByLabelText('Name'), '  Casey C.  ');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    // Assert
    expect(customerApi.updateMe).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Casey C.', preferences: { dietary: [], allergies: [] } }),
    );
    await screen.findByText('Profile saved.');
    expect(screen.queryByText(/unsaved changes/i)).not.toBeInTheDocument();
    expect(onSaved).toHaveBeenCalledWith(updated);
  });

  it('toggles an allergy preference chip', async () => {
    // Arrange
    const customer = makeCustomer();
    const user = userEvent.setup();
    renderEditor(customer);
    const chip = screen.getByRole('checkbox', { name: /peanuts/i });
    expect(chip).toHaveAttribute('aria-checked', 'false');

    // Act
    await user.click(chip);

    // Assert
    expect(chip).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument();
  });
});

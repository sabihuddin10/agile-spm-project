/**
 * Tests for src/components/customers: customer-detail and customer-form.
 * (customer-table has its own test file in this folder; preference-options is
 * covered indirectly via components/account/profile-editor's tests.)
 *
 * Every test follows Arrange-Act-Assert, with each phase commented.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CustomerDetail } from '@/components/customers/customer-detail';
import { CustomerForm } from '@/components/customers/customer-form';
import type { Customer, OrderRecord } from '@/types';

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 'cus_1',
    name: 'Sofia Ramirez',
    email: 'sofia@example.com',
    phone: '+92 300 5550103',
    type: 'online',
    loyaltyPoints: 540,
    totalSpend: 300,
    preferences: { dietary: ['vegan'], allergies: ['shellfish'] },
    notes: 'Prefers the window booth.',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeRecord(overrides: Partial<OrderRecord> = {}): OrderRecord {
  return {
    id: 'ord_1',
    number: 101,
    date: '2026-09-01',
    createdAt: '2026-09-01T12:00:00.000Z',
    total: 42.5,
    items: ['2× Burger', 'Soda'],
    status: 'closed',
    paymentStatus: 'paid',
    paymentMethod: 'card',
    pointsEarned: 4,
    type: 'dine-in',
    fulfillment: 'dine-in',
    refundedAmount: 0,
    ...overrides,
  };
}

/* --------------------------------------------------------- customer-detail */

describe('CustomerDetail', () => {
  it('shows the profile: name, type, contact, notes and preferences', () => {
    // Arrange
    const customer = makeCustomer();

    // Act
    render(<CustomerDetail customer={customer} onEdit={vi.fn()} onDelete={vi.fn()} />);

    // Assert
    expect(screen.getByRole('heading', { name: 'Sofia Ramirez' })).toBeInTheDocument();
    expect(screen.getByText('Online')).toBeInTheDocument();
    expect(screen.getByText('sofia@example.com')).toBeInTheDocument();
    expect(screen.getByText('· +92 300 5550103')).toBeInTheDocument();
    expect(screen.getByText('Prefers the window booth.')).toBeInTheDocument();
    expect(screen.getByText('vegan')).toBeInTheDocument();
    // Allergy pill carries an icon plus screen-reader text, not a bare glyph
    const allergy = screen.getByText('shellfish', { exact: false, selector: 'span.bg-red-50' });
    expect(allergy).toHaveTextContent('Allergy: shellfish');
    expect(allergy.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('shows spend, order count, average order and Flame Points', () => {
    // Arrange
    const customer = makeCustomer({
      totalSpend: 300,
      orderCount: 4,
      loyaltyPoints: 540,
      orderHistory: [makeRecord()],
    });

    // Act
    render(<CustomerDetail customer={customer} onEdit={vi.fn()} onDelete={vi.fn()} />);

    // Assert — orderCount wins over the (possibly truncated) history length
    const stat = (label: string) => screen.getByText(label).previousElementSibling;
    expect(stat('Total spend')).toHaveTextContent('$300.00');
    expect(stat('Orders')).toHaveTextContent('4');
    expect(stat('Avg / order')).toHaveTextContent('$75.00');
    expect(stat('Flame Points')).toHaveTextContent('540');
  });

  it('lists order history newest first with items, total, status, payment, refund and points', () => {
    // Arrange
    const older = makeRecord({ id: 'a', number: 101, createdAt: '2026-08-01T12:00:00.000Z' });
    const newer = makeRecord({
      id: 'b',
      number: 102,
      createdAt: '2026-09-15T12:00:00.000Z',
      items: ['Pasta'],
      total: 18,
      paymentStatus: 'refunded',
      paymentMethod: 'cash',
      refundedAmount: 18,
      pointsEarned: 0,
      fulfillment: 'pickup',
    });
    const customer = makeCustomer({ orderHistory: [older, newer] });

    // Act
    render(<CustomerDetail customer={customer} onEdit={vi.fn()} onDelete={vi.fn()} />);

    // Assert
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('#102');
    expect(rows[0]).toHaveTextContent('Pickup');
    expect(rows[0]).toHaveTextContent('Pasta');
    expect(rows[0]).toHaveTextContent('$18.00');
    expect(within(rows[0]).getByText('Refunded · cash')).toBeInTheDocument();
    expect(within(rows[0]).getByText('Refunded $18.00')).toBeInTheDocument();
    expect(rows[1]).toHaveTextContent('#101');
    expect(rows[1]).toHaveTextContent('2× Burger, Soda');
    expect(within(rows[1]).getByText('Closed')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Paid · card')).toBeInTheDocument();
    expect(within(rows[1]).getByText('+4 pts')).toBeInTheDocument();
  });

  it('shows empty states for no orders and no preferences', () => {
    // Arrange
    const customer = makeCustomer({ orderHistory: [], notes: '', preferences: { dietary: [], allergies: [] } });

    // Act
    render(<CustomerDetail customer={customer} onEdit={vi.fn()} onDelete={vi.fn()} />);

    // Assert
    expect(screen.getByText('No orders yet.')).toBeInTheDocument();
    expect(screen.getAllByText('None recorded')).toHaveLength(2);
    expect(screen.queryByText('Prefers the window booth.')).not.toBeInTheDocument();
  });

  it('fires edit, delete and close, and locks delete while deleting', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const onClose = vi.fn();
    const { rerender } = render(
      <CustomerDetail customer={makeCustomer()} onEdit={onEdit} onDelete={onDelete} onClose={onClose} />,
    );

    // Act
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Close Sofia Ramirez' }));

    // Assert
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);

    // Act
    rerender(<CustomerDetail customer={makeCustomer()} onEdit={onEdit} onDelete={onDelete} deleting />);

    // Assert
    expect(screen.getByRole('button', { name: 'Deleting…' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Close Sofia Ramirez' })).not.toBeInTheDocument();
  });

  it('hides Delete when no onDelete handler is given (role may not delete)', () => {
    // Arrange
    const customer = makeCustomer();

    // Act
    render(<CustomerDetail customer={customer} onEdit={vi.fn()} />);

    // Assert
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });
});

/* ----------------------------------------------------------- customer-form */

describe('CustomerForm', () => {
  it('adds a customer with trimmed fields, type and chosen preferences', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    const onSubmit = vi.fn();
    render(<CustomerForm onSubmit={onSubmit} onCancel={vi.fn()} />);

    // Act
    await user.type(screen.getByLabelText('Full name *'), '  Lena Park ');
    await user.type(screen.getByLabelText('Email'), ' lena@example.com ');
    await user.type(screen.getByLabelText('Phone'), '0300 5550199');
    await user.selectOptions(screen.getByLabelText('Type'), 'online');
    await user.click(screen.getByRole('checkbox', { name: 'vegan' }));
    await user.click(screen.getByRole('checkbox', { name: 'peanuts' }));
    await user.type(screen.getByLabelText('Notes'), 'Regular on Fridays');
    await user.click(screen.getByRole('button', { name: 'Add customer' }));

    // Assert
    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Lena Park',
      email: 'lena@example.com',
      phone: '+92 300 5550199',
      type: 'online',
      preferences: { dietary: ['vegan'], allergies: ['peanuts'] },
      notes: 'Regular on Fridays',
    });
  });

  it('keeps "Add customer" disabled on a pristine form, with a hint saying what is needed', () => {
    // Arrange / Act
    render(<CustomerForm onSubmit={vi.fn()} onCancel={vi.fn()} />);

    // Assert
    const submit = screen.getByRole('button', { name: 'Add customer' });
    expect(submit).toBeDisabled();
    expect(submit).toHaveAccessibleDescription('Complete these fields to continue: Full name, Email or phone.');
    expect(screen.getByLabelText('Full name *')).not.toHaveAttribute('aria-invalid');
  });

  it('refuses a name like "SS" and a customer with no way to reach them', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    const onSubmit = vi.fn();
    render(<CustomerForm onSubmit={onSubmit} onCancel={vi.fn()} />);
    const name = screen.getByLabelText('Full name *');

    // Act
    await user.type(name, 'SS');
    await user.click(screen.getByLabelText('Email'));
    await user.tab();

    // Assert
    expect(name).toHaveAccessibleDescription('Enter a full name: at least 3 letters, or a first and last name.');
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Add an email or phone so we can reach them.');
    expect(screen.getByRole('button', { name: 'Add customer' })).toBeDisabled();

    // Act — pressing Enter does not get round the disabled button
    await user.type(name, '{Enter}');

    // Assert
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('flags a malformed email and phone as they are typed', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    render(<CustomerForm onSubmit={vi.fn()} onCancel={vi.fn()} />);
    await user.type(screen.getByLabelText('Full name *'), 'Lena Park');

    // Act
    await user.type(screen.getByLabelText('Email'), 'lena@rest');
    await user.type(screen.getByLabelText('Phone'), '12-34');

    // Assert
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Enter an email address like name@example.com.');
    expect(screen.getByLabelText('Phone')).toHaveAccessibleDescription('Enter a mobile number like 0300 1234567.');
    expect(screen.getByRole('button', { name: 'Add customer' })).toBeDisabled();
  });

  it('caps notes at 500 characters with a live counter', () => {
    // Arrange
    render(<CustomerForm onSubmit={vi.fn()} onCancel={vi.fn()} />);

    // Act
    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'n'.repeat(501) } });

    // Assert
    expect(screen.getByText('501/500')).toBeInTheDocument();
    expect(screen.getByText('Notes can be at most 500 characters (501 now).')).toBeInTheDocument();
    expect(screen.getByLabelText('Notes')).toHaveAttribute('maxLength', '500');
    expect(screen.getByLabelText('Full name *')).toHaveAttribute('maxLength', '80');
    expect(screen.getByLabelText('Email')).toHaveAttribute('maxLength', '254');
    expect(screen.getByLabelText('Phone')).toHaveAttribute('maxLength', '30');
  });

  it('allows a walk-in customer with only a phone, and collapses spaces in the name', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    const onSubmit = vi.fn();
    render(<CustomerForm onSubmit={onSubmit} onCancel={vi.fn()} />);

    // Act
    await user.type(screen.getByLabelText('Full name *'), 'Walk   In');
    await user.type(screen.getByLabelText('Phone'), '+92 300 1234567');
    await user.click(screen.getByRole('button', { name: 'Add customer' }));

    // Assert
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Walk In', email: '', phone: '+92 300 1234567', type: 'walk-in' }),
    );
  });

  it('prefills an existing customer, keeps unknown preferences, and saves changes', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    const onSubmit = vi.fn();
    const initial = makeCustomer({ preferences: { dietary: ['keto-ish'], allergies: ['shellfish'] } });
    render(<CustomerForm initial={initial} onSubmit={onSubmit} onCancel={vi.fn()} />);
    expect(screen.getByLabelText('Full name *')).toHaveValue('Sofia Ramirez');
    expect(screen.getByRole('checkbox', { name: 'keto-ish' })).toHaveAttribute('aria-checked', 'true');

    // Act
    await user.click(screen.getByRole('checkbox', { name: 'shellfish' }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    // Assert
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Sofia Ramirez',
        email: 'sofia@example.com',
        preferences: { dietary: ['keto-ish'], allergies: [] },
      }),
    );
  });

  it('shows a server validation error and disables actions while saving', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    const onCancel = vi.fn();
    const { rerender } = render(
      <CustomerForm onSubmit={vi.fn()} onCancel={onCancel} error="Email already in use." />,
    );

    // Act
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent('Email already in use.');
    expect(onCancel).toHaveBeenCalledTimes(1);

    // Act
    rerender(<CustomerForm onSubmit={vi.fn()} onCancel={onCancel} submitting />);

    // Assert
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });
});

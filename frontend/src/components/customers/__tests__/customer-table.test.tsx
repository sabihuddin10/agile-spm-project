import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CustomerFilters, CustomerTable, EMPTY_FILTERS } from '@/components/customers/customer-table';
import type { Customer } from '@/types';

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 'cus_1',
    name: 'Sofia Ramirez',
    email: 'sofia@example.com',
    phone: '+1 555-0103',
    type: 'walk-in',
    loyaltyPoints: 540,
    totalSpend: 320.5,
    preferences: { dietary: ['vegan'], allergies: ['shellfish'] },
    notes: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('CustomerTable', () => {
  it('lists each customer\'s contact, spend and preferences', () => {
    // Arrange / Act
    render(<CustomerTable customers={[makeCustomer()]} onSelect={vi.fn()} selectedId={null} />);

    // Assert
    expect(screen.getByText('Sofia Ramirez')).toBeInTheDocument();
    expect(screen.getByText('$320.50')).toBeInTheDocument();
    expect(screen.getByText('vegan')).toBeInTheDocument();
    expect(screen.getByText(/shellfish/)).toBeInTheDocument();
  });

  it('selects a customer on row click', async () => {
    // Arrange
    const onSelect = vi.fn();
    const customer = makeCustomer();
    const user = userEvent.setup();
    render(<CustomerTable customers={[customer]} onSelect={onSelect} selectedId={null} />);

    // Act
    await user.click(screen.getByText('Sofia Ramirez'));

    // Assert
    expect(onSelect).toHaveBeenCalledWith(customer);
  });

  it('shows "None recorded" when there are no preferences', () => {
    // Arrange / Act
    render(<CustomerTable customers={[makeCustomer({ preferences: { dietary: [], allergies: [] } })]} onSelect={vi.fn()} selectedId={null} />);

    // Assert
    expect(screen.getByText('None recorded')).toBeInTheDocument();
  });
});

describe('CustomerFilters', () => {
  it('updates the search term', async () => {
    // Arrange
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<CustomerFilters value={EMPTY_FILTERS} onChange={onChange} />);

    // Act
    await user.type(screen.getByLabelText('Search'), 's');

    // Assert
    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_FILTERS, q: 's' });
  });

  it('shows Clear filters only once a filter is active, and clears them all', async () => {
    // Arrange
    const onChange = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<CustomerFilters value={EMPTY_FILTERS} onChange={onChange} />);
    expect(screen.queryByRole('button', { name: /clear filters/i })).not.toBeInTheDocument();

    // Act
    rerender(<CustomerFilters value={{ ...EMPTY_FILTERS, q: 'sofia' }} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: /clear filters/i }));

    // Assert
    expect(onChange).toHaveBeenCalledWith(EMPTY_FILTERS);
  });
});

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
    const user = userEvent.setup({ delay: null });
    render(<CustomerTable customers={[customer]} onSelect={onSelect} selectedId={null} />);

    // Act
    await user.click(screen.getByText('Sofia Ramirez'));

    // Assert
    expect(onSelect).toHaveBeenCalledWith(customer);
  });

  it('opens a customer from the keyboard through the name button', async () => {
    // Arrange
    const onSelect = vi.fn();
    const customer = makeCustomer();
    const user = userEvent.setup({ delay: null });
    render(<CustomerTable customers={[customer]} onSelect={onSelect} selectedId={null} />);

    // Act
    await user.tab();
    await user.keyboard('{Enter}');

    // Assert
    expect(screen.getByRole('button', { name: 'Sofia Ramirez' })).toHaveFocus();
    expect(onSelect).toHaveBeenCalledWith(customer);
  });

  it('marks only the selected row with aria-current, without row-level tabIndex or aria-selected', () => {
    // Arrange
    const customers = [makeCustomer(), makeCustomer({ id: 'cus_2', name: 'Liam Chen' })];

    // Act
    render(<CustomerTable customers={customers} onSelect={vi.fn()} selectedId="cus_2" />);

    // Assert
    const [, sofiaRow, liamRow] = screen.getAllByRole('row');
    expect(liamRow).toHaveAttribute('aria-current', 'true');
    expect(sofiaRow).not.toHaveAttribute('aria-current');
    expect(liamRow).not.toHaveAttribute('tabindex');
    expect(liamRow).not.toHaveAttribute('aria-selected');
  });

  it('labels allergy pills for screen readers', () => {
    // Arrange / Act
    render(<CustomerTable customers={[makeCustomer()]} onSelect={vi.fn()} selectedId={null} />);

    // Assert
    expect(screen.getByText('Allergy:').parentElement).toHaveTextContent('Allergy: shellfish');
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
    const user = userEvent.setup({ delay: null });
    render(<CustomerFilters value={EMPTY_FILTERS} onChange={onChange} />);

    // Act
    await user.type(screen.getByLabelText('Search'), 's');

    // Assert
    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_FILTERS, q: 's' });
  });

  it('shows Clear filters only once a filter is active, and clears them all', async () => {
    // Arrange
    const onChange = vi.fn();
    const user = userEvent.setup({ delay: null });
    const { rerender } = render(<CustomerFilters value={EMPTY_FILTERS} onChange={onChange} />);
    expect(screen.queryByRole('button', { name: /clear filters/i })).not.toBeInTheDocument();

    // Act
    rerender(<CustomerFilters value={{ ...EMPTY_FILTERS, q: 'sofia' }} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: /clear filters/i }));

    // Assert
    expect(onChange).toHaveBeenCalledWith(EMPTY_FILTERS);
  });
});

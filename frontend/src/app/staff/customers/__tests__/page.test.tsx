import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CustomersPage from '@/app/staff/customers/page';
import { ApiError, customerApi } from '@/lib/api';
import type { Customer } from '@/types';

Element.prototype.scrollIntoView = vi.fn();

const toastFn = vi.fn();
const auth = vi.hoisted(() => ({ user: { role: 'manager' } as { role: string } | null }));
vi.mock('@/context/auth-context', () => ({ useAuth: () => ({ user: auth.user }) }));
vi.mock('@/components/ui/toast', () => ({ useToast: () => toastFn }));
vi.mock('@/components/layout/staff-layout', () => ({ StaffLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return { ...actual, customerApi: { ...actual.customerApi, list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() } };
});
vi.mock('@/components/customers/customer-table', async () => {
  const actual = await vi.importActual<typeof import('@/components/customers/customer-table')>('@/components/customers/customer-table');
  return {
    ...actual,
    CustomerTable: ({ customers, onSelect }: { customers: Customer[]; onSelect: (c: Customer) => void }) => (
      <div data-testid="customer-table">
        {customers.map((c) => (
          <button key={c.id} onClick={() => onSelect(c)}>
            {c.name}
          </button>
        ))}
      </div>
    ),
    CustomerFilters: () => <div data-testid="customer-filters" />,
  };
});
vi.mock('@/components/customers/customer-form', () => ({
  CustomerForm: ({ onSubmit, onCancel, initial }: { onSubmit: (d: Partial<Customer>) => void; onCancel: () => void; initial: Customer | null }) => (
    <div data-testid="customer-form">
      <span>{initial ? `editing ${initial.name}` : 'new customer'}</span>
      <button onClick={() => onSubmit({ name: 'New Name' })}>Save</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}));
vi.mock('@/components/customers/customer-detail', () => ({
  CustomerDetail: ({ customer, onEdit, onDelete }: { customer: Customer; onEdit: () => void; onDelete?: () => void }) => (
    <div data-testid="customer-detail">
      <span>{customer.name}</span>
      <button onClick={onEdit}>Edit customer</button>
      {onDelete ? <button onClick={onDelete}>Delete customer</button> : null}
    </div>
  ),
}));

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 'cus_1', userId: null, name: 'Casey Customer', email: 'casey@example.com', phone: '',
    type: 'walk-in', loyaltyPoints: 10, totalSpend: 50, preferences: { dietary: [], allergies: [] } as never,
    notes: '', ...overrides,
  } as Customer;
}

describe('CustomersPage', () => {
  beforeEach(() => {
    toastFn.mockClear();
    auth.user = { role: 'manager' };
    vi.mocked(customerApi.create).mockResolvedValue({ customer: makeCustomer({ id: 'cus_new' }) });
    vi.mocked(customerApi.update).mockResolvedValue({ customer: makeCustomer() });
    vi.mocked(customerApi.remove).mockResolvedValue({ deleted: true });
    vi.stubGlobal('confirm', vi.fn(() => true));
  });

  it('shows a loading spinner, then the loaded customer ledger', async () => {
    // Arrange
    vi.mocked(customerApi.list).mockResolvedValue({ customers: [makeCustomer()] });

    // Act
    render(<CustomersPage />);

    // Assert
    expect(screen.getByText('Loading customer ledger…')).toBeInTheDocument();
    expect(await screen.findByText('1 customer')).toBeInTheDocument();
  });

  it('shows an empty state with an add-customer action when nothing matches', async () => {
    // Arrange
    vi.mocked(customerApi.list).mockResolvedValue({ customers: [] });

    // Act
    render(<CustomersPage />);

    // Assert
    expect(await screen.findByText('No customers match')).toBeInTheDocument();
  });

  it('selects a customer and shows their detail panel', async () => {
    // Arrange
    vi.mocked(customerApi.list).mockResolvedValue({ customers: [makeCustomer({ name: 'Jordan Guest' })] });
    const user = userEvent.setup({ delay: null });
    render(<CustomersPage />);
    await screen.findByTestId('customer-table');

    // Act
    await user.click(screen.getByRole('button', { name: 'Jordan Guest' }));

    // Assert
    expect(screen.getByTestId('customer-detail')).toHaveTextContent('Jordan Guest');
  });

  it('adds a new customer and reloads the ledger', async () => {
    // Arrange
    vi.mocked(customerApi.list).mockResolvedValue({ customers: [] });
    const user = userEvent.setup({ delay: null });
    render(<CustomersPage />);
    await screen.findByText('No customers match');

    // Act
    await user.click(screen.getAllByRole('button', { name: '+ Add customer' })[0]);
    expect(screen.getByText('new customer')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save' }));

    // Assert
    await waitFor(() => expect(customerApi.create).toHaveBeenCalledWith({ name: 'New Name' }));
    expect(toastFn).toHaveBeenCalledWith('Customer added.', 'success');
  });

  it('edits the selected customer via the detail panel', async () => {
    // Arrange
    vi.mocked(customerApi.list).mockResolvedValue({ customers: [makeCustomer({ name: 'Jordan Guest' })] });
    const user = userEvent.setup({ delay: null });
    render(<CustomersPage />);
    await user.click(await screen.findByRole('button', { name: 'Jordan Guest' }));

    // Act
    await user.click(screen.getByRole('button', { name: 'Edit customer' }));

    // Assert
    expect(screen.getByText('editing Jordan Guest')).toBeInTheDocument();
  });

  it('deletes the selected customer after confirmation', async () => {
    // Arrange
    vi.mocked(customerApi.list).mockResolvedValue({ customers: [makeCustomer({ name: 'Jordan Guest' })] });
    const user = userEvent.setup({ delay: null });
    render(<CustomersPage />);
    await user.click(await screen.findByRole('button', { name: 'Jordan Guest' }));

    // Act
    await user.click(screen.getByRole('button', { name: 'Delete customer' }));

    // Assert
    await waitFor(() => expect(customerApi.remove).toHaveBeenCalledWith('cus_1'));
    expect(toastFn).toHaveBeenCalledWith('Customer deleted.', 'success');
  });

  it('does not offer Delete to a waiter, but still lets them edit', async () => {
    // Arrange
    auth.user = { role: 'waiter' };
    vi.mocked(customerApi.list).mockResolvedValue({ customers: [makeCustomer({ name: 'Jordan Guest' })] });
    const user = userEvent.setup({ delay: null });
    render(<CustomersPage />);

    // Act
    await user.click(await screen.findByRole('button', { name: 'Jordan Guest' }));

    // Assert
    expect(screen.getByRole('button', { name: 'Edit customer' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete customer' })).not.toBeInTheDocument();
  });

  it("shows the server's reason when a customer with order history can't be deleted", async () => {
    // Arrange
    const reason = "This customer has order history and can't be deleted.";
    vi.mocked(customerApi.list).mockResolvedValue({ customers: [makeCustomer({ name: 'Jordan Guest' })] });
    vi.mocked(customerApi.remove).mockRejectedValue(new ApiError(reason, 409, { error: reason }));
    const user = userEvent.setup({ delay: null });
    render(<CustomersPage />);
    await user.click(await screen.findByRole('button', { name: 'Jordan Guest' }));

    // Act
    await user.click(screen.getByRole('button', { name: 'Delete customer' }));

    // Assert
    await waitFor(() => expect(toastFn).toHaveBeenCalledWith(reason, 'error'));
    expect(screen.getByTestId('customer-detail')).toHaveTextContent('Jordan Guest');
  });
});

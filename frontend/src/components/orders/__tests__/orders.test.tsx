/**
 * Module-wise tests for src/components/orders (components).
 *
 * allergy-banner, labels, order-history-table, order-progress and
 * use-order-menu have their own files in this folder. This file covers the
 * remaining components: customer-lookup, edit-items-modal, kitchen-ticket,
 * new-order-modal, order-card, order-editor and ready-ticket.
 *
 * Every test follows Arrange-Act-Assert with each phase commented.
 */
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Customer, MenuCategory, MenuItem, Order, OrderItem, Table } from '@/types';
import { customerApi, menuApi, orderApi, tableApi } from '@/lib/api';
import { CustomerLookup } from '@/components/orders/customer-lookup';
import { EditItemsModal } from '@/components/orders/edit-items-modal';
import { KitchenTicket, isDelayed } from '@/components/orders/kitchen-ticket';
import { NewOrderModal } from '@/components/orders/new-order-modal';
import { OrderCard } from '@/components/orders/order-card';
import {
  OrderLineEditor,
  draftSubtotal,
  indexMenu,
  linesFromOrder,
  toOrderLines,
  unavailableLines,
  type DraftLine,
} from '@/components/orders/order-editor';
import { ReadyTicket } from '@/components/orders/ready-ticket';

const { toastMock } = vi.hoisted(() => ({ toastMock: vi.fn() }));

vi.mock('@/lib/api', () => ({
  customerApi: { list: vi.fn() },
  menuApi: { get: vi.fn(), items: vi.fn() },
  tableApi: { list: vi.fn() },
  orderApi: {
    create: vi.fn(),
    replaceItems: vi.fn(),
    setStatus: vi.fn(),
    setItemStatus: vi.fn(),
    assignTable: vi.fn(),
    kitchenAction: vi.fn(),
  },
}));
vi.mock('@/components/ui/toast', () => ({ useToast: () => toastMock }));

/* --------------------------------------------------------------- fixtures */

const NOW = new Date('2026-10-08T12:00:00.000Z').getTime();
const minutesAgo = (m: number) => new Date(NOW - m * 60000).toISOString();

function makeMenuItem(overrides: Partial<MenuItem> = {}): MenuItem {
  return {
    id: 'lemonade',
    name: 'Lemonade',
    categoryId: 'drinks',
    price: 3,
    description: 'Fresh lemons',
    dietaryTags: ['vegan'],
    allergens: [],
    modifiers: [],
    available: true,
    outOfStockReason: '',
    ...overrides,
  };
}

const pizza = makeMenuItem({
  id: 'pizza',
  name: 'Margherita',
  categoryId: 'mains',
  price: 10,
  description: 'Tomato and mozzarella',
  dietaryTags: ['vegetarian'],
  allergens: ['gluten', 'dairy'],
  modifiers: [
    {
      id: 'mod_size',
      name: 'Size',
      type: 'single',
      options: [
        { label: 'Regular', priceDelta: 0 },
        { label: 'Large', priceDelta: 4 },
      ],
    },
    { id: 'mod_extras', name: 'Extras', type: 'multi', options: [{ label: 'Mushrooms', priceDelta: 1.5 }] },
  ],
});
const satay = makeMenuItem({
  id: 'satay',
  name: 'Satay Skewers',
  categoryId: 'mains',
  price: 12,
  description: 'Peanut sauce',
  dietaryTags: [],
  allergens: ['peanuts'],
  available: false,
  outOfStockReason: 'Out of peanuts',
});
const lemonade = makeMenuItem();

function makeCategories(): MenuCategory[] {
  return [
    { id: 'mains', name: 'Mains', sort: 0, active: true, items: [pizza, satay] },
    { id: 'drinks', name: 'Drinks', sort: 1, active: true, items: [lemonade] },
  ];
}

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 'cust_1',
    name: 'Ann Lee',
    email: 'ann@example.com',
    phone: '555-0101',
    type: 'walk-in',
    loyaltyPoints: 0,
    totalSpend: 0,
    preferences: { allergies: [], dietary: [] },
    notes: '',
    createdAt: minutesAgo(1000),
    ...overrides,
  };
}

function makeTable(overrides: Partial<Table> = {}): Table {
  return {
    id: 'table_1',
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

function makeItem(overrides: Partial<OrderItem> = {}): OrderItem {
  return {
    id: 'oi_1',
    menuItemId: 'pizza',
    name: 'Margherita',
    qty: 2,
    basePrice: 10,
    modifiers: [{ group: 'Size', label: 'Large', priceDelta: 4 }],
    unitPrice: 14,
    status: 'queued',
    preparedBy: null,
    preparedByName: null,
    readyAt: null,
    servedAt: null,
    ...overrides,
  };
}

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'ord_1',
    number: 42,
    type: 'dine-in',
    fulfillment: 'dine-in',
    tableId: 'table_5',
    tableNumber: 5,
    customerId: null,
    customer: null,
    waiterId: 'u_w',
    waiterName: 'Wendy',
    createdBy: 'u_w',
    source: 'staff',
    status: 'placed',
    paymentStatus: 'unpaid',
    paymentMethod: null,
    priority: 'normal',
    kitchenRank: null,
    items: [makeItem()],
    rates: { taxRate: 0.1, serviceChargeRate: 0 },
    subtotal: 28,
    discount: 0,
    serviceCharge: 0,
    tax: 2.8,
    tip: 0,
    total: 30.8,
    pointsUsed: 0,
    pointsEarned: 0,
    notes: '',
    deliveryAddress: '',
    split: null,
    refund: null,
    createdAt: minutesAgo(20),
    confirmedAt: null,
    readyAt: null,
    servedAt: null,
    servedBy: null,
    servedByName: null,
    paidAt: null,
    closedAt: null,
    cancelledAt: null,
    updatedAt: minutesAgo(20),
    ...overrides,
  };
}

const peanutAllergic = {
  id: 'cust_1',
  name: 'Ann Lee',
  email: 'ann@example.com',
  phone: '555-0101',
  preferences: { allergies: ['peanuts'], dietary: ['vegetarian'] },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(menuApi.get).mockResolvedValue({ menu: makeCategories(), tags: [], allergens: [] });
  vi.mocked(tableApi.list).mockResolvedValue({
    tables: [
      makeTable({ id: 'table_9', number: 9, status: 'occupied' }),
      makeTable({ id: 'table_2', number: 2, seats: 2, zone: 'Patio' }),
    ],
    zones: ['Main', 'Patio'],
    statuses: ['free', 'occupied', 'reserved', 'cleaning'],
  });
});

/* -------------------------------------------------------- customer-lookup */

describe('CustomerLookup', () => {
  it('does not search the ledger until at least two characters are typed', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    render(<CustomerLookup value={null} onChange={vi.fn()} />);

    // Act
    await user.type(screen.getByRole('searchbox', { name: /find a customer/i }), 'a');
    await new Promise((r) => setTimeout(r, 300));

    // Assert
    expect(customerApi.list).not.toHaveBeenCalled();
  });

  it('debounces the search and picks a matching customer for the order', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    const onChange = vi.fn();
    const ann = makeCustomer({ preferences: { allergies: ['peanuts'], dietary: [] } });
    const bob = makeCustomer({ id: 'cust_2', name: 'Annabel Bo', email: '', phone: '555-0202' });
    vi.mocked(customerApi.list).mockResolvedValue({ customers: [ann, bob] } as Awaited<ReturnType<typeof customerApi.list>>);
    render(<CustomerLookup value={null} onChange={onChange} />);

    // Act
    await user.type(screen.getByRole('searchbox', { name: /find a customer/i }), 'ann');
    const annButton = await screen.findByRole('button', { name: /ann lee/i });
    await user.click(annButton);

    // Assert
    expect(customerApi.list).toHaveBeenCalledTimes(1);
    expect(customerApi.list).toHaveBeenCalledWith({ q: 'ann' });
    expect(within(annButton).getByText('Allergies')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /annabel bo/i })).toHaveTextContent('555-0202');
    expect(onChange).toHaveBeenCalledWith(ann);
  });

  it('says so when no customer matches the query', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    vi.mocked(customerApi.list).mockResolvedValue({ customers: [] } as unknown as Awaited<ReturnType<typeof customerApi.list>>);
    render(<CustomerLookup value={null} onChange={vi.fn()} />);

    // Act
    await user.type(screen.getByRole('searchbox', { name: /find a customer/i }), 'zed');

    // Assert
    expect(await screen.findByText(/no customers match “zed”/i)).toBeInTheDocument();
  });

  it('shows an error toast when the search fails', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    vi.mocked(customerApi.list).mockRejectedValue(new Error('Ledger offline'));
    render(<CustomerLookup value={null} onChange={vi.fn()} />);

    // Act
    await user.type(screen.getByRole('searchbox', { name: /find a customer/i }), 'ann');

    // Assert
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith('Ledger offline', 'error'));
  });

  it('shows the chosen guest with their allergies and lets staff change the guest', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    const onChange = vi.fn();
    const ann = makeCustomer({ preferences: { allergies: ['peanuts'], dietary: ['vegan'] } });
    render(<CustomerLookup value={ann} onChange={onChange} />);

    // Act
    await user.click(screen.getByRole('button', { name: 'Change' }));

    // Assert
    expect(screen.getByText('Ann Lee')).toBeInTheDocument();
    expect(screen.getByText('ann@example.com · 555-0101')).toBeInTheDocument();
    expect(screen.getByText(/allergy alert: peanuts/i)).toBeInTheDocument();
    expect(screen.getByText(/vegan/i)).toBeInTheDocument();
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('notes when the chosen guest has nothing on file', () => {
    // Arrange
    const guest = makeCustomer({ email: '', phone: '' });

    // Act
    render(<CustomerLookup value={guest} onChange={vi.fn()} />);

    // Assert
    expect(screen.getByText('No contact details')).toBeInTheDocument();
    expect(screen.getByText(/no allergies or dietary preferences on file/i)).toBeInTheDocument();
  });
});

/* ------------------------------------------------------- edit-items-modal */

describe('EditItemsModal', () => {
  it('keeps Save disabled until a line is changed, then replaces the items', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    const onSaved = vi.fn();
    const order = makeOrder();
    const updated = makeOrder({ items: [makeItem({ qty: 3 })], subtotal: 42 });
    vi.mocked(orderApi.replaceItems).mockResolvedValue({ order: updated });
    render(<EditItemsModal order={order} onClose={vi.fn()} onSaved={onSaved} />);
    const save = screen.getByRole('button', { name: 'Save changes' });
    await screen.findByRole('button', { name: 'Increase quantity of Margherita' });
    expect(save).toBeDisabled();

    // Act
    await user.click(screen.getByRole('button', { name: 'Increase quantity of Margherita' }));
    await user.click(save);

    // Assert
    expect(orderApi.replaceItems).toHaveBeenCalledWith('ord_1', [
      { menuItemId: 'pizza', qty: 3, modifiers: [{ group: 'Size', label: 'Large' }] },
    ]);
    expect(toastMock).toHaveBeenCalledWith('Order #42 updated — new subtotal $42.00.', 'success');
    expect(onSaved).toHaveBeenCalledWith(updated);
  });

  it('refuses to save an order with no items left', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    render(<EditItemsModal order={makeOrder()} onClose={vi.fn()} onSaved={vi.fn()} />);

    // Act
    await user.click(await screen.findByRole('button', { name: 'Remove Margherita' }));

    // Assert
    expect(screen.getByText(/an order needs at least one item/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  });

  it('blocks saving while a line is for a dish that became unavailable', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    const order = makeOrder({
      items: [makeItem(), makeItem({ id: 'oi_2', menuItemId: 'satay', name: 'Satay Skewers', qty: 1, modifiers: [], unitPrice: 12 })],
    });
    render(<EditItemsModal order={order} onClose={vi.fn()} onSaved={vi.fn()} />);

    // Act
    await user.click(await screen.findByRole('button', { name: 'Increase quantity of Margherita' }));

    // Assert
    expect(screen.getByText(/remove unavailable dishes before saving/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  });

  it('shows the server refusal when the order is no longer editable', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    const onSaved = vi.fn();
    vi.mocked(orderApi.replaceItems).mockRejectedValue(new Error('Only placed orders can be edited.'));
    render(<EditItemsModal order={makeOrder()} onClose={vi.fn()} onSaved={onSaved} />);

    // Act
    await user.click(await screen.findByRole('button', { name: 'Increase quantity of Margherita' }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    // Assert
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith('Only placed orders can be edited.', 'error'));
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('asks before discarding unsaved changes, and keeps editing when told to', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    const onClose = vi.fn();
    render(<EditItemsModal order={makeOrder()} onClose={onClose} onSaved={vi.fn()} />);
    await user.click(await screen.findByRole('button', { name: 'Increase quantity of Margherita' }));

    // Act
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    // Assert
    const dialog = screen.getByRole('dialog', { name: 'Discard changes?' });
    expect(dialog).toHaveTextContent("Your changes to order #42 haven't been saved.");
    expect(onClose).not.toHaveBeenCalled();

    // Act
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    // Assert
    expect(screen.queryByRole('dialog', { name: 'Discard changes?' })).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes after the discard is confirmed', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    const onClose = vi.fn();
    render(<EditItemsModal order={makeOrder()} onClose={onClose} onSaved={vi.fn()} />);
    await user.click(await screen.findByRole('button', { name: 'Increase quantity of Margherita' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    // Act
    await user.click(screen.getByRole('button', { name: 'Discard changes' }));

    // Assert
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes straight away when nothing was changed', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    const onClose = vi.fn();
    render(<EditItemsModal order={makeOrder()} onClose={onClose} onSaved={vi.fn()} />);
    await screen.findByRole('button', { name: 'Increase quantity of Margherita' });

    // Act
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    // Assert
    expect(screen.queryByRole('dialog', { name: 'Discard changes?' })).not.toBeInTheDocument();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows the placement and the guest allergies above the editor', async () => {
    // Arrange
    const order = makeOrder({ customer: peanutAllergic, customerId: 'cust_1' });

    // Act
    render(<EditItemsModal order={order} onClose={vi.fn()} onSaved={vi.fn()} />);

    // Assert
    expect(screen.getByRole('dialog', { name: 'Edit order #42' })).toBeInTheDocument();
    expect(screen.getByText(/table 5 · ann lee · items can be changed until the order is confirmed/i)).toBeInTheDocument();
    expect(screen.getByText(/allergy alert: peanuts/i)).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Remove Margherita' })).toBeInTheDocument();
  });
});

/* --------------------------------------------------------- kitchen-ticket */

describe('KitchenTicket', () => {
  function renderTicket(props: Partial<Parameters<typeof KitchenTicket>[0]> = {}) {
    const onChanged = vi.fn();
    render(
      <KitchenTicket
        order={makeOrder({ status: 'confirmed', confirmedAt: minutesAgo(12) })}
        position={1}
        delayMinutes={15}
        now={NOW}
        role="chef"
        canMoveUp
        canMoveDown
        menuById={indexMenu(makeCategories())}
        onChanged={onChanged}
        {...props}
      />,
    );
    return { onChanged };
  }

  it('isDelayed compares time since confirmation with the threshold', () => {
    // Arrange
    const fresh = makeOrder({ confirmedAt: minutesAgo(10), createdAt: minutesAgo(30) });
    const old = makeOrder({ confirmedAt: minutesAgo(16) });

    // Act / Assert
    expect(isDelayed(fresh, 15, NOW)).toBe(false);
    expect(isDelayed(old, 15, NOW)).toBe(true);
  });

  it('shows the items, modifiers, notes, placement, waiter and elapsed time', () => {
    // Arrange
    const order = makeOrder({ status: 'confirmed', confirmedAt: minutesAgo(12), notes: 'No basil' });

    // Act
    renderTicket({ order });

    // Assert
    const ticket = screen.getByRole('article', { name: 'Order #42, queue position 1' });
    expect(within(ticket).getByText('2×')).toBeInTheDocument();
    expect(within(ticket).getByText('Margherita')).toBeInTheDocument();
    expect(within(ticket).getByText('Size: Large')).toBeInTheDocument();
    expect(within(ticket).getByText('No basil')).toBeInTheDocument();
    expect(within(ticket).getByText('Table 5')).toBeInTheDocument();
    expect(within(ticket).getByText('Waiter: Wendy')).toBeInTheDocument();
    expect(within(ticket).getByText('12 min')).toBeInTheDocument();
    expect(within(ticket).queryByText('Delayed')).not.toBeInTheDocument();
  });

  it('flags a ticket waiting longer than the delay threshold', () => {
    // Arrange
    const order = makeOrder({ status: 'confirmed', confirmedAt: minutesAgo(75) });

    // Act
    renderTicket({ order, position: 3 });

    // Assert
    expect(screen.getByRole('article', { name: 'Order #42, queue position 3, delayed' })).toBeInTheDocument();
    expect(screen.getByText('Delayed')).toBeInTheDocument();
    expect(screen.getByText('1 h 15 min')).toBeInTheDocument();
  });

  it('flags dishes that clash with the guest\'s allergies', () => {
    // Arrange
    const order = makeOrder({
      status: 'confirmed',
      confirmedAt: minutesAgo(1),
      customer: peanutAllergic,
      items: [makeItem(), makeItem({ id: 'oi_2', menuItemId: 'satay', name: 'Satay Skewers', qty: 1, modifiers: [] })],
    });

    // Act
    renderTicket({ order });

    // Assert
    expect(screen.getByText(/allergy alert: peanuts/i)).toBeInTheDocument();
    expect(screen.getByText('Check: Satay Skewers')).toBeInTheDocument();
    expect(screen.getByText('Contains peanuts')).toBeInTheDocument();
    expect(screen.getAllByText(/^Contains /)).toHaveLength(1);
  });

  it('shows the rush flag and lets the kitchen take it back to normal', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    vi.mocked(orderApi.kitchenAction).mockResolvedValue({ order: makeOrder() } as Awaited<ReturnType<typeof orderApi.kitchenAction>>);
    const { onChanged } = renderTicket({
      order: makeOrder({ status: 'confirmed', confirmedAt: minutesAgo(2), priority: 'rush' }),
    });
    expect(screen.getByRole('article', { name: 'Order #42, queue position 1, rush' })).toBeInTheDocument();
    expect(screen.getByText('Rush')).toBeInTheDocument();

    // Act
    await user.click(screen.getByRole('button', { name: 'Rush on', pressed: true }));

    // Assert
    expect(orderApi.kitchenAction).toHaveBeenCalledWith('ord_1', 'normal');
    expect(toastMock).toHaveBeenCalledWith('Order #42 back to normal priority.', 'success');
    expect(onChanged).toHaveBeenCalled();
  });

  it('lets a chef start a queued dish and start the whole order', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    vi.mocked(orderApi.setItemStatus).mockResolvedValue({ order: makeOrder() });
    vi.mocked(orderApi.setStatus).mockResolvedValue({ order: makeOrder() });
    renderTicket();

    // Act
    await user.click(screen.getByRole('button', { name: 'Start' }));
    await user.click(screen.getByRole('button', { name: 'Start all' }));

    // Assert
    expect(orderApi.setItemStatus).toHaveBeenCalledWith('ord_1', 'oi_1', 'preparing');
    expect(toastMock).toHaveBeenCalledWith('Margherita started.', 'success');
    expect(orderApi.setStatus).toHaveBeenCalledWith('ord_1', 'preparing');
  });

  it('marks a dish in prep as ready', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    vi.mocked(orderApi.setItemStatus).mockResolvedValue({ order: makeOrder() });
    renderTicket({
      order: makeOrder({ status: 'preparing', confirmedAt: minutesAgo(5), items: [makeItem({ status: 'preparing', preparedByName: 'Chef Kim' })] }),
    });

    // Act
    await user.click(screen.getByRole('button', { name: 'Ready' }));

    // Assert
    expect(screen.getByText('Chef Kim')).toBeInTheDocument();
    expect(screen.getByText('In prep')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start all' })).not.toBeInTheDocument();
    expect(orderApi.setItemStatus).toHaveBeenCalledWith('ord_1', 'oi_1', 'ready');
  });

  it('disables queue moves the caller says are not possible', () => {
    // Arrange / Act
    renderTicket({ canMoveUp: false, canMoveDown: true });

    // Assert
    expect(screen.getByRole('button', { name: 'Move order #42 up the queue' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move order #42 down the queue' })).toBeEnabled();
  });

  it('gives a waiter a read-only ticket with no kitchen controls', () => {
    // Arrange / Act
    renderTicket({ role: 'waiter' });

    // Assert
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('labels takeaway tickets with their fulfillment', () => {
    // Arrange / Act
    renderTicket({
      order: makeOrder({ type: 'online', fulfillment: 'delivery', tableId: null, tableNumber: null, confirmedAt: minutesAgo(1) }),
    });

    // Assert
    expect(screen.getByText('Takeaway · Delivery')).toBeInTheDocument();
  });
});

/* -------------------------------------------------------- new-order-modal */

describe('NewOrderModal', () => {
  it('builds a dine-in order with a table, modifiers, quantities and notes and sends it to the kitchen', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    const onCreated = vi.fn();
    const created = makeOrder({ number: 77 });
    vi.mocked(orderApi.create).mockResolvedValue({ order: created });
    render(<NewOrderModal onClose={vi.fn()} onCreated={onCreated} />);
    await screen.findByRole('button', { name: /^Margherita/ });
    await screen.findByRole('option', { name: /table 9/i });

    // Act
    await user.selectOptions(screen.getByRole('combobox'), 'table_2');
    await user.click(screen.getByRole('button', { name: /^Margherita/ }));
    await user.click(screen.getByRole('radio', { name: /Large/ }));
    await user.click(screen.getByRole('checkbox', { name: /Mushrooms/ }));
    await user.click(screen.getByRole('button', { name: 'Increase quantity of Margherita' }));
    await user.click(screen.getByRole('button', { name: 'Add 2 · $31.00' }));
    await user.click(screen.getByRole('button', { name: /^Lemonade/ }));
    await user.type(screen.getByLabelText(/notes/i), '  Birthday  ');
    await user.click(screen.getByRole('button', { name: 'Send to kitchen' }));

    // Assert
    expect(orderApi.create).toHaveBeenCalledWith({
      type: 'dine-in',
      tableId: 'table_2',
      customerId: null,
      items: [
        {
          menuItemId: 'pizza',
          qty: 2,
          modifiers: [
            { group: 'Size', label: 'Large' },
            { group: 'Extras', label: 'Mushrooms' },
          ],
        },
        { menuItemId: 'lemonade', qty: 1, modifiers: [] },
      ],
      notes: 'Birthday',
      sendToKitchen: true,
    });
    expect(toastMock).toHaveBeenCalledWith('Order #77 sent to the kitchen.', 'success');
    expect(onCreated).toHaveBeenCalledWith(created);
  });

  it('holds a takeaway order as a pickup order without a table', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    vi.mocked(orderApi.create).mockResolvedValue({ order: makeOrder({ number: 8 }) });
    render(<NewOrderModal onClose={vi.fn()} onCreated={vi.fn()} />);

    // Act
    await user.click(screen.getByRole('radio', { name: /takeaway/i }));
    await user.click(await screen.findByRole('button', { name: /^Lemonade/ }));
    await user.click(screen.getByRole('button', { name: 'Hold as placed' }));

    // Assert
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    const payload = vi.mocked(orderApi.create).mock.calls[0][0];
    expect(payload).toEqual({
      type: 'online',
      fulfillment: 'pickup',
      customerId: null,
      items: [{ menuItemId: 'lemonade', qty: 1, modifiers: [] }],
      notes: undefined,
      sendToKitchen: false,
    });
    expect(payload).not.toHaveProperty('tableId');
    expect(toastMock).toHaveBeenCalledWith('Order #8 held as placed — confirm it to send it to the kitchen.', 'success');
  });

  it('confirms in a dialog before discarding an order with items', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    const onClose = vi.fn();
    render(<NewOrderModal onClose={onClose} onCreated={vi.fn()} />);
    await user.click(await screen.findByRole('button', { name: /^Lemonade/ }));

    // Act
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    // Assert
    expect(screen.getByRole('dialog', { name: 'Discard this order?' })).toHaveTextContent('1 item will be lost.');
    expect(onClose).not.toHaveBeenCalled();

    // Act
    await user.click(screen.getByRole('button', { name: 'Discard order' }));

    // Assert
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('cannot be submitted empty and never offers unavailable dishes', async () => {
    // Arrange / Act
    render(<NewOrderModal onClose={vi.fn()} onCreated={vi.fn()} />);

    // Assert
    expect(await screen.findByRole('button', { name: /^Satay Skewers/ })).toBeDisabled();
    expect(screen.getByText(/unavailable — out of peanuts/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send to kitchen' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Hold as placed' })).toBeDisabled();
  });

  it('attaches the looked-up guest and flags dishes clashing with their allergies', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    const guest = makeCustomer({ preferences: { allergies: ['gluten'], dietary: [] } });
    vi.mocked(customerApi.list).mockResolvedValue({ customers: [guest] } as Awaited<ReturnType<typeof customerApi.list>>);
    vi.mocked(orderApi.create).mockResolvedValue({ order: makeOrder() });
    render(<NewOrderModal onClose={vi.fn()} onCreated={vi.fn()} />);

    // Act
    await user.type(screen.getByRole('searchbox', { name: /find a customer/i }), 'ann');
    await user.click(await screen.findByRole('button', { name: /ann lee/i }));
    await user.click(screen.getByRole('button', { name: /^Lemonade/ }));
    await user.click(screen.getByRole('button', { name: 'Send to kitchen' }));

    // Assert
    expect(screen.getByRole('button', { name: /^Margherita/ })).toHaveTextContent('Guest allergy: Gluten');
    expect(vi.mocked(orderApi.create).mock.calls[0][0]).toMatchObject({ customerId: 'cust_1', tableId: null });
  });

  it('warns when the chosen table is already occupied', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    render(<NewOrderModal onClose={vi.fn()} onCreated={vi.fn()} />);
    await screen.findByRole('option', { name: /table 9/i });

    // Act
    await user.selectOptions(screen.getByRole('combobox'), 'table_9');

    // Assert
    const options = screen.getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['No table yet', 'Table 2 · 2 seats · Patio · Free', 'Table 9 · 4 seats · Main · Occupied']);
    expect(screen.getByText(/this table is occupied — the order will be added to it/i)).toBeInTheDocument();
  });

  it('keeps the modal open and reports the error when placing fails', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    const onCreated = vi.fn();
    vi.mocked(orderApi.create).mockRejectedValue(new Error('Kitchen is closed.'));
    render(<NewOrderModal onClose={vi.fn()} onCreated={onCreated} />);

    // Act
    await user.click(await screen.findByRole('button', { name: /^Lemonade/ }));
    await user.click(screen.getByRole('button', { name: 'Send to kitchen' }));

    // Assert
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith('Kitchen is closed.', 'error'));
    expect(onCreated).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Send to kitchen' })).toBeEnabled();
  });
});

/* ------------------------------------------------------------- order-card */

describe('OrderCard', () => {
  function renderCard(props: Partial<Parameters<typeof OrderCard>[0]> = {}) {
    const onChanged = vi.fn();
    const onEditItems = vi.fn();
    render(
      <OrderCard
        order={makeOrder()}
        role="waiter"
        tables={[makeTable({ id: 'table_3', number: 3 })]}
        menuById={indexMenu(makeCategories())}
        now={NOW}
        onChanged={onChanged}
        onEditItems={onEditItems}
        {...props}
      />,
    );
    return { onChanged, onEditItems };
  }

  it('summarises the order: number, table, waiter, status, payment, lines and total', () => {
    // Arrange
    const order = makeOrder({ customer: peanutAllergic, notes: 'Window seat' });

    // Act
    renderCard({ order });

    // Assert
    const card = screen.getByRole('article', { name: 'Order #42' });
    expect(within(card).getByText('#42')).toBeInTheDocument();
    expect(within(card).getByText('Table 5')).toBeInTheDocument();
    expect(within(card).getByText(/20 min ago/)).toBeInTheDocument();
    expect(within(card).getByText('Wendy')).toBeInTheDocument();
    expect(within(card).getByText('Unpaid')).toBeInTheDocument();
    expect(within(card).getByText('Margherita')).toBeInTheDocument();
    expect(within(card).getByText('Large (+$4.00)')).toBeInTheDocument();
    expect(within(card).getByText('$28.00')).toBeInTheDocument();
    expect(within(card).getByText('$30.80')).toBeInTheDocument();
    expect(within(card).getByText('Ann Lee')).toBeInTheDocument();
    expect(within(card).getByText(/allergy alert: peanuts/i)).toBeInTheDocument();
    expect(within(card).getByText('Window seat')).toBeInTheDocument();
  });

  it('offers Edit items and Confirm on a placed, unpaid order', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    const confirmed = makeOrder({ status: 'confirmed' });
    vi.mocked(orderApi.setStatus).mockResolvedValue({ order: confirmed });
    const order = makeOrder();
    const { onChanged, onEditItems } = renderCard({ order });

    // Act
    await user.click(screen.getByRole('button', { name: 'Edit items' }));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    // Assert
    expect(onEditItems).toHaveBeenCalledWith(order);
    expect(orderApi.setStatus).toHaveBeenCalledWith('ord_1', 'confirmed');
    expect(toastMock).toHaveBeenCalledWith('Order #42 confirmed and sent to the kitchen.', 'success');
    expect(onChanged).toHaveBeenCalledWith(confirmed);
  });

  it('no longer offers Edit items once the order is confirmed or prepaid', () => {
    // Arrange / Act
    renderCard({ order: makeOrder({ status: 'confirmed', items: [makeItem({ status: 'queued' })] }) });
    renderCard({ order: makeOrder({ id: 'ord_2', number: 43, paymentStatus: 'paid', paymentMethod: 'card' }) });

    // Assert
    expect(screen.queryByRole('button', { name: 'Edit items' })).not.toBeInTheDocument();
    const prepaid = screen.getByRole('article', { name: 'Order #43' });
    expect(within(prepaid).getByText('Paid · Card')).toBeInTheDocument();
    expect(within(prepaid).getByText(/prepaid online — ask a manager to cancel/i)).toBeInTheDocument();
  });

  it('serves a ready dish and marks a ready order as served', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    vi.mocked(orderApi.setItemStatus).mockResolvedValue({ order: makeOrder() });
    vi.mocked(orderApi.setStatus).mockResolvedValue({ order: makeOrder({ status: 'served' }) });
    renderCard({ order: makeOrder({ status: 'ready', items: [makeItem({ status: 'ready', readyAt: minutesAgo(3) })] }) });

    // Act
    await user.click(screen.getByRole('button', { name: 'Serve' }));
    await user.click(screen.getByRole('button', { name: 'Mark served' }));

    // Assert
    expect(screen.getByText('Ready for pickup · 3 min ago')).toBeInTheDocument();
    expect(orderApi.setItemStatus).toHaveBeenCalledWith('ord_1', 'oi_1', 'served');
    expect(toastMock).toHaveBeenCalledWith('2× Margherita served.', 'success');
    expect(orderApi.setStatus).toHaveBeenCalledWith('ord_1', 'served');
  });

  it('cancels only after a second confirmation and warns about the refund', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    vi.mocked(orderApi.setStatus).mockResolvedValue({ order: makeOrder({ status: 'cancelled' }) });
    renderCard({ order: makeOrder({ paymentStatus: 'paid', paymentMethod: 'card' }), role: 'manager' });

    // Act
    await user.click(screen.getByRole('button', { name: 'Cancel order' }));
    const prompt = screen.getByText(/cancel order #42\?/i);
    expect(orderApi.setStatus).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Yes, cancel' }));

    // Assert
    expect(prompt).toHaveTextContent('The payment will be refunded.');
    expect(orderApi.setStatus).toHaveBeenCalledWith('ord_1', 'cancelled');
  });

  it('offers a waiter Cancel on an unpaid order but not on a paid one', () => {
    // Arrange
    const unpaid = makeOrder();
    const paid = makeOrder({ id: 'ord_2', number: 43, paymentStatus: 'paid', paymentMethod: 'card' });

    // Act
    renderCard({ order: unpaid, role: 'waiter' });
    renderCard({ order: paid, role: 'waiter' });

    // Assert
    const unpaidCard = screen.getByRole('article', { name: 'Order #42' });
    const paidCard = screen.getByRole('article', { name: 'Order #43' });
    expect(within(unpaidCard).getByRole('button', { name: 'Cancel order' })).toBeInTheDocument();
    expect(within(paidCard).queryByRole('button', { name: 'Cancel order' })).not.toBeInTheDocument();
  });

  it('offers a manager or admin Cancel on a paid order, with the prepaid hint', () => {
    // Arrange
    const paid = makeOrder({ paymentStatus: 'paid', paymentMethod: 'card' });

    // Act
    renderCard({ order: paid, role: 'manager' });
    renderCard({ order: { ...paid, id: 'ord_2', number: 43 }, role: 'admin' });

    // Assert
    for (const name of ['Order #42', 'Order #43']) {
      const card = screen.getByRole('article', { name });
      expect(within(card).getByRole('button', { name: 'Cancel order' })).toBeInTheDocument();
      expect(within(card).getByText(/prepaid online — cancel to change/i)).toBeInTheDocument();
    }
  });

  it('lets floor staff assign a table to a dine-in order without one', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    vi.mocked(orderApi.assignTable).mockResolvedValue({ order: makeOrder({ tableNumber: 3 }) });
    renderCard({ order: makeOrder({ tableId: null, tableNumber: null, status: 'confirmed' }) });

    // Act
    await user.selectOptions(screen.getByRole('combobox', { name: 'Assign a table to order #42' }), 'table_3');

    // Assert
    expect(orderApi.assignTable).toHaveBeenCalledWith('ord_1', 'table_3');
    expect(toastMock).toHaveBeenCalledWith('Order #42 assigned to Table 3.', 'success');
  });

  it('shows pickup/delivery details and the payment prompt for a served online order', () => {
    // Arrange
    const order = makeOrder({
      type: 'online',
      fulfillment: 'delivery',
      tableId: null,
      tableNumber: null,
      deliveryAddress: '1 High St',
      status: 'served',
      source: 'customer',
    });

    // Act
    renderCard({ order });

    // Assert
    expect(screen.getByText('Delivery')).toBeInTheDocument();
    expect(screen.getByText('Self-order')).toBeInTheDocument();
    expect(screen.getByText('1 High St')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Take payment' })).toHaveAttribute('href', '/staff/billing?bill=ord_1');
  });

  it('gives a chef no floor actions', () => {
    // Arrange / Act
    renderCard({ role: 'chef', order: makeOrder({ tableId: null, tableNumber: null }) });

    // Assert
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByText('No table')).toBeInTheDocument();
  });
});

/* ----------------------------------------------------------- order-editor */

describe('order-editor helpers', () => {
  it('prefills lines from an order and turns them back into the API payload', () => {
    // Arrange
    const order = makeOrder();

    // Act
    const lines = linesFromOrder(order);

    // Assert
    expect(lines[0]).toMatchObject({ menuItemId: 'pizza', qty: 2, fallback: { name: 'Margherita', unitPrice: 14 } });
    expect(toOrderLines(lines)).toEqual([{ menuItemId: 'pizza', qty: 2, modifiers: [{ group: 'Size', label: 'Large' }] }]);
  });

  it('prices lines from the menu, falling back to the stored price, and finds unavailable ones', () => {
    // Arrange
    const byId = indexMenu(makeCategories());
    const lines: DraftLine[] = [
      { key: 'a', menuItemId: 'pizza', qty: 2, modifiers: [{ group: 'Size', label: 'Large' }] },
      { key: 'b', menuItemId: 'gone', qty: 1, modifiers: [], fallback: { name: 'Old dish', unitPrice: 5.5 } },
      { key: 'c', menuItemId: 'satay', qty: 1, modifiers: [] },
    ];

    // Act
    const subtotal = draftSubtotal(lines, byId);
    const blocked = unavailableLines(lines, byId);

    // Assert
    expect(subtotal).toBe(45.5);
    expect(blocked.map((l) => l.key)).toEqual(['c']);
  });
});

describe('OrderLineEditor', () => {
  function Harness({ initial = [], allergies }: { initial?: DraftLine[]; allergies?: string[] }) {
    const [lines, setLines] = useState<DraftLine[]>(initial);
    return (
      <>
        <OrderLineEditor categories={makeCategories()} lines={lines} onChange={setLines} allergies={allergies} />
        <output data-testid="payload">{JSON.stringify(toOrderLines(lines))}</output>
      </>
    );
  }
  const payload = () => JSON.parse(screen.getByTestId('payload').textContent ?? '[]');

  it('adds a plain dish and merges repeat picks into one line', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    render(<Harness />);
    expect(screen.getByText(/nothing added yet/i)).toBeInTheDocument();

    // Act
    await user.click(screen.getByRole('button', { name: /^Lemonade/ }));
    await user.click(screen.getByRole('button', { name: /^Lemonade/ }));

    // Assert
    expect(payload()).toEqual([{ menuItemId: 'lemonade', qty: 2, modifiers: [] }]);
    expect(screen.getByText('2 in order')).toBeInTheDocument();
    expect(screen.getByText('(2 items)')).toBeInTheDocument();
    expect(screen.getByText('$6.00', { selector: '.text-base' })).toBeInTheDocument();
  });

  it('refuses a 51st different dish (server limit) with a friendly message', async () => {
    // Arrange — 50 distinct pizza lines, one per extras combination
    const user = userEvent.setup({ delay: null });
    const full: DraftLine[] = Array.from({ length: 50 }, (_, i) => ({
      key: `l${i}`,
      menuItemId: 'pizza',
      qty: 1,
      modifiers: [{ group: 'Size', label: `Variant ${i}` }],
    }));
    render(<Harness initial={full} />);

    // Act
    await user.click(screen.getByRole('button', { name: /^Lemonade/ }));

    // Assert
    expect(payload()).toHaveLength(50);
    expect(screen.getByText(/An order can have at most 50 different dishes./)).toHaveAttribute('role', 'status');
    expect(payload().some((l: { menuItemId: string }) => l.menuItemId === 'lemonade')).toBe(false);
  });

  it('opens the modifier picker with defaults pre-selected for a dish with options', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    render(<Harness />);

    // Act
    await user.click(screen.getByRole('button', { name: /^Margherita/ }));
    await user.click(screen.getByRole('button', { name: 'Add 1 · $10.00' }));

    // Assert
    expect(payload()).toEqual([{ menuItemId: 'pizza', qty: 1, modifiers: [{ group: 'Size', label: 'Regular' }] }]);
    expect(screen.queryByRole('radio', { name: /Large/ })).not.toBeInTheDocument();
  });

  it('edits quantity and options of an existing line and removes it', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    render(<Harness initial={[{ key: 'l1', menuItemId: 'pizza', qty: 1, modifiers: [{ group: 'Size', label: 'Regular' }] }]} />);

    // Act
    await user.click(screen.getByRole('button', { name: 'Increase quantity of Margherita' }));
    await user.click(screen.getByRole('button', { name: 'Options' }));
    await user.click(screen.getByRole('radio', { name: /Large/ }));
    const afterEdit = payload();
    await user.click(screen.getByRole('button', { name: 'Remove Margherita' }));

    // Assert
    expect(afterEdit).toEqual([{ menuItemId: 'pizza', qty: 2, modifiers: [{ group: 'Size', label: 'Large' }] }]);
    expect(payload()).toEqual([]);
  });

  it('filters the menu by search text and by category', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    render(<Harness />);

    // Act
    await user.type(screen.getByRole('searchbox', { name: 'Search the menu' }), 'mozzarella');
    const afterSearch = screen.queryByRole('button', { name: /^Lemonade/ });
    await user.clear(screen.getByRole('searchbox', { name: 'Search the menu' }));
    await user.click(screen.getByRole('button', { name: 'Drinks' }));

    // Assert
    expect(afterSearch).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Drinks' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /^Lemonade/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Margherita/ })).not.toBeInTheDocument();
  });

  it('flags guest allergies, unavailable lines and dishes no longer on the menu', () => {
    // Arrange
    const initial: DraftLine[] = [
      { key: 'l1', menuItemId: 'satay', qty: 1, modifiers: [] },
      { key: 'l2', menuItemId: 'gone', qty: 1, modifiers: [], fallback: { name: 'Old Soup', unitPrice: 4 } },
    ];

    // Act
    render(<Harness initial={initial} allergies={['dairy']} />);

    // Assert
    expect(screen.getByRole('button', { name: /^Margherita/ })).toHaveTextContent('Guest allergy: Dairy');
    expect(screen.getByText(/unavailable — out of peanuts\. remove it to continue/i)).toBeInTheDocument();
    expect(screen.getByText('Old Soup')).toBeInTheDocument();
    expect(screen.getByText('Not on the current menu')).toBeInTheDocument();
  });
});

/* ----------------------------------------------------------- ready-ticket */

describe('ReadyTicket', () => {
  function renderReady(props: Partial<Parameters<typeof ReadyTicket>[0]> = {}) {
    const onChanged = vi.fn();
    render(
      <ul>
        <ReadyTicket
          order={makeOrder({ status: 'ready', readyAt: minutesAgo(7), items: [makeItem(), makeItem({ id: 'oi_2', name: 'Lemonade', qty: 1 })] })}
          now={NOW}
          role="waiter"
          onChanged={onChanged}
          {...props}
        />
      </ul>,
    );
    return { onChanged };
  }

  it('shows where the ready order goes, its dishes, wait time and who was notified', () => {
    // Arrange / Act
    renderReady();

    // Assert
    expect(screen.getByText('#42')).toBeInTheDocument();
    expect(screen.getByText('Table 5')).toBeInTheDocument();
    expect(screen.getByText('7 min waiting')).toBeInTheDocument();
    expect(screen.getByText('2× Margherita, 1× Lemonade')).toBeInTheDocument();
    expect(screen.getByText(/floor staff notified · wendy/i)).toBeInTheDocument();
  });

  it('says "Just now" for an order that has only just become ready', () => {
    // Arrange / Act
    renderReady({ order: makeOrder({ status: 'ready', readyAt: minutesAgo(0.5), type: 'online', fulfillment: 'pickup', tableNumber: null }) });

    // Assert
    expect(screen.getByText('Just now')).toBeInTheDocument();
    expect(screen.getByText('Pickup')).toBeInTheDocument();
  });

  it('lets floor staff mark the order served', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    vi.mocked(orderApi.setStatus).mockResolvedValue({ order: makeOrder({ status: 'served' }) });
    const { onChanged } = renderReady();

    // Act
    await user.click(screen.getByRole('button', { name: 'Mark served' }));

    // Assert
    expect(orderApi.setStatus).toHaveBeenCalledWith('ord_1', 'served');
    expect(toastMock).toHaveBeenCalledWith('Order #42 served.', 'success');
    expect(onChanged).toHaveBeenCalled();
  });

  it('reports a failure to mark served', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    vi.mocked(orderApi.setStatus).mockRejectedValue(new Error('Already served.'));
    const { onChanged } = renderReady();

    // Act
    await user.click(screen.getByRole('button', { name: 'Mark served' }));

    // Assert
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith('Already served.', 'error'));
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('hides the serve action from a chef', () => {
    // Arrange / Act
    renderReady({ role: 'chef' });

    // Assert
    expect(screen.queryByRole('button', { name: 'Mark served' })).not.toBeInTheDocument();
  });
});

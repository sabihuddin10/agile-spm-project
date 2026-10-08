/**
 * Tests for src/components/account: active-order-card, my-orders and my-reservations.
 * (order-history and profile-editor have their own test files in this folder.)
 *
 * Every test follows Arrange-Act-Assert, with each phase commented.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ActiveOrderCard } from '@/components/account/active-order-card';
import { MyOrders } from '@/components/account/my-orders';
import { MyReservations } from '@/components/account/my-reservations';
import { ORDER_PLACED_EVENT } from '@/components/storefront/checkout-estimate';
import { billingApi, orderApi, reservationApi } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { Invoice, Order, OrderItem, Reservation } from '@/types';

const { toast } = vi.hoisted(() => ({ toast: vi.fn() }));

vi.mock('@/lib/api', () => ({
  orderApi: { mine: vi.fn(), setStatus: vi.fn() },
  billingApi: { receipt: vi.fn() },
  reservationApi: { mine: vi.fn(), cancel: vi.fn() },
}));
vi.mock('@/components/ui/toast', () => ({ useToast: () => toast }));

const NOW = new Date('2026-10-08T18:30:00.000Z').getTime();

function makeItem(overrides: Partial<OrderItem> = {}): OrderItem {
  return {
    id: 'it_1',
    menuItemId: 'm_1',
    name: 'Flame Burger',
    qty: 1,
    basePrice: 14,
    modifiers: [],
    unitPrice: 14,
    status: 'pending',
    preparedBy: null,
    readyAt: null,
    servedAt: null,
    ...overrides,
  };
}

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'ord_1',
    number: 101,
    type: 'online',
    fulfillment: 'pickup',
    tableId: null,
    tableNumber: null,
    customerId: 'cus_me',
    customer: null,
    waiterId: null,
    waiterName: null,
    createdBy: 'u_me',
    source: 'customer',
    status: 'placed',
    paymentStatus: 'unpaid',
    paymentMethod: 'cash',
    priority: 'normal',
    kitchenRank: null,
    items: [makeItem()],
    rates: { taxRate: 0.08, serviceChargeRate: 0 },
    subtotal: 14,
    discount: 0,
    serviceCharge: 0,
    tax: 1.12,
    tip: 0,
    total: 15.12,
    pointsUsed: 0,
    pointsEarned: 0,
    notes: '',
    deliveryAddress: '',
    split: null,
    refund: null,
    createdAt: '2026-10-08T18:18:00.000Z',
    confirmedAt: null,
    readyAt: null,
    servedAt: null,
    servedBy: null,
    servedByName: null,
    paidAt: null,
    closedAt: null,
    cancelledAt: null,
    updatedAt: '2026-10-08T18:18:00.000Z',
    ...overrides,
  };
}

function makeReservation(overrides: Partial<Reservation> = {}): Reservation {
  return {
    id: 'res_1',
    customerName: 'Me',
    email: 'me@example.com',
    phone: '',
    partySize: 2,
    date: '2026-10-10',
    time: '19:00',
    tableId: null,
    tableNumber: null,
    status: 'requested',
    specialRequests: '',
    customerId: 'cus_me',
    late: false,
    hasAccount: true,
    createdAt: '2026-10-01T10:00:00.000Z',
    confirmedAt: null,
    seatedAt: null,
    cancelledAt: null,
    notifiedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  toast.mockReset();
  vi.mocked(orderApi.mine).mockReset();
  vi.mocked(orderApi.setStatus).mockReset();
  vi.mocked(billingApi.receipt).mockReset();
  vi.mocked(reservationApi.mine).mockReset();
  vi.mocked(reservationApi.cancel).mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

/* ------------------------------------------------------- active-order-card */

describe('ActiveOrderCard', () => {
  it('shows the in-progress order: number, step, progress, items, delivery, payment and total', () => {
    // Arrange
    const order = makeOrder({
      status: 'preparing',
      fulfillment: 'delivery',
      deliveryAddress: '12 Elm St',
      notes: 'No onions',
      items: [
        makeItem({ id: 'a', qty: 2, name: 'Flame Burger', status: 'preparing', modifiers: [{ group: 'Size', label: 'Large', priceDelta: 4 }] }),
        makeItem({ id: 'b', name: 'Soda', status: 'ready' }),
      ],
    });

    // Act
    render(<ActiveOrderCard order={order} now={NOW} onCancel={vi.fn()} />);

    // Assert
    expect(screen.getByRole('heading', { name: 'Order #101' })).toBeInTheDocument();
    expect(screen.getByText(/12 min ago/)).toBeInTheDocument();
    const progress = screen.getByRole('progressbar', { name: 'Order #101 progress' });
    expect(progress).toHaveAttribute('aria-valuenow', '3');
    expect(progress).toHaveAttribute('aria-valuetext', 'Preparing');
    expect(screen.getByText('The kitchen is cooking your order.')).toBeInTheDocument();
    expect(screen.getByText('2 × Flame Burger')).toBeInTheDocument();
    expect(screen.getByText('Large (+$4.00)')).toBeInTheDocument();
    expect(screen.getByText('In prep')).toBeInTheDocument();
    expect(screen.getByText('1 × Soda').closest('li')).toHaveTextContent('Ready');
    expect(screen.getByText('Delivery to 12 Elm St')).toBeInTheDocument();
    expect(screen.getByText('Unpaid — cash on delivery')).toBeInTheDocument();
    expect(screen.getByText('Note: “No onions”')).toBeInTheDocument();
    expect(screen.getByText('$15.12')).toBeInTheDocument();
    expect(screen.getByText('Can no longer be cancelled online')).toBeInTheDocument();
  });

  it('words the served step by fulfilment and thanks a paid guest', () => {
    // Arrange
    const order = makeOrder({ status: 'served', fulfillment: 'pickup', paymentStatus: 'paid', paymentMethod: 'card' });

    // Act
    render(<ActiveOrderCard order={order} now={NOW} onCancel={vi.fn()} />);

    // Assert
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', 'Collected');
    expect(screen.getByText('Enjoy your meal!')).toBeInTheDocument();
    expect(screen.getByText('Paid by card')).toBeInTheDocument();
  });

  it('lets the guest cancel while the order is still placed', async () => {
    // Arrange
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const order = makeOrder({ status: 'placed' });
    const { rerender } = render(<ActiveOrderCard order={order} now={NOW} onCancel={onCancel} />);

    // Act
    await user.click(screen.getByRole('button', { name: 'Cancel order' }));

    // Assert
    expect(screen.getByText('Waiting for the team to confirm your order.')).toBeInTheDocument();
    expect(onCancel).toHaveBeenCalledWith(order);

    // Act
    rerender(<ActiveOrderCard order={order} now={NOW} onCancel={onCancel} cancelling />);

    // Assert
    expect(screen.getByRole('button', { name: 'Cancelling…' })).toBeDisabled();
  });

  it('offers a receipt only once the order is paid', async () => {
    // Arrange
    const user = userEvent.setup();
    const onReceipt = vi.fn();
    const unpaid = makeOrder({ paymentStatus: 'unpaid' });
    const paid = makeOrder({ paymentStatus: 'paid', paymentMethod: 'card' });
    const { rerender } = render(<ActiveOrderCard order={unpaid} now={NOW} onCancel={vi.fn()} onReceipt={onReceipt} />);
    expect(screen.queryByRole('button', { name: 'Receipt for order 101' })).not.toBeInTheDocument();
    rerender(<ActiveOrderCard order={paid} now={NOW} onCancel={vi.fn()} onReceipt={onReceipt} />);

    // Act
    await user.click(screen.getByRole('button', { name: 'Receipt for order 101' }));

    // Assert
    expect(onReceipt).toHaveBeenCalledWith(paid);
  });
});

/* --------------------------------------------------------------- my-orders */

describe('MyOrders', () => {
  it("loads the signed-in customer's orders, splitting in-progress from past", async () => {
    // Arrange
    vi.mocked(orderApi.mine).mockResolvedValue({
      orders: [
        makeOrder({ id: 'a', number: 201, status: 'preparing' }),
        makeOrder({ id: 'b', number: 202, status: 'closed', paymentStatus: 'paid', createdAt: '2026-10-01T12:00:00.000Z' }),
        makeOrder({ id: 'c', number: 203, status: 'cancelled', createdAt: '2026-09-20T12:00:00.000Z' }),
      ],
    });

    // Act
    render(<MyOrders />);

    // Assert
    expect(screen.getByText('Loading your orders…')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Order #201' })).toBeInTheDocument();
    expect(orderApi.mine).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/In progress\s*\(1\)/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Order #202' })).not.toBeInTheDocument();
    const pastList = screen.getByText('#202', { exact: false }).closest('ul') as HTMLElement;
    expect(within(pastList).getAllByRole('listitem')).toHaveLength(2);
    expect(pastList).toHaveTextContent('#203');
  });

  it('shows empty states when the customer has no orders', async () => {
    // Arrange
    vi.mocked(orderApi.mine).mockResolvedValue({ orders: [] });

    // Act
    render(<MyOrders />);

    // Assert
    expect(await screen.findByText(/Nothing cooking right now/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start an order' })).toHaveAttribute('href', '/menu');
    expect(screen.getByText('No past orders yet')).toBeInTheDocument();
  });

  it('shows a load error with a working retry', async () => {
    // Arrange
    const user = userEvent.setup();
    vi.mocked(orderApi.mine).mockRejectedValueOnce(new Error('Network down')).mockResolvedValueOnce({ orders: [] });
    render(<MyOrders />);
    expect(await screen.findByText(/Network down/)).toBeInTheDocument();

    // Act
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    // Assert
    expect(await screen.findByText(/Nothing cooking right now/)).toBeInTheDocument();
  });

  it('cancels a placed order after confirming, then reloads', async () => {
    // Arrange
    const user = userEvent.setup();
    const placed = makeOrder({ id: 'a', number: 301, status: 'placed', paymentStatus: 'paid', paymentMethod: 'card' });
    vi.mocked(orderApi.mine)
      .mockResolvedValueOnce({ orders: [placed] })
      .mockResolvedValueOnce({ orders: [{ ...placed, status: 'cancelled', paymentStatus: 'refunded' }] });
    vi.mocked(orderApi.setStatus).mockResolvedValue({ order: { ...placed, status: 'cancelled' } } as never);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<MyOrders />);

    // Act
    await user.click(await screen.findByRole('button', { name: 'Cancel order' }));

    // Assert
    expect(confirm).toHaveBeenCalledWith('Cancel order #301? Your card payment will be refunded.');
    expect(orderApi.setStatus).toHaveBeenCalledWith('a', 'cancelled', 'Cancelled by customer');
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Order #301 cancelled. A refund is on its way.', 'success'));
    expect(await screen.findByText(/Nothing cooking right now/)).toBeInTheDocument();
  });

  it('keeps the order when the guest declines the confirm', async () => {
    // Arrange
    const user = userEvent.setup();
    vi.mocked(orderApi.mine).mockResolvedValue({ orders: [makeOrder({ status: 'placed' })] });
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<MyOrders />);

    // Act
    await user.click(await screen.findByRole('button', { name: 'Cancel order' }));

    // Assert
    expect(orderApi.setStatus).not.toHaveBeenCalled();
  });

  it('opens the receipt of a past paid order', async () => {
    // Arrange
    const user = userEvent.setup();
    const past = makeOrder({ id: 'p', number: 401, status: 'closed', paymentStatus: 'paid', paymentMethod: 'card' });
    vi.mocked(orderApi.mine).mockResolvedValue({ orders: [past] });
    const invoice = {
      id: 'p',
      number: 401,
      receiptNumber: 'R-0401',
      fulfillment: 'pickup',
      tableNumber: null,
      customerName: 'Me',
      waiterName: null,
      paymentStatus: 'paid',
      paymentMethod: 'card',
      lines: [],
      subtotal: 14,
      discount: 0,
      pointsUsed: 0,
      pointsEarned: 0,
      serviceCharge: 0,
      serviceChargeRate: 0,
      tax: 1.12,
      taxRate: 0.08,
      tip: 0,
      total: 15.12,
      refund: null,
      refundedAmount: 0,
      netTotal: 15.12,
      split: null,
      createdAt: past.createdAt,
      paidAt: past.createdAt,
      restaurant: { name: 'Plate & Flame', address: '1 Main St' },
    } as unknown as Invoice;
    vi.mocked(billingApi.receipt).mockResolvedValue({ receipt: invoice });
    render(<MyOrders />);

    // Act
    await user.click(await screen.findByRole('button', { name: 'Receipt for order 401' }));

    // Assert
    expect(billingApi.receipt).toHaveBeenCalledWith('p');
    expect(await screen.findByRole('dialog', { name: 'Receipt R-0401' })).toBeInTheDocument();
  });

  it('tells the page to refresh loyalty when an order changes after placing a new one', async () => {
    // Arrange
    const onActivity = vi.fn();
    vi.mocked(orderApi.mine)
      .mockResolvedValueOnce({ orders: [makeOrder({ status: 'placed' })] })
      .mockResolvedValueOnce({ orders: [makeOrder({ status: 'confirmed' })] });
    render(<MyOrders onActivity={onActivity} />);
    await screen.findByRole('heading', { name: 'Order #101' });

    // Act
    act(() => {
      window.dispatchEvent(new Event(ORDER_PLACED_EVENT));
    });

    // Assert
    await waitFor(() => expect(onActivity).toHaveBeenCalledTimes(1));
    expect(orderApi.mine).toHaveBeenCalledTimes(2);
  });
});

/* --------------------------------------------------------- my-reservations */

describe('MyReservations', () => {
  it("lists the signed-in customer's bookings with date, party, table, requests and status", async () => {
    // Arrange
    vi.mocked(reservationApi.mine).mockResolvedValue({
      reservations: [
        makeReservation({ id: 'r1', status: 'requested', specialRequests: 'High chair' }),
        makeReservation({ id: 'r2', date: '2026-10-12', time: '20:30', partySize: 1, status: 'confirmed', tableNumber: 4 }),
        makeReservation({ id: 'r3', date: '2026-09-01', time: '18:00', partySize: 3, status: 'seated', tableNumber: 2 }),
      ],
    });

    // Act
    render(<MyReservations />);

    // Assert
    expect(screen.getByText('Loading bookings…')).toBeInTheDocument();
    const items = await screen.findAllByRole('listitem');
    expect(reservationApi.mine).toHaveBeenCalledTimes(1);
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent(`${formatDate('2026-10-10')} at 19:00`);
    expect(items[0]).toHaveTextContent('2 guests · Table assigned on confirmation');
    expect(items[0]).toHaveTextContent('“High chair”');
    expect(within(items[0]).getByText('Requested')).toBeInTheDocument();
    expect(items[1]).toHaveTextContent(`${formatDate('2026-10-12')} at 20:30`);
    expect(items[1]).toHaveTextContent('1 guest · Table 4');
    expect(within(items[1]).getByText('Confirmed')).toBeInTheDocument();
    expect(within(items[2]).getByText('Seated')).toBeInTheDocument();
  });

  it('offers cancel only for requested or confirmed bookings', async () => {
    // Arrange
    vi.mocked(reservationApi.mine).mockResolvedValue({
      reservations: [
        makeReservation({ id: 'r1', status: 'confirmed' }),
        makeReservation({ id: 'r2', status: 'seated' }),
        makeReservation({ id: 'r3', status: 'cancelled' }),
        makeReservation({ id: 'r4', status: 'no_show' }),
      ],
    });

    // Act
    render(<MyReservations />);

    // Assert
    const items = await screen.findAllByRole('listitem');
    expect(within(items[0]).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    for (const item of items.slice(1)) expect(within(item).queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows an empty state with a link to book', async () => {
    // Arrange
    vi.mocked(reservationApi.mine).mockResolvedValue({ reservations: [] });

    // Act
    render(<MyReservations />);

    // Assert
    expect(await screen.findByText(/No bookings yet\./)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Reserve a table' })).toHaveAttribute('href', '/book');
  });

  it('shows a load error with a working retry', async () => {
    // Arrange
    const user = userEvent.setup();
    vi.mocked(reservationApi.mine).mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce({ reservations: [] });
    render(<MyReservations />);
    expect(await screen.findByText(/Offline/)).toBeInTheDocument();

    // Act
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    // Assert
    expect(await screen.findByText(/No bookings yet\./)).toBeInTheDocument();
  });

  it('cancels a booking after confirming and shows its new status', async () => {
    // Arrange
    const user = userEvent.setup();
    const booking = makeReservation({ id: 'r1', status: 'confirmed', partySize: 4 });
    vi.mocked(reservationApi.mine).mockResolvedValue({ reservations: [booking] });
    vi.mocked(reservationApi.cancel).mockResolvedValue({ reservation: { ...booking, status: 'cancelled' } });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<MyReservations />);

    // Act
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));

    // Assert
    expect(confirm).toHaveBeenCalledWith(`Cancel your booking for 4 on ${formatDate('2026-10-10')} at 19:00?`);
    expect(reservationApi.cancel).toHaveBeenCalledWith('r1');
    expect(await screen.findByText('Cancelled')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    expect(toast).toHaveBeenCalledWith('Booking cancelled.', 'success');
  });

  it('keeps the booking when the guest declines the confirm', async () => {
    // Arrange
    const user = userEvent.setup();
    vi.mocked(reservationApi.mine).mockResolvedValue({ reservations: [makeReservation()] });
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<MyReservations />);

    // Act
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));

    // Assert
    expect(reservationApi.cancel).not.toHaveBeenCalled();
  });
});

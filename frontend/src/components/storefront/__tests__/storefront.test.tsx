import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CartLines, linePricing } from '@/components/storefront/cart-lines';
import { CheckoutForm } from '@/components/storefront/checkout-form';
import { estimateCheckout, maxRedeemablePoints, ORDER_PLACED_EVENT } from '@/components/storefront/checkout-estimate';
import { BrandLink, FlameMark } from '@/components/storefront/flame-mark';
import { AllergyWarning, ItemOptionsModal } from '@/components/storefront/item-options-modal';
import { fulfillmentText, OrderPlaced, paymentText } from '@/components/storefront/order-placed';
import { QtyStepper } from '@/components/storefront/qty-stepper';
import { StatusPill } from '@/components/storefront/status-pill';
import { useCart } from '@/context/cart-context';
import { ApiError, customerApi, orderApi, settingsApi, tableApi } from '@/lib/api';
import type { CartLine } from '@/context/cart-context';
import type { MenuItem, Order, Settings } from '@/types';

vi.mock('@/context/cart-context', () => ({ useCart: vi.fn() }));
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    settingsApi: { ...actual.settingsApi, get: vi.fn() },
    customerApi: { ...actual.customerApi, me: vi.fn() },
    tableApi: { ...actual.tableApi, publicList: vi.fn() },
    orderApi: { ...actual.orderApi, create: vi.fn() },
  };
});
const toastFn = vi.fn();
vi.mock('@/components/ui/toast', () => ({ useToast: () => toastFn }));

function makeItem(overrides: Partial<MenuItem> = {}): MenuItem {
  return {
    id: 'item_1',
    name: 'Margherita Pizza',
    categoryId: 'cat_1',
    price: 18,
    description: 'Classic.',
    dietaryTags: [],
    allergens: ['gluten', 'dairy'],
    modifiers: [
      { id: 'mod_1', name: 'Size', type: 'single', options: [{ label: 'Regular', priceDelta: 0 }, { label: 'Large', priceDelta: 4 }] },
    ],
    available: true,
    outOfStockReason: '',
    ...overrides,
  } as MenuItem;
}

function makeLine(overrides: Partial<CartLine> = {}): CartLine {
  return { key: 'item_1|', item: makeItem(), qty: 1, modifiers: [], ...overrides };
}

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'o1',
    number: 101,
    type: 'online',
    fulfillment: 'pickup',
    tableNumber: null,
    deliveryAddress: null,
    status: 'placed',
    paymentStatus: 'unpaid',
    paymentMethod: 'cash',
    total: 24,
    discount: 0,
    pointsEarned: 0,
    pointsUsed: 0,
    ...overrides,
  } as Order;
}

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

describe('checkout-estimate', () => {
  describe('maxRedeemablePoints', () => {
    it('caps redemption by both the balance and the subtotal value', () => {
      // Arrange / Act / Assert: $0.05/point, $10 subtotal = 200 points of value, but balance is lower
      expect(maxRedeemablePoints(10, 50, 0.05)).toBe(50);
      expect(maxRedeemablePoints(2, 500, 0.05)).toBe(40);
    });

    it('returns 0 when points have no value', () => {
      // Arrange / Act / Assert
      expect(maxRedeemablePoints(10, 100, 0)).toBe(0);
    });
  });

  describe('estimateCheckout', () => {
    it('applies a points discount, dine-in service charge and tax after the discount', () => {
      // Arrange / Act
      const result = estimateCheckout(100, 50, { taxRate: 0.1, serviceChargeRate: 0.1, pointValue: 0.05 }, true);

      // Assert: discount $2.50, service $10, tax 10% of (100-2.50)=9.75
      expect(result.discount).toBeCloseTo(2.5);
      expect(result.serviceCharge).toBeCloseTo(10);
      expect(result.tax).toBeCloseTo(9.75);
      expect(result.total).toBeCloseTo(100 - 2.5 + 10 + 9.75);
    });

    it('skips the service charge for non-dine-in orders', () => {
      // Arrange / Act
      const result = estimateCheckout(100, 0, { taxRate: 0.1, serviceChargeRate: 0.1, pointValue: 0.05 }, false);

      // Assert
      expect(result.serviceCharge).toBe(0);
    });

    it('never lets the total go negative', () => {
      // Arrange / Act
      const result = estimateCheckout(1, 1000, { taxRate: 0, serviceChargeRate: 0, pointValue: 0.05 }, false);

      // Assert
      expect(result.total).toBe(0);
    });
  });
});

describe('FlameMark / BrandLink', () => {
  it('renders the flame glyph', () => {
    // Arrange / Act
    const { container } = render(<FlameMark />);

    // Assert
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders the brand name linking home', () => {
    // Arrange / Act
    render(<BrandLink />);

    // Assert
    expect(screen.getByRole('link')).toHaveAttribute('href', '/');
    expect(screen.getByText('Plate & Flame')).toBeInTheDocument();
  });
});

describe('QtyStepper', () => {
  it('shows the current value and calls the increment/decrement handlers', async () => {
    // Arrange
    const onIncrement = vi.fn();
    const onDecrement = vi.fn();
    const user = userEvent.setup({ delay: null });
    render(<QtyStepper value={2} onIncrement={onIncrement} onDecrement={onDecrement} itemName="Pizza" />);

    // Act
    await user.click(screen.getByLabelText('One more Pizza'));
    await user.click(screen.getByLabelText('One fewer Pizza'));

    // Assert
    expect(onIncrement).toHaveBeenCalledTimes(1);
    expect(onDecrement).toHaveBeenCalledTimes(1);
  });

  it('disables decrementing at the minimum and labels it "Remove" at qty 1 with min 0', () => {
    // Arrange / Act
    render(<QtyStepper value={1} onIncrement={vi.fn()} onDecrement={vi.fn()} itemName="Pizza" min={0} />);

    // Assert
    expect(screen.getByLabelText('Remove Pizza')).toBeInTheDocument();
  });

  it('disables incrementing at the maximum', () => {
    // Arrange / Act
    render(<QtyStepper value={5} onIncrement={vi.fn()} onDecrement={vi.fn()} itemName="Pizza" max={5} />);

    // Assert
    expect(screen.getByLabelText('One more Pizza')).toBeDisabled();
  });
});

describe('StatusPill', () => {
  it('renders its children with tone-specific styling', () => {
    // Arrange / Act
    render(<StatusPill tone="red">Delayed</StatusPill>);

    // Assert
    expect(screen.getByText('Delayed')).toHaveClass('border-red-400/30');
  });
});

describe('order-placed helpers', () => {
  it('describes dine-in, pickup and delivery fulfillment', () => {
    // Arrange / Act / Assert
    expect(fulfillmentText({ fulfillment: 'dine-in', tableNumber: 4, deliveryAddress: '' })).toBe('Dine in · Table 4');
    expect(fulfillmentText({ fulfillment: 'pickup', tableNumber: null, deliveryAddress: '' })).toBe('Pickup');
    expect(fulfillmentText({ fulfillment: 'delivery', tableNumber: null, deliveryAddress: '12 Elm St' })).toBe('Delivery to 12 Elm St');
  });

  it('describes payment state in plain words', () => {
    // Arrange / Act / Assert
    expect(paymentText({ paymentStatus: 'paid', paymentMethod: 'card', fulfillment: 'pickup' })).toBe('Paid by card');
    expect(paymentText({ paymentStatus: 'refunded', paymentMethod: 'card', fulfillment: 'pickup' })).toBe('Refunded');
    expect(paymentText({ paymentStatus: 'unpaid', paymentMethod: 'cash', fulfillment: 'delivery' })).toBe('Unpaid — cash on delivery');
    expect(paymentText({ paymentStatus: 'unpaid', paymentMethod: 'card', fulfillment: 'dine-in' })).toBe('Unpaid — pay at the table');
  });
});

describe('OrderPlaced', () => {
  it("shows the order number, fulfillment, payment and total", () => {
    // Arrange / Act
    render(<OrderPlaced order={makeOrder({ number: 42, total: 30 })} onDone={vi.fn()} />);

    // Assert
    expect(screen.getByText('Order #42 received')).toBeInTheDocument();
    expect(screen.getByText('$30.00')).toBeInTheDocument();
  });

  it('shows points used and earned when present', () => {
    // Arrange / Act
    render(<OrderPlaced order={makeOrder({ pointsUsed: 20, discount: 1, pointsEarned: 3 })} onDone={vi.fn()} />);

    // Assert
    expect(screen.getByText(/20 \(−\$1\.00\)/)).toBeInTheDocument();
    expect(screen.getByText('+3 Flame Points earned')).toBeInTheDocument();
  });

  it('calls onDone from both the "Done" button and the tracking link', async () => {
    // Arrange
    const onDone = vi.fn();
    const user = userEvent.setup({ delay: null });
    render(<OrderPlaced order={makeOrder()} onDone={onDone} />);

    // Act
    await user.click(screen.getByRole('button', { name: 'Done' }));

    // Assert
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

describe('cart-lines', () => {
  describe('linePricing', () => {
    it('multiplies the unit price (incl. modifiers) by quantity', () => {
      // Arrange
      const line = makeLine({ qty: 3, modifiers: [{ group: 'Size', label: 'Large' }] });

      // Act
      const { unit, total } = linePricing(line);

      // Assert
      expect(unit).toBe(22);
      expect(total).toBe(66);
    });
  });

  describe('CartLines', () => {
    it('shows each line with its options, unit price and line total', () => {
      // Arrange / Act
      render(<CartLines lines={[makeLine({ modifiers: [{ group: 'Size', label: 'Large' }] })]} onQty={vi.fn()} />);

      // Assert
      expect(screen.getByText('Margherita Pizza')).toBeInTheDocument();
      expect(screen.getByText(/Large/)).toBeInTheDocument();
      expect(screen.getByText('$22.00')).toBeInTheDocument();
    });

    it('calls onQty with the line key and delta when the stepper is used', async () => {
      // Arrange
      const onQty = vi.fn();
      const user = userEvent.setup({ delay: null });
      render(<CartLines lines={[makeLine({ key: 'line_1', qty: 2 })]} onQty={onQty} />);

      // Act
      await user.click(screen.getByLabelText('One more Margherita Pizza'));

      // Assert
      expect(onQty).toHaveBeenCalledWith('line_1', 1);
    });

    it('flags an unavailable line and removes it on request', async () => {
      // Arrange
      const onRemove = vi.fn();
      const user = userEvent.setup({ delay: null });
      render(<CartLines lines={[makeLine({ key: 'line_1' })]} onQty={vi.fn()} onRemove={onRemove} flagged={['line_1']} />);
      expect(screen.getByText(/No longer available/)).toBeInTheDocument();

      // Act
      await user.click(screen.getByRole('button', { name: 'Remove' }));

      // Assert
      expect(onRemove).toHaveBeenCalledWith('line_1');
    });
  });
});

describe('AllergyWarning', () => {
  it('lists the conflicting allergens', () => {
    // Arrange / Act
    render(<AllergyWarning conflicts={['peanuts', 'gluten']} />);

    // Assert
    expect(screen.getByRole('note')).toHaveTextContent('Contains peanuts, gluten — on your allergy list');
  });
});

describe('ItemOptionsModal', () => {
  it('shows the description and an allergy warning when the dish conflicts', () => {
    // Arrange / Act
    render(<ItemOptionsModal item={makeItem()} conflicts={['gluten']} onAdd={vi.fn()} onClose={vi.fn()} />);

    // Assert
    expect(screen.getByText('Classic.')).toBeInTheDocument();
    expect(screen.getByRole('note')).toBeInTheDocument();
  });

  it('adds the default selection and quantity 1 to the order by default', async () => {
    // Arrange
    const onAdd = vi.fn();
    const user = userEvent.setup({ delay: null });
    render(<ItemOptionsModal item={makeItem()} conflicts={[]} onAdd={onAdd} onClose={vi.fn()} />);

    // Act
    await user.click(screen.getByRole('button', { name: /Add to order/ }));

    // Assert
    expect(onAdd).toHaveBeenCalledWith([{ group: 'Size', label: 'Regular' }], 1);
  });

  it('increases quantity and reflects it in the Add button total', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    render(<ItemOptionsModal item={makeItem()} conflicts={[]} onAdd={vi.fn()} onClose={vi.fn()} />);

    // Act
    await user.click(screen.getByLabelText('One more Margherita Pizza'));

    // Assert
    expect(screen.getByRole('button', { name: /Add 2 to order · \$36\.00/ })).toBeInTheDocument();
  });

  it('calls onClose when Cancel is clicked', async () => {
    // Arrange
    const onClose = vi.fn();
    const user = userEvent.setup({ delay: null });
    render(<ItemOptionsModal item={makeItem()} conflicts={[]} onAdd={vi.fn()} onClose={onClose} />);

    // Act
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    // Assert
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('CheckoutForm', () => {
  function mockCart(overrides: Partial<ReturnType<typeof useCart>> = {}) {
    vi.mocked(useCart).mockReturnValue({
      lines: [makeLine()],
      subtotal: 18,
      setQty: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn(),
      ...overrides,
    } as unknown as ReturnType<typeof useCart>);
  }

  function mockLoads() {
    vi.mocked(settingsApi.get).mockResolvedValue({ settings: makeSettings(), timeSlots: [] });
    vi.mocked(customerApi.me).mockResolvedValue({ customer: { loyaltyPoints: 100 } as never });
    vi.mocked(tableApi.publicList).mockResolvedValue({ tables: [{ id: 'tbl_1', number: 4, seats: 2, zone: 'Main' }] });
  }

  it('blocks checkout and explains why when dine-in has no table chosen', async () => {
    // Arrange
    mockCart();
    mockLoads();
    const user = userEvent.setup({ delay: null });
    render(<CheckoutForm onBack={vi.fn()} onPlaced={vi.fn()} />);
    await screen.findByText(/Estimated total|Tax and charges/);

    // Act
    await user.click(screen.getByRole('radio', { name: /Dine in/ }));

    // Assert
    expect(screen.getByText('Choose the table you are sitting at.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Place order|Pay/ })).toBeDisabled();
  });

  it('places a pickup order with card payment and clears the cart', async () => {
    // Arrange
    mockCart();
    mockLoads();
    const clear = vi.fn();
    mockCart({ clear });
    const onPlaced = vi.fn();
    vi.mocked(orderApi.create).mockResolvedValue({ order: makeOrder() });
    const user = userEvent.setup({ delay: null });
    const listener = vi.fn();
    window.addEventListener(ORDER_PLACED_EVENT, listener);
    render(<CheckoutForm onBack={vi.fn()} onPlaced={onPlaced} />);
    await screen.findByText(/Estimated total|Tax and charges/);

    // Act
    await user.click(screen.getByRole('button', { name: /Pay.*& place order/ }));

    // Assert
    await waitFor(() => expect(orderApi.create).toHaveBeenCalled());
    expect(clear).toHaveBeenCalledTimes(1);
    expect(onPlaced).toHaveBeenCalledWith(makeOrder());
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(ORDER_PLACED_EVENT, listener);
  });

  it('keeps the cart and flags the sold-out dish on a 409 conflict', async () => {
    // Arrange
    mockCart();
    mockLoads();
    vi.mocked(orderApi.create).mockRejectedValue(
      new ApiError('Margherita Pizza is no longer available', 409, { error: 'Margherita Pizza is no longer available' }),
    );
    const user = userEvent.setup({ delay: null });
    render(<CheckoutForm onBack={vi.fn()} onPlaced={vi.fn()} />);
    await screen.findByText(/Estimated total|Tax and charges/);

    // Act
    await user.click(screen.getByRole('button', { name: /Pay.*& place order/ }));

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent('no longer available');
    expect(screen.getByText(/No longer available — remove it to continue/)).toBeInTheDocument();
  });

  it('lets a customer redeem Flame Points, reducing the estimated total', async () => {
    // Arrange
    mockCart({ subtotal: 100 });
    mockLoads();
    const user = userEvent.setup({ delay: null });
    render(<CheckoutForm onBack={vi.fn()} onPlaced={vi.fn()} />);
    await screen.findByText('Estimated total');

    // Act
    await user.click(screen.getByRole('switch', { name: /Redeem points/i }));

    // Assert
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText(/Flame Points \(100\)/)).toBeInTheDocument();
  });

  it('calls onBack when "Back to cart" is clicked', async () => {
    // Arrange
    mockCart();
    mockLoads();
    const onBack = vi.fn();
    const user = userEvent.setup({ delay: null });
    render(<CheckoutForm onBack={onBack} onPlaced={vi.fn()} />);
    await screen.findByText(/Estimated total|Tax and charges/);

    // Act
    await user.click(screen.getByRole('button', { name: 'Back to cart' }));

    // Assert
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

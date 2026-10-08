/**
 * Module-wise tests for src/components/inventory (components).
 *
 * Real tests for this module go here, in __tests__/, mirroring the
 * app/ and components/ directory structure. Follow the Arrange-Act-Assert
 * (AAA) pattern used in src/lib/__tests__/menu.test.ts,
 * src/components/menu/__tests__/menu-item-card.test.tsx and
 * src/components/account/__tests__/profile-editor.test.tsx — Arrange the
 * data/props, Act (render / interact), then Assert the outcome, with each
 * phase commented.
 *
 * helpers, low-stock-banner, recipe-editor and stock-adjust have their own
 * test files in this folder; this file covers ingredient-form, movements,
 * purchase-orders, recipes-panel, reorder-form and stock-table.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IngredientForm } from '@/components/inventory/ingredient-form';
import { StockMovements } from '@/components/inventory/movements';
import { PurchaseOrders } from '@/components/inventory/purchase-orders';
import { RecipesPanel } from '@/components/inventory/recipes-panel';
import { ReorderForm } from '@/components/inventory/reorder-form';
import { StockTable } from '@/components/inventory/stock-table';
import { inventoryApi, settingsApi } from '@/lib/api';
import { useAuth } from '@/context/auth-context';
import type { InventoryItem, MenuItem, PurchaseOrder, ReorderLine, StockMovement } from '@/types';

const toastFn = vi.fn();

vi.mock('@/lib/api', () => ({
  inventoryApi: { reorder: vi.fn(), createPurchaseOrder: vi.fn(), receivePurchaseOrder: vi.fn() },
  settingsApi: { get: vi.fn() },
}));
// A stable toast function: reorder-form's loader depends on it, so a new fn per render would loop.
vi.mock('@/components/ui/toast', () => ({ useToast: () => toastFn }));
vi.mock('@/context/auth-context', () => ({ useAuth: vi.fn() }));

function makeItem(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: 'inv_1',
    name: 'Flour',
    category: 'Dry Goods',
    unit: 'kg',
    stock: 10,
    reorderLevel: 5,
    costPerUnit: 2,
    supplier: 'Mill Co',
    lowStock: false,
    health: 'ok',
    usedBy: [],
    ...overrides,
  };
}

function makeMovement(overrides: Partial<StockMovement> = {}): StockMovement {
  return {
    id: 'mv_1',
    inventoryId: 'inv_1',
    name: 'Flour',
    unit: 'kg',
    delta: 5,
    stockAfter: 15,
    reason: 'restock',
    orderId: null,
    orderNumber: null,
    userId: 'u_1',
    at: '2026-10-01T12:00:00.000Z',
    ...overrides,
  };
}

function makePo(overrides: Partial<PurchaseOrder> = {}): PurchaseOrder {
  return {
    id: 'po_1',
    number: 'PO-0001',
    lines: [
      { inventoryId: 'inv_1', name: 'Flour', unit: 'kg', supplier: 'Mill Co', qty: 10, costPerUnit: 2, cost: 20 },
      { inventoryId: 'inv_2', name: 'Eggs', unit: 'dozen', supplier: 'Farm Fresh', qty: 3, costPerUnit: 4, cost: 12 },
    ],
    total: 32,
    notes: 'Deliver before Friday',
    status: 'sent',
    createdAt: '2026-10-01T09:00:00.000Z',
    createdBy: 'u_1',
    receivedAt: null,
    ...overrides,
  };
}

function makeDish(overrides: Partial<MenuItem> = {}): MenuItem {
  return {
    id: 'item_1',
    name: 'Margherita',
    categoryId: 'cat_1',
    category: 'Pizza',
    price: 10,
    description: '',
    dietaryTags: [],
    allergens: [],
    modifiers: [],
    recipe: [{ inventoryId: 'inv_1', qty: 0.5, name: 'Flour', unit: 'kg' }],
    available: true,
    outOfStockReason: '',
    ...overrides,
  };
}

function makeReorderLine(overrides: Partial<ReorderLine> = {}): ReorderLine {
  return {
    inventoryId: 'inv_1',
    name: 'Flour',
    unit: 'kg',
    supplier: 'Mill Co',
    stock: 2,
    reorderLevel: 5,
    suggestedQty: 8,
    costPerUnit: 2,
    ...overrides,
  } as ReorderLine;
}

beforeEach(() => {
  toastFn.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('IngredientForm', () => {
  const baseProps = {
    units: ['g', 'kg', 'units'],
    categories: ['Produce', 'Dry Goods'],
    suppliers: ['Mill Co'],
  };

  it('requires a name before submitting', async () => {
    // Arrange
    const onSubmit = vi.fn();
    const user = userEvent.setup({ delay: null });
    render(<IngredientForm {...baseProps} onSubmit={onSubmit} onCancel={vi.fn()} />);

    // Act — whitespace passes the browser's `required` check but not the form's own
    await user.type(screen.getByLabelText('Name *'), '   ');
    await user.type(screen.getByLabelText('Category *'), 'Produce');
    await user.click(screen.getByRole('button', { name: 'Add ingredient' }));

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent('Ingredient name is required.');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('requires a category before submitting', async () => {
    // Arrange
    const onSubmit = vi.fn();
    const user = userEvent.setup({ delay: null });
    render(<IngredientForm {...baseProps} onSubmit={onSubmit} onCancel={vi.fn()} />);

    // Act
    await user.type(screen.getByLabelText('Name *'), 'Basil');
    await user.type(screen.getByLabelText('Category *'), '  ');
    await user.click(screen.getByRole('button', { name: 'Add ingredient' }));

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent('Category is required.');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rejects a negative reorder level', async () => {
    // Arrange
    const onSubmit = vi.fn();
    const user = userEvent.setup({ delay: null });
    render(<IngredientForm {...baseProps} onSubmit={onSubmit} onCancel={vi.fn()} />);
    await user.type(screen.getByLabelText('Name *'), 'Basil');
    await user.type(screen.getByLabelText('Category *'), 'Produce');
    await user.type(screen.getByLabelText('Reorder level'), '-1');

    // Act — fireEvent.submit bypasses the input's own min=0 constraint to reach the form's check
    fireEvent.submit(screen.getByRole('button', { name: 'Add ingredient' }).closest('form')!);

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent('Reorder level must be zero or more.');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits a new ingredient with trimmed text, defaults to kg and blank numbers as zero', async () => {
    // Arrange
    const onSubmit = vi.fn();
    const user = userEvent.setup({ delay: null });
    render(<IngredientForm {...baseProps} onSubmit={onSubmit} onCancel={vi.fn()} />);

    // Act
    await user.type(screen.getByLabelText('Name *'), '  Basil ');
    await user.type(screen.getByLabelText('Category *'), 'Produce');
    await user.type(screen.getByLabelText('Opening stock'), '3');
    await user.type(screen.getByLabelText('Reorder level'), '1.5');
    await user.click(screen.getByRole('button', { name: 'Add ingredient' }));

    // Assert
    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Basil',
      category: 'Produce',
      unit: 'kg',
      stock: 3,
      reorderLevel: 1.5,
      costPerUnit: 0,
      supplier: '',
    });
  });

  it('on edit, omits stock when unchanged and flags a changed count', async () => {
    // Arrange
    const onSubmit = vi.fn();
    const user = userEvent.setup({ delay: null });
    const initial = makeItem({ stock: 10 });
    render(<IngredientForm {...baseProps} initial={initial} onSubmit={onSubmit} onCancel={vi.fn()} />);

    // Act — save without touching stock
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    // Assert
    expect(onSubmit).toHaveBeenLastCalledWith(expect.not.objectContaining({ stock: expect.anything() }));

    // Act — change the count
    const stock = screen.getByLabelText('Stock on hand (count)');
    await user.clear(stock);
    await user.type(stock, '7');

    // Assert — hint explains it is logged as a stock count
    expect(screen.getByText(/recorded as a stock count \(10 → 7 kg\)/i)).toBeInTheDocument();

    // Act
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    // Assert
    expect(onSubmit).toHaveBeenLastCalledWith(expect.objectContaining({ stock: 7 }));
  });

  it('cancels without submitting', async () => {
    // Arrange
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    const user = userEvent.setup({ delay: null });
    render(<IngredientForm {...baseProps} onSubmit={onSubmit} onCancel={onCancel} />);

    // Act
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    // Assert
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('StockMovements', () => {
  it('lists each movement with its signed change, reason label and stock after', () => {
    // Arrange
    const movements = [
      makeMovement({ id: 'mv_1', reason: 'sale', orderNumber: 42, delta: -0.15, stockAfter: 9.85, orderId: 'ord_1' }),
      makeMovement({ id: 'mv_2', reason: 'restock', delta: 5, stockAfter: 15 }),
      makeMovement({ id: 'mv_3', reason: 'wastage', delta: -1, stockAfter: 14 }),
    ];

    // Act
    render(<StockMovements movements={movements} inventory={[makeItem()]} inventoryId="" onFilterChange={vi.fn()} />);

    // Assert
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByText('Sale #42')).toBeInTheDocument();
    expect(within(rows[0]).getByText('−0.15 kg')).toBeInTheDocument();
    expect(within(rows[0]).getByText('9.85 kg')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Restock')).toBeInTheDocument();
    expect(within(rows[1]).getByText('+5 kg')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Wastage')).toBeInTheDocument();
    expect(screen.getByText(/showing the latest 3 movements · 1 from order sales/i)).toBeInTheDocument();
  });

  it('filters by ingredient through the select', async () => {
    // Arrange
    const onFilterChange = vi.fn();
    const user = userEvent.setup({ delay: null });
    const inventory = [makeItem({ id: 'inv_1', name: 'Flour' }), makeItem({ id: 'inv_2', name: 'Basil' })];
    render(<StockMovements movements={[makeMovement()]} inventory={inventory} inventoryId="" onFilterChange={onFilterChange} />);

    // Act
    await user.selectOptions(screen.getByLabelText('Filter movements by ingredient'), 'Basil');

    // Assert
    expect(onFilterChange).toHaveBeenCalledWith('inv_2');
  });

  it('shows an empty state when there are no movements', () => {
    // Arrange / Act
    render(<StockMovements movements={[]} inventory={[]} inventoryId="" onFilterChange={vi.fn()} />);

    // Assert
    expect(screen.getByText(/no stock movements yet/i)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

describe('PurchaseOrders', () => {
  it('lists purchase orders with status, lines, suppliers and total', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    const orders = [
      makePo(),
      makePo({ id: 'po_2', number: 'PO-0002', status: 'received', receivedAt: '2026-10-02T09:00:00.000Z', total: 5 }),
    ];
    render(<PurchaseOrders orders={orders} onReceived={vi.fn()} />);

    // Assert — header counts and per-order summary
    expect(screen.getByText('2 total · 1 awaiting delivery')).toBeInTheDocument();
    expect(screen.getByText('Sent · awaiting delivery')).toBeInTheDocument();
    expect(screen.getByText('Received')).toBeInTheDocument();
    expect(screen.getAllByText('2 lines · Mill Co, Farm Fresh')).toHaveLength(2);
    expect(screen.getByText('$32.00')).toBeInTheDocument();
    // Only the open order can be received
    expect(screen.getAllByRole('button', { name: 'Mark received' })).toHaveLength(1);

    // Act — expand the first order's lines
    await user.click(screen.getAllByRole('button', { name: 'View lines' })[0]);

    // Assert
    expect(screen.getByText('$20.00')).toBeInTheDocument();
    expect(screen.getByText('Notes: Deliver before Friday')).toBeInTheDocument();
  });

  it('receives a sent order after confirming', async () => {
    // Arrange
    const onReceived = vi.fn();
    const received = makePo({ status: 'received', receivedAt: '2026-10-03T10:00:00.000Z' });
    vi.mocked(inventoryApi.receivePurchaseOrder).mockResolvedValue({ purchaseOrder: received });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup({ delay: null });
    render(<PurchaseOrders orders={[makePo()]} onReceived={onReceived} />);

    // Act
    await user.click(screen.getByRole('button', { name: 'Mark received' }));

    // Assert
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('Mark PO-0001 as received?'));
    expect(inventoryApi.receivePurchaseOrder).toHaveBeenCalledWith('po_1');
    await waitFor(() => expect(onReceived).toHaveBeenCalledWith(received));
    expect(toastFn).toHaveBeenCalledWith('PO-0001 received — stock updated for 2 ingredients.', 'success');
  });

  it('does nothing when the confirm is dismissed', async () => {
    // Arrange
    vi.mocked(inventoryApi.receivePurchaseOrder).mockClear();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const onReceived = vi.fn();
    const user = userEvent.setup({ delay: null });
    render(<PurchaseOrders orders={[makePo()]} onReceived={onReceived} />);

    // Act
    await user.click(screen.getByRole('button', { name: 'Mark received' }));

    // Assert
    expect(inventoryApi.receivePurchaseOrder).not.toHaveBeenCalled();
    expect(onReceived).not.toHaveBeenCalled();
  });

  it('shows an empty state when there are no orders', () => {
    // Arrange / Act
    render(<PurchaseOrders orders={[]} onReceived={vi.fn()} />);

    // Assert
    expect(screen.getByText(/no purchase orders yet/i)).toBeInTheDocument();
  });
});

describe('RecipesPanel', () => {
  const inventory = [makeItem({ id: 'inv_1', name: 'Flour', costPerUnit: 2, health: 'low' })];

  it('lists each dish with its ingredients and food cost per portion', () => {
    // Arrange
    const items = [makeDish(), makeDish({ id: 'item_2', name: 'Garden Salad', category: 'Salads', recipe: [] })];

    // Act
    render(<RecipesPanel items={items} inventory={inventory} canEdit={false} onEdit={vi.fn()} />);

    // Assert
    const pizza = screen.getByText('Margherita').closest('article')!;
    expect(within(pizza).getByText('0.5 kg')).toBeInTheDocument();
    expect(within(pizza).getByText('low')).toBeInTheDocument();
    // 0.5 kg × $2.00 = $1.00, 10% of the $10.00 price
    expect(within(pizza).getByText('$1.00')).toBeInTheDocument();
    expect(within(pizza).getByText(/10%/)).toBeInTheDocument();
    const salad = screen.getByText('Garden Salad').closest('article')!;
    expect(within(salad).getByText(/no recipe — stock won't auto-deduct/i)).toBeInTheDocument();
    // Read-only for this role
    expect(screen.queryByRole('button', { name: 'Edit recipe' })).not.toBeInTheDocument();
  });

  it('opens the recipe editor for the chosen dish', async () => {
    // Arrange
    const onEdit = vi.fn();
    const dish = makeDish();
    const user = userEvent.setup({ delay: null });
    render(<RecipesPanel items={[dish]} inventory={inventory} canEdit onEdit={onEdit} />);

    // Act
    await user.click(screen.getByRole('button', { name: 'Edit recipe' }));

    // Assert
    expect(onEdit).toHaveBeenCalledWith(dish);
  });

  it('filters to dishes without a recipe and by search text', async () => {
    // Arrange
    const items = [makeDish(), makeDish({ id: 'item_2', name: 'Garden Salad', category: 'Salads', recipe: [] })];
    const user = userEvent.setup({ delay: null });
    render(<RecipesPanel items={items} inventory={inventory} canEdit onEdit={vi.fn()} />);

    // Act
    await user.click(screen.getByRole('button', { name: 'No recipe (1)' }));

    // Assert
    expect(screen.queryByText('Margherita')).not.toBeInTheDocument();
    expect(screen.getByText('Garden Salad')).toBeInTheDocument();

    // Act — back to all, then search by ingredient name
    await user.click(screen.getByRole('button', { name: 'No recipe (1)' }));
    await user.type(screen.getByLabelText('Search recipes'), 'flour');

    // Assert
    expect(screen.getByText('Margherita')).toBeInTheDocument();
    expect(screen.queryByText('Garden Salad')).not.toBeInTheDocument();
  });
});

describe('ReorderForm', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({ user: { id: 'u_1', name: 'Maya Manager', role: 'manager' } } as never);
    vi.mocked(settingsApi.get).mockResolvedValue({
      settings: { restaurantName: 'Test Bistro', address: '1 Main St' },
    } as never);
    vi.mocked(inventoryApi.reorder).mockReset();
    vi.mocked(inventoryApi.createPurchaseOrder).mockReset();
  });

  it("pre-fills each low ingredient with the server's suggested quantity and estimates the cost", async () => {
    // Arrange
    vi.mocked(inventoryApi.reorder).mockResolvedValue({ lines: [makeReorderLine()], estimatedTotal: 16 });

    // Act
    render(<ReorderForm inventory={[makeItem({ stock: 2 })]} onSubmitted={vi.fn()} />);

    // Assert — 8 kg × $2.00
    expect(await screen.findByLabelText('Order quantity for Flour')).toHaveValue(8);
    expect(screen.getByText('Estimated total $16.00')).toBeInTheDocument();
    expect(screen.getByText('1 line · 1 supplier')).toBeInTheDocument();
    expect(await screen.findByText('Test Bistro')).toBeInTheDocument();
  });

  it('adds another ingredient at the documented suggestion (twice the reorder level minus stock)', async () => {
    // Arrange
    vi.mocked(inventoryApi.reorder).mockResolvedValue({ lines: [], estimatedTotal: 0 });
    const basil = makeItem({ id: 'inv_2', name: 'Basil', unit: 'kg', stock: 3, reorderLevel: 5, costPerUnit: 10, supplier: 'Herb Farm' });
    const user = userEvent.setup({ delay: null });
    render(<ReorderForm inventory={[basil]} onSubmitted={vi.fn()} />);
    await screen.findByText(/nothing is low right now/i);

    // Act
    await user.selectOptions(screen.getByLabelText('Add another ingredient'), 'inv_2');
    await user.click(screen.getByRole('button', { name: '+ Add line' }));

    // Assert — max(5 × 2 − 3, 5, 1) = 7 kg; 7 × $10.00 = $70.00
    expect(screen.getByLabelText('Order quantity for Basil')).toHaveValue(7);
    expect(screen.getByText('Estimated total $70.00')).toBeInTheDocument();
    expect(screen.getByText('Herb Farm')).toBeInTheDocument();
  });

  it('raises a purchase order with the edited quantities and notes', async () => {
    // Arrange
    vi.mocked(inventoryApi.reorder).mockResolvedValue({ lines: [makeReorderLine()], estimatedTotal: 16 });
    const po = makePo({ number: 'PO-0009', total: 20 });
    vi.mocked(inventoryApi.createPurchaseOrder).mockResolvedValue({ purchaseOrder: po });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const onSubmitted = vi.fn();
    const user = userEvent.setup({ delay: null });
    render(<ReorderForm inventory={[makeItem({ stock: 2 })]} onSubmitted={onSubmitted} />);
    const qtyInput = await screen.findByLabelText('Order quantity for Flour');

    // Act
    await user.clear(qtyInput);
    await user.type(qtyInput, '10');
    await user.type(screen.getByLabelText('Notes for suppliers'), ' Deliver by Friday ');
    await user.click(screen.getByRole('button', { name: 'Submit to supplier' }));

    // Assert
    expect(confirm).toHaveBeenCalledWith('Send this order (1 line, $20.00) to 1 supplier?');
    expect(inventoryApi.createPurchaseOrder).toHaveBeenCalledWith([{ inventoryId: 'inv_1', qty: 10 }], 'Deliver by Friday');
    await waitFor(() => expect(onSubmitted).toHaveBeenCalledWith(po));
    expect(toastFn).toHaveBeenCalledWith('PO-0009 sent to suppliers · $20.00.', 'success');
  });

  it('pluralises lines and suppliers in the confirm when there are several', async () => {
    // Arrange
    vi.mocked(inventoryApi.reorder).mockResolvedValue({
      lines: [makeReorderLine(), makeReorderLine({ inventoryId: 'inv_2', name: 'Basil', supplier: 'Herb Farm' })],
      estimatedTotal: 32,
    });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup({ delay: null });
    render(
      <ReorderForm
        inventory={[makeItem({ stock: 2 }), makeItem({ id: 'inv_2', name: 'Basil', stock: 2 })]}
        onSubmitted={vi.fn()}
      />,
    );
    await screen.findByLabelText('Order quantity for Basil');

    // Act
    await user.click(screen.getByRole('button', { name: 'Submit to supplier' }));

    // Assert
    expect(confirm).toHaveBeenCalledWith(expect.stringMatching(/^Send this order \(2 lines, \$[\d.]+\) to 2 suppliers\?$/));
    expect(inventoryApi.createPurchaseOrder).not.toHaveBeenCalled();
  });

  it('refuses to submit a line with a zero quantity', async () => {
    // Arrange
    vi.mocked(inventoryApi.reorder).mockResolvedValue({ lines: [makeReorderLine()], estimatedTotal: 16 });
    const user = userEvent.setup({ delay: null });
    render(<ReorderForm inventory={[makeItem({ stock: 2 })]} onSubmitted={vi.fn()} />);
    const qtyInput = await screen.findByLabelText('Order quantity for Flour');

    // Act
    await user.clear(qtyInput);
    await user.type(qtyInput, '0');
    await user.click(screen.getByRole('button', { name: 'Submit to supplier' }));

    // Assert
    expect(toastFn).toHaveBeenCalledWith('Quantity for Flour must be greater than zero.', 'error');
    expect(inventoryApi.createPurchaseOrder).not.toHaveBeenCalled();
  });

  it('removes a line from the order', async () => {
    // Arrange
    vi.mocked(inventoryApi.reorder).mockResolvedValue({ lines: [makeReorderLine()], estimatedTotal: 16 });
    const user = userEvent.setup({ delay: null });
    render(<ReorderForm inventory={[makeItem({ stock: 2 })]} onSubmitted={vi.fn()} />);
    await screen.findByLabelText('Order quantity for Flour');

    // Act
    await user.click(screen.getByRole('button', { name: 'Remove Flour from the order' }));

    // Assert
    expect(screen.queryByLabelText('Order quantity for Flour')).not.toBeInTheDocument();
    expect(screen.getByText('Estimated total $0.00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit to supplier' })).toBeDisabled();
  });
});

describe('StockTable', () => {
  const items = [
    makeItem({ id: 'inv_1', name: 'Flour', health: 'ok', usedBy: ['Margherita'] }),
    makeItem({ id: 'inv_2', name: 'Basil', category: 'Produce', health: 'low', stock: 1, supplier: 'Herb Farm', usedBy: [] }),
    makeItem({ id: 'inv_3', name: 'Mozzarella', category: 'Dairy', health: 'near', stock: 6, usedBy: ['Margherita', 'Calzone', 'Lasagne'] }),
  ];
  const handlers = { onAdjust: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn(), onHistory: vi.fn() };

  function rowFor(name: string) {
    return screen.getByText(name).closest('tr')!;
  }

  it('lists ingredients alphabetically with a health badge each', () => {
    // Arrange / Act
    render(<StockTable items={items} canAdjust canManage {...handlers} />);

    // Assert
    const names = screen.getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell')[0].textContent);
    expect(names).toEqual(['Basil', 'Flour', 'Mozzarella']);
    expect(within(rowFor('Flour')).getByText('OK')).toBeInTheDocument();
    expect(within(rowFor('Basil')).getByText('Low · reorder')).toBeInTheDocument();
    expect(within(rowFor('Mozzarella')).getByText('Near reorder')).toBeInTheDocument();
    expect(within(rowFor('Basil')).getByText('Not in any recipe')).toBeInTheDocument();
    expect(within(rowFor('Mozzarella')).getByText('+1 more')).toBeInTheDocument();
  });

  it('filters by health with counts on each filter', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    render(<StockTable items={items} canAdjust canManage {...handlers} />);

    // Act
    await user.click(screen.getByRole('button', { name: 'Low (1)' }));

    // Assert
    expect(screen.getByRole('button', { name: 'Low (1)' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Basil')).toBeInTheDocument();
    expect(screen.queryByText('Flour')).not.toBeInTheDocument();
    expect(screen.queryByText('Mozzarella')).not.toBeInTheDocument();

    // Act
    await user.click(screen.getByRole('button', { name: 'Near (1)' }));

    // Assert
    expect(screen.getByText('Mozzarella')).toBeInTheDocument();
    expect(screen.queryByText('Basil')).not.toBeInTheDocument();
  });

  it('searches by supplier or dish and shows an empty state when nothing matches', async () => {
    // Arrange
    const user = userEvent.setup({ delay: null });
    render(<StockTable items={items} canAdjust canManage {...handlers} />);

    // Act
    await user.type(screen.getByLabelText('Search ingredients'), 'herb farm');

    // Assert
    expect(screen.getByText('Basil')).toBeInTheDocument();
    expect(screen.queryByText('Flour')).not.toBeInTheDocument();

    // Act
    await user.clear(screen.getByLabelText('Search ingredients'));
    await user.type(screen.getByLabelText('Search ingredients'), 'calzone');

    // Assert
    expect(screen.getByText('Mozzarella')).toBeInTheDocument();
    expect(screen.queryByText('Basil')).not.toBeInTheDocument();

    // Act
    await user.clear(screen.getByLabelText('Search ingredients'));
    await user.type(screen.getByLabelText('Search ingredients'), 'zzz');

    // Assert
    expect(screen.getByText('No ingredients match.')).toBeInTheDocument();
  });

  it('shows only the actions the role allows and passes the item to them', async () => {
    // Arrange
    const onAdjust = vi.fn();
    const onHistory = vi.fn();
    const user = userEvent.setup({ delay: null });
    render(<StockTable items={[items[0]]} canAdjust canManage={false} {...handlers} onAdjust={onAdjust} onHistory={onHistory} />);

    // Act
    await user.click(screen.getByRole('button', { name: 'Adjust' }));
    await user.click(screen.getByRole('button', { name: 'Stock history for Flour' }));

    // Assert
    expect(onAdjust).toHaveBeenCalledWith(items[0]);
    expect(onHistory).toHaveBeenCalledWith(items[0]);
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });

  it('disables a busy row and lets a manager edit or delete', async () => {
    // Arrange
    const onDelete = vi.fn();
    const user = userEvent.setup({ delay: null });
    const { rerender } = render(<StockTable items={[items[0]]} canAdjust canManage busyId="inv_1" {...handlers} onDelete={onDelete} />);

    // Assert — busy row actions are disabled
    expect(screen.getByRole('button', { name: 'Adjust' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();

    // Act
    rerender(<StockTable items={[items[0]]} canAdjust canManage busyId={null} {...handlers} onDelete={onDelete} />);
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    // Assert
    expect(onDelete).toHaveBeenCalledWith(items[0]);
  });
});

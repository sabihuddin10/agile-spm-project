import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InventoryPage from '@/app/staff/inventory/page';
import { useAuth } from '@/context/auth-context';
import { inventoryApi, menuApi } from '@/lib/api';
import type { InventoryItem, User } from '@/types';

const toastFn = vi.fn();
vi.mock('@/components/ui/toast', () => ({ useToast: () => toastFn }));
vi.mock('@/context/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock('@/components/layout/staff-layout', () => ({ StaffLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    inventoryApi: { ...actual.inventoryApi, list: vi.fn(), movements: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), purchaseOrders: vi.fn() },
    menuApi: { ...actual.menuApi, items: vi.fn() },
  };
});
vi.mock('@/components/inventory/low-stock-banner', () => ({ LowStockBanner: () => <div data-testid="low-stock-banner" /> }));
vi.mock('@/components/inventory/stock-table', () => ({
  StockTable: ({ items, onEdit }: { items: InventoryItem[]; onEdit: (i: InventoryItem) => void }) => (
    <div data-testid="stock-table">
      {items.map((i) => (
        <button key={i.id} onClick={() => onEdit(i)}>
          {i.name}
        </button>
      ))}
    </div>
  ),
}));
vi.mock('@/components/inventory/ingredient-form', () => ({
  IngredientForm: ({ onSubmit, initial }: { onSubmit: (d: Partial<InventoryItem>) => void; initial: InventoryItem | null }) => (
    <div data-testid="ingredient-form">
      <span>{initial ? `editing ${initial.name}` : 'new ingredient'}</span>
      <button onClick={() => onSubmit({ name: 'Basil' })}>Save ingredient</button>
    </div>
  ),
}));
vi.mock('@/components/inventory/stock-adjust', () => ({ StockAdjust: () => <div data-testid="stock-adjust" /> }));
vi.mock('@/components/inventory/movements', () => ({ StockMovements: () => <div data-testid="stock-movements" /> }));
vi.mock('@/components/inventory/recipes-panel', () => ({ RecipesPanel: () => <div data-testid="recipes-panel" /> }));
vi.mock('@/components/inventory/recipe-editor', () => ({ RecipeEditor: () => <div data-testid="recipe-editor" /> }));
vi.mock('@/components/inventory/reorder-form', () => ({ ReorderForm: () => <div data-testid="reorder-form" /> }));
vi.mock('@/components/inventory/purchase-orders', () => ({ PurchaseOrders: () => <div data-testid="purchase-orders" /> }));

function makeUser(overrides: Partial<User> = {}): User {
  return { id: 'u1', name: 'Jamie Manager', email: 'jamie@rest.test', role: 'manager', active: true, ...overrides };
}

function makeItem(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: 'inv_1', name: 'Tomatoes', category: 'Produce', stock: 10, unit: 'kg', reorderLevel: 5,
    costPerUnit: 1.2, supplier: 'Acme', lowStock: false, health: 'ok', usedBy: [], ...overrides,
  };
}

describe('InventoryPage', () => {
  beforeEach(() => {
    window.location.hash = '';
    toastFn.mockClear();
    vi.mocked(inventoryApi.movements).mockResolvedValue({ movements: [] });
    vi.mocked(inventoryApi.create).mockResolvedValue({ item: makeItem({ id: 'inv_new', name: 'Basil' }) });
    vi.mocked(menuApi.items).mockResolvedValue({ items: [] });
    vi.mocked(inventoryApi.purchaseOrders).mockResolvedValue({ purchaseOrders: [] });
  });

  it('shows a loading spinner, then stock stats and the stock table', async () => {
    // Arrange
    vi.mocked(useAuth).mockReturnValue({ user: makeUser() } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(inventoryApi.list).mockResolvedValue({ inventory: [makeItem()], units: ['kg'], categories: ['Produce'] });

    // Act
    render(<InventoryPage />);

    // Assert
    expect(screen.getByText('Loading inventory…')).toBeInTheDocument();
    expect(await screen.findByTestId('stock-table')).toHaveTextContent('Tomatoes');
  });

  it('shows "+ Add ingredient" only for a role that can manage inventory', async () => {
    // Arrange
    vi.mocked(inventoryApi.list).mockResolvedValue({ inventory: [], units: [], categories: [] });
    vi.mocked(useAuth).mockReturnValue({ user: makeUser({ role: 'chef' }) } as unknown as ReturnType<typeof useAuth>);

    // Act
    render(<InventoryPage />);
    await screen.findByTestId('stock-table');

    // Assert
    expect(screen.queryByRole('button', { name: '+ Add ingredient' })).not.toBeInTheDocument();
  });

  it('switches to the reorder tab only for a role that can manage inventory', async () => {
    // Arrange
    vi.mocked(inventoryApi.list).mockResolvedValue({ inventory: [], units: [], categories: [] });
    vi.mocked(useAuth).mockReturnValue({ user: makeUser({ role: 'manager' }) } as unknown as ReturnType<typeof useAuth>);
    const user = userEvent.setup({ delay: null });
    render(<InventoryPage />);
    await screen.findByTestId('stock-table');

    // Act
    await user.click(screen.getByRole('tab', { name: /Reorder & POs/ }));

    // Assert
    expect(await screen.findByTestId('reorder-form')).toBeInTheDocument();
  });

  it('hides the reorder tab for a chef', async () => {
    // Arrange
    vi.mocked(inventoryApi.list).mockResolvedValue({ inventory: [], units: [], categories: [] });
    vi.mocked(useAuth).mockReturnValue({ user: makeUser({ role: 'chef' }) } as unknown as ReturnType<typeof useAuth>);

    // Act
    render(<InventoryPage />);
    await screen.findByTestId('stock-table');

    // Assert
    expect(screen.queryByRole('tab', { name: /Reorder & POs/ })).not.toBeInTheDocument();
  });

  it('adds a new ingredient and reloads the stock table', async () => {
    // Arrange
    vi.mocked(inventoryApi.list).mockResolvedValue({ inventory: [], units: [], categories: [] });
    vi.mocked(useAuth).mockReturnValue({ user: makeUser() } as unknown as ReturnType<typeof useAuth>);
    const user = userEvent.setup({ delay: null });
    render(<InventoryPage />);
    await screen.findByTestId('stock-table');

    // Act
    await user.click(screen.getByRole('button', { name: '+ Add ingredient' }));
    expect(screen.getByText('new ingredient')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save ingredient' }));

    // Assert
    await waitFor(() => expect(inventoryApi.create).toHaveBeenCalledWith({ name: 'Basil' }));
    expect(toastFn).toHaveBeenCalledWith('Basil added to inventory.', 'success');
  });

  it('opens the edit form for an existing ingredient', async () => {
    // Arrange
    vi.mocked(inventoryApi.list).mockResolvedValue({ inventory: [makeItem({ name: 'Flour' })], units: [], categories: [] });
    vi.mocked(useAuth).mockReturnValue({ user: makeUser() } as unknown as ReturnType<typeof useAuth>);
    const user = userEvent.setup({ delay: null });
    render(<InventoryPage />);
    await screen.findByTestId('stock-table');

    // Act
    await user.click(screen.getByRole('button', { name: 'Flour' }));

    // Assert
    expect(screen.getByText('editing Flour')).toBeInTheDocument();
  });
});

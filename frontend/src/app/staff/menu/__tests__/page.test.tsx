import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MenuPage from '@/app/staff/menu/page';
import { useAuth } from '@/context/auth-context';
import { inventoryApi, menuApi } from '@/lib/api';
import type { MenuCategory, MenuItem, User } from '@/types';

const toastFn = vi.fn();
vi.mock('@/components/ui/toast', () => ({ useToast: () => toastFn }));
vi.mock('@/context/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock('@/components/layout/staff-layout', () => ({ StaffLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    menuApi: { ...actual.menuApi, get: vi.fn(), updateItem: vi.fn(), createItem: vi.fn(), removeItem: vi.fn(), createCategory: vi.fn(), updateCategory: vi.fn(), removeCategory: vi.fn() },
    inventoryApi: { ...actual.inventoryApi, list: vi.fn() },
  };
});
vi.mock('@/components/menu/menu-item-list', () => ({
  MenuItemList: ({
    categories,
    onDelete,
    onMarkOut,
  }: {
    categories: MenuCategory[];
    onDelete: (i: MenuItem) => void;
    onMarkOut: (i: MenuItem) => void;
  }) => (
    <div data-testid="menu-item-list">
      {categories.flatMap((c) => c.items ?? []).map((i) => (
        <span key={i.id}>
          <span>{i.name}</span>
          <button onClick={() => onDelete(i)}>{`Delete ${i.name}`}</button>
          <button onClick={() => onMarkOut(i)}>{`Mark ${i.name} out`}</button>
        </span>
      ))}
    </div>
  ),
}));
vi.mock('@/components/menu/menu-item-form', () => ({
  MenuItemForm: ({ onSubmit }: { onSubmit: (d: Partial<MenuItem>) => void }) => (
    <div data-testid="menu-item-form">
      <button onClick={() => onSubmit({ name: 'New Dish' })}>Save item</button>
    </div>
  ),
}));
// Wraps the real CategoryManager (so its Delete buttons drive the page's ConfirmDialog)
// and adds a one-click "Add category" shortcut for the create test.
vi.mock('@/components/menu/category-manager', async () => {
  const actual = await vi.importActual<typeof import('@/components/menu/category-manager')>('@/components/menu/category-manager');
  return {
    ...actual,
    CategoryManager: (props: React.ComponentProps<typeof actual.CategoryManager>) => (
      <div data-testid="category-manager">
        <button onClick={() => props.onCreate('Desserts')}>Add category</button>
        <actual.CategoryManager {...props} />
      </div>
    ),
  };
});
vi.mock('@/components/inventory/recipe-editor', () => ({ RecipeEditor: () => <div data-testid="recipe-editor" /> }));

function makeUser(overrides: Partial<User> = {}): User {
  return { id: 'u1', name: 'Jamie Manager', email: 'jamie@rest.test', role: 'manager', active: true, ...overrides };
}

function makeItem(overrides: Partial<MenuItem> = {}): MenuItem {
  return {
    id: 'item_1', name: 'Margherita Pizza', categoryId: 'cat_1', price: 18, description: '',
    dietaryTags: [], allergens: [], modifiers: [], available: true, outOfStockReason: '', ...overrides,
  } as MenuItem;
}

function makeCategory(overrides: Partial<MenuCategory> = {}): MenuCategory {
  return { id: 'cat_1', name: 'Mains', sort: 0, active: true, items: [makeItem()], ...overrides };
}

describe('MenuPage', () => {
  beforeEach(() => {
    toastFn.mockClear();
    vi.mocked(menuApi.createItem).mockResolvedValue({ item: makeItem({ id: 'item_new', name: 'New Dish' }) });
    vi.mocked(menuApi.createCategory).mockResolvedValue({ category: makeCategory({ id: 'cat_new', name: 'Desserts' }) });
    vi.mocked(inventoryApi.list).mockResolvedValue({ inventory: [], units: [], categories: [] });
  });

  it('shows a loading spinner, then the loaded menu for a manager', async () => {
    // Arrange
    vi.mocked(useAuth).mockReturnValue({ user: makeUser() } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(menuApi.get).mockResolvedValue({ menu: [makeCategory()], tags: [], allergens: [] });

    // Act
    render(<MenuPage />);

    // Assert
    expect(screen.getByText('Loading menu…')).toBeInTheDocument();
    expect(await screen.findByText('Margherita Pizza')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Menu management' })).toBeInTheDocument();
  });

  it('shows a read-only title and no management controls for a waiter', async () => {
    // Arrange
    vi.mocked(useAuth).mockReturnValue({ user: makeUser({ role: 'waiter' }) } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(menuApi.get).mockResolvedValue({ menu: [makeCategory()], tags: [], allergens: [] });

    // Act
    render(<MenuPage />);

    // Assert
    expect(await screen.findByRole('heading', { name: 'Menu' })).toBeInTheDocument();
    expect(screen.queryByTestId('category-manager')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '+ Add item' })).not.toBeInTheDocument();
  });

  it('filters items shown by search text', async () => {
    // Arrange
    vi.mocked(useAuth).mockReturnValue({ user: makeUser() } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(menuApi.get).mockResolvedValue({
      menu: [makeCategory({ items: [makeItem({ id: 'i1', name: 'Margherita Pizza' }), makeItem({ id: 'i2', name: 'Caesar Salad' })] })],
      tags: [],
      allergens: [],
    });
    const user = userEvent.setup({ delay: null });
    render(<MenuPage />);
    await screen.findByText('Caesar Salad');

    // Act
    await user.type(screen.getByLabelText('Search menu'), 'pizza');

    // Assert
    await waitFor(() => expect(screen.queryByText('Caesar Salad')).not.toBeInTheDocument());
    expect(screen.getByText('Margherita Pizza')).toBeInTheDocument();
  });

  it('caps the out-of-stock reason at 200 characters with a live counter', async () => {
    // Arrange
    vi.mocked(useAuth).mockReturnValue({ user: makeUser() } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(menuApi.get).mockResolvedValue({ menu: [makeCategory()], tags: [], allergens: [] });
    const user = userEvent.setup({ delay: null });
    render(<MenuPage />);
    await screen.findByText('Margherita Pizza');

    // Act
    await user.click(screen.getByRole('button', { name: 'Mark Margherita Pizza out' }));
    await user.click(screen.getByRole('button', { name: 'Ingredient shortage' }));

    // Assert
    const reason = screen.getByLabelText('Reason *');
    expect(reason).toHaveAttribute('maxLength', '200');
    expect(reason).toHaveAccessibleDescription('19/200');
  });

  it('adds a new menu item and reloads', async () => {
    // Arrange
    vi.mocked(useAuth).mockReturnValue({ user: makeUser() } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(menuApi.get).mockResolvedValue({ menu: [makeCategory()], tags: [], allergens: [] });
    const user = userEvent.setup({ delay: null });
    render(<MenuPage />);
    await screen.findByText('Margherita Pizza');

    // Act
    await user.click(screen.getByRole('button', { name: '+ Add item' }));
    await user.click(screen.getByRole('button', { name: 'Save item' }));

    // Assert
    await waitFor(() => expect(menuApi.createItem).toHaveBeenCalledWith({ name: 'New Dish' }));
    expect(toastFn).toHaveBeenCalledWith('New Dish added to the menu.', 'success');
  });

  it('adds a new category', async () => {
    // Arrange
    vi.mocked(useAuth).mockReturnValue({ user: makeUser() } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(menuApi.get).mockResolvedValue({ menu: [makeCategory()], tags: [], allergens: [] });
    const user = userEvent.setup({ delay: null });
    render(<MenuPage />);
    await screen.findByTestId('category-manager');

    // Act
    await user.click(screen.getByRole('button', { name: 'Add category' }));

    // Assert
    await waitFor(() => expect(menuApi.createCategory).toHaveBeenCalledWith('Desserts'));
    expect(toastFn).toHaveBeenCalledWith(expect.stringContaining('Desserts'), 'success');
  });

  it('describes the page without sprint or user-story labels', async () => {
    // Arrange
    vi.mocked(useAuth).mockReturnValue({ user: makeUser() } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(menuApi.get).mockResolvedValue({ menu: [makeCategory()], tags: [], allergens: [] });

    // Act
    render(<MenuPage />);
    await screen.findByText('Margherita Pizza');

    // Assert
    expect(screen.getByText(/items, categories, modifiers with prices/i)).toBeInTheDocument();
    expect(screen.queryByText(/sprint \d/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/US2\./)).not.toBeInTheDocument();
  });

  it('deletes a menu item only after confirming in the dialog', async () => {
    // Arrange
    vi.mocked(useAuth).mockReturnValue({ user: makeUser() } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(menuApi.get).mockResolvedValue({ menu: [makeCategory()], tags: [], allergens: [] });
    vi.mocked(menuApi.removeItem).mockResolvedValue({ deleted: true } as never);
    const user = userEvent.setup({ delay: null });
    render(<MenuPage />);
    await screen.findByText('Margherita Pizza');

    // Act — cancel first
    await user.click(screen.getByRole('button', { name: 'Delete Margherita Pizza' }));
    await user.click(
      within(screen.getByRole('dialog', { name: 'Delete Margherita Pizza?' })).getByRole('button', { name: 'Cancel' }),
    );

    // Assert
    expect(menuApi.removeItem).not.toHaveBeenCalled();

    // Act — then confirm
    await user.click(screen.getByRole('button', { name: 'Delete Margherita Pizza' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete item' }));

    // Assert
    await waitFor(() => expect(menuApi.removeItem).toHaveBeenCalledWith('item_1'));
    expect(toastFn).toHaveBeenCalledWith('Margherita Pizza deleted.', 'success');
  });

  it('deletes an empty category only after confirming in the dialog', async () => {
    // Arrange
    vi.mocked(useAuth).mockReturnValue({ user: makeUser() } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(menuApi.get).mockResolvedValue({
      menu: [makeCategory(), makeCategory({ id: 'cat_2', name: 'Desserts', sort: 1, items: [] })],
      tags: [],
      allergens: [],
    });
    vi.mocked(menuApi.removeCategory).mockResolvedValue({ deleted: true } as never);
    const user = userEvent.setup({ delay: null });
    render(<MenuPage />);
    const manager = await screen.findByTestId('category-manager');
    const dessertsRow = within(manager).getByText('Desserts').closest('li') as HTMLElement;

    // Act — cancel first
    await user.click(within(dessertsRow).getByRole('button', { name: 'Delete' }));
    await user.click(
      within(screen.getByRole('dialog', { name: 'Delete the "Desserts" category?' })).getByRole('button', { name: 'Cancel' }),
    );

    // Assert
    expect(menuApi.removeCategory).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(within(manager).getByText('Desserts')).toBeInTheDocument();

    // Act — then confirm
    await user.click(within(dessertsRow).getByRole('button', { name: 'Delete' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete category' }));

    // Assert
    await waitFor(() => expect(menuApi.removeCategory).toHaveBeenCalledWith('cat_2'));
    expect(toastFn).toHaveBeenCalledWith('Category "Desserts" deleted.', 'success');
  });
});

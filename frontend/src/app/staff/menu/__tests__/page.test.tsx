import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
  MenuItemList: ({ categories }: { categories: MenuCategory[] }) => (
    <div data-testid="menu-item-list">
      {categories.flatMap((c) => c.items ?? []).map((i) => (
        <span key={i.id}>{i.name}</span>
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
vi.mock('@/components/menu/category-manager', () => ({
  CategoryManager: ({ onCreate }: { onCreate: (name: string) => void }) => (
    <div data-testid="category-manager">
      <button onClick={() => onCreate('Desserts')}>Add category</button>
    </div>
  ),
}));
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
});

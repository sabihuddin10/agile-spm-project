/**
 * Module-wise tests for src/components/menu (components).
 *
 * Real tests for this module go here, in __tests__/, mirroring the
 * app/ and components/ directory structure. Follow the Arrange-Act-Assert
 * (AAA) pattern used in src/lib/__tests__/menu.test.ts,
 * src/components/menu/__tests__/menu-item-card.test.tsx and
 * src/components/account/__tests__/profile-editor.test.tsx — Arrange the
 * data/props, Act (render / interact), then Assert the outcome, with each
 * phase commented.
 *
 * category-manager, menu-item-card and modifier-picker have their own test
 * files in this folder; this file covers cart-drawer, menu-item-form,
 * menu-item-list and public-menu.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CartDrawer } from '@/components/menu/cart-drawer';
import { MenuItemForm } from '@/components/menu/menu-item-form';
import { MenuItemList, type MenuItemPermissions } from '@/components/menu/menu-item-list';
import { PublicMenu } from '@/components/menu/public-menu';
import { CartProvider } from '@/context/cart-context';
import { useAuth } from '@/context/auth-context';
import { customerApi, menuApi } from '@/lib/api';
import type { MenuCategory, MenuItem, User } from '@/types';

const toastFn = vi.fn();

vi.mock('@/lib/api', () => ({ menuApi: { get: vi.fn() }, customerApi: { me: vi.fn() } }));
vi.mock('@/components/ui/toast', () => ({ useToast: () => toastFn }));
vi.mock('@/context/auth-context', () => ({ useAuth: vi.fn() }));
// The checkout form has its own tests (components/storefront); stub it so the drawer test stays on the drawer.
vi.mock('@/components/storefront/checkout-form', () => ({
  CheckoutForm: () => <p>Checkout form</p>,
}));

const CART_KEY = 'plate_flame_cart_v2';

function makeItem(overrides: Partial<MenuItem> = {}): MenuItem {
  return {
    id: 'item_1',
    name: 'Margherita',
    categoryId: 'cat_1',
    price: 12,
    description: 'Tomato, mozzarella, basil.',
    dietaryTags: [],
    allergens: [],
    modifiers: [],
    available: true,
    outOfStockReason: '',
    ...overrides,
  };
}

function makeCategory(overrides: Partial<MenuCategory> = {}): MenuCategory {
  return { id: 'cat_1', name: 'Pizza', sort: 1, active: true, items: [], ...overrides };
}

function signIn(role: User['role'] | null) {
  vi.mocked(useAuth).mockReturnValue({
    user: role ? ({ id: 'u_1', name: 'Casey', email: 'c@example.com', role, active: true } as User) : null,
  } as ReturnType<typeof useAuth>);
}

const sizeGroup = {
  id: 'mod_size',
  name: 'Size',
  type: 'single' as const,
  options: [
    { label: 'Regular', priceDelta: 0 },
    { label: 'Large', priceDelta: 4 },
  ],
};

beforeEach(() => {
  toastFn.mockReset();
  window.localStorage.clear();
});

describe('CartDrawer', () => {
  function seedCart(lines: { item: MenuItem; qty: number; modifiers?: { group: string; label: string }[] }[]) {
    window.localStorage.setItem(CART_KEY, JSON.stringify(lines.map((l) => ({ modifiers: [], ...l }))));
  }

  function renderDrawer() {
    return render(
      <CartProvider>
        <CartDrawer />
      </CartProvider>,
    );
  }

  it('totals the lines, including option price deltas, on the floating button and in the drawer', async () => {
    // Arrange — 2 × $12.00 Margherita + 1 × ($10.00 + $4.00 Large) Calzone = $38.00
    signIn('customer');
    seedCart([
      { item: makeItem(), qty: 2 },
      { item: makeItem({ id: 'item_2', name: 'Calzone', price: 10, modifiers: [sizeGroup] }), qty: 1, modifiers: [{ group: 'Size', label: 'Large' }] },
    ]);
    const user = userEvent.setup();
    renderDrawer();

    // Act
    await user.click(await screen.findByRole('button', { name: 'View your order, 3 items, $38.00' }));

    // Assert
    const drawer = screen.getByRole('dialog', { name: 'Your order' });
    expect(within(drawer).getByText('$24.00')).toBeInTheDocument();
    expect(within(drawer).getByText('$14.00 each')).toBeInTheDocument();
    expect(within(drawer).getByText('Subtotal').nextSibling).toHaveTextContent('$38.00');
    expect(within(drawer).getByRole('button', { name: 'Checkout · $38.00' })).toBeInTheDocument();
  });

  it('removes a line when its quantity is stepped down from one and updates the total', async () => {
    // Arrange
    signIn('customer');
    seedCart([
      { item: makeItem(), qty: 2 },
      { item: makeItem({ id: 'item_2', name: 'Tiramisu', price: 7.5 }), qty: 1 },
    ]);
    const user = userEvent.setup();
    renderDrawer();
    await user.click(await screen.findByRole('button', { name: /view your order/i }));

    // Act
    await user.click(screen.getByRole('button', { name: 'Remove Tiramisu' }));

    // Assert
    expect(screen.queryByText('Tiramisu')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Checkout · $24.00' })).toBeInTheDocument();

    // Act — one fewer Margherita
    await user.click(screen.getByRole('button', { name: 'One fewer Margherita' }));

    // Assert
    expect(screen.getByRole('button', { name: 'Checkout · $12.00' })).toBeInTheDocument();
  });

  it('clears the cart and shows the empty state', async () => {
    // Arrange
    signIn('customer');
    seedCart([{ item: makeItem(), qty: 1 }]);
    const user = userEvent.setup();
    renderDrawer();
    await user.click(await screen.findByRole('button', { name: /view your order/i }));

    // Act
    await user.click(screen.getByRole('button', { name: 'Clear' }));

    // Assert
    expect(screen.getByText('Your order is empty')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse the menu' })).toHaveAttribute('href', '/menu');
  });

  it('moves to checkout for a customer and closes on Escape', async () => {
    // Arrange
    signIn('customer');
    seedCart([{ item: makeItem(), qty: 1 }]);
    const user = userEvent.setup();
    renderDrawer();
    await user.click(await screen.findByRole('button', { name: /view your order/i }));

    // Act
    await user.click(screen.getByRole('button', { name: 'Checkout · $12.00' }));

    // Assert
    expect(screen.getByRole('dialog', { name: 'Checkout' })).toBeInTheDocument();
    expect(screen.getByText('Checkout form')).toBeInTheDocument();

    // Act
    await user.keyboard('{Escape}');

    // Assert
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('asks a signed-out visitor to sign in instead of checking out', async () => {
    // Arrange
    signIn(null);
    seedCart([{ item: makeItem(), qty: 1 }]);
    const user = userEvent.setup();
    renderDrawer();

    // Act
    await user.click(await screen.findByRole('button', { name: /view your order/i }));

    // Assert
    expect(screen.getByRole('link', { name: 'Sign in to check out' })).toHaveAttribute('href', '/login');
    expect(screen.queryByRole('button', { name: /checkout/i })).not.toBeInTheDocument();
  });
});

describe('MenuItemForm', () => {
  const categories = [makeCategory(), makeCategory({ id: 'cat_2', name: 'Desserts', active: false })];

  function renderForm(props: Partial<React.ComponentProps<typeof MenuItemForm>> = {}) {
    const onSubmit = vi.fn();
    render(<MenuItemForm categories={categories} onSubmit={onSubmit} onCancel={vi.fn()} {...props} />);
    return { onSubmit, form: screen.getByRole('button', { name: /add item|save changes/i }).closest('form')! };
  }

  it('requires an item name', async () => {
    // Arrange
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    // Act — whitespace passes `required`, but not the form's own check
    await user.type(screen.getByLabelText('Item name *'), '   ');
    await user.type(screen.getByLabelText('Price (USD) *'), '9');
    await user.click(screen.getByRole('button', { name: 'Add item' }));

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent('Item name is required.');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rejects a blank or negative price', async () => {
    // Arrange
    const user = userEvent.setup();
    const { onSubmit, form } = renderForm();
    await user.type(screen.getByLabelText('Item name *'), 'Focaccia');

    // Act — fireEvent.submit bypasses the input's own required/min constraints
    fireEvent.submit(form);

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent('Price must be zero or more.');

    // Act
    await user.type(screen.getByLabelText('Price (USD) *'), '-2');
    fireEvent.submit(form);

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent('Price must be zero or more.');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('requires a reason when the item is marked unavailable', async () => {
    // Arrange
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    await user.type(screen.getByLabelText('Item name *'), 'Focaccia');
    await user.type(screen.getByLabelText('Price (USD) *'), '6');

    // Act
    await user.click(screen.getByRole('checkbox', { name: 'Available to order' }));
    await user.click(screen.getByRole('button', { name: 'Add item' }));

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent('Add a reason for marking it out of stock.');
    expect(onSubmit).not.toHaveBeenCalled();

    // Act
    await user.type(screen.getByLabelText('Out-of-stock reason *'), 'Oven down');
    await user.click(screen.getByRole('button', { name: 'Add item' }));

    // Assert
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ available: false, outOfStockReason: 'Oven down' }));
  });

  it('requires every modifier group to have a name', async () => {
    // Arrange
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    await user.type(screen.getByLabelText('Item name *'), 'Focaccia');
    await user.type(screen.getByLabelText('Price (USD) *'), '6');

    // Act
    await user.click(screen.getByRole('button', { name: '+ Add modifier group' }));
    await user.type(screen.getByLabelText('Group option 1 label'), 'Rosemary');
    await user.click(screen.getByRole('button', { name: 'Add item' }));

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent('Give every modifier group a name (e.g. "Size").');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rejects duplicate option labels within a group', async () => {
    // Arrange
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    await user.type(screen.getByLabelText('Item name *'), 'Focaccia');
    await user.type(screen.getByLabelText('Price (USD) *'), '6');
    await user.click(screen.getByRole('button', { name: '+ Add modifier group' }));
    await user.type(screen.getByLabelText('Modifier group 1 name'), 'Size');

    // Act
    await user.type(screen.getByLabelText('Size option 1 label'), 'Large');
    await user.click(screen.getByRole('button', { name: '+ Add option' }));
    await user.type(screen.getByLabelText('Size option 2 label'), 'large');
    await user.click(screen.getByRole('button', { name: 'Add item' }));

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent('Option labels in "Size" must be unique.');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits a new item with tags and a priced modifier group, previewing what customers see', async () => {
    // Arrange
    const user = userEvent.setup();
    const { onSubmit } = renderForm({ defaultCategoryId: 'cat_1' });

    // Act
    await user.type(screen.getByLabelText('Item name *'), ' Focaccia ');
    await user.type(screen.getByLabelText('Price (USD) *'), '6.5');
    await user.click(screen.getByRole('button', { name: 'vegan' }));
    await user.click(screen.getByRole('button', { name: 'gluten' }));
    await user.click(screen.getByRole('button', { name: '+ Add modifier group' }));
    await user.type(screen.getByLabelText('Modifier group 1 name'), 'Size');
    await user.type(screen.getByLabelText('Size option 1 label'), 'Regular');
    await user.click(screen.getByRole('button', { name: '+ Add option' }));
    await user.type(screen.getByLabelText('Size option 2 label'), 'Large');
    await user.type(screen.getByLabelText('Large price change'), '4');

    // Assert — live preview
    expect(screen.getByText('Size: Regular, Large +$4.00')).toBeInTheDocument();

    // Act
    await user.click(screen.getByRole('button', { name: 'Add item' }));

    // Assert
    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Focaccia',
      categoryId: 'cat_1',
      price: 6.5,
      description: '',
      dietaryTags: ['vegan'],
      allergens: ['gluten'],
      modifiers: [
        {
          id: '',
          name: 'Size',
          type: 'single',
          options: [
            { label: 'Regular', priceDelta: 0 },
            { label: 'Large', priceDelta: 4 },
          ],
        },
      ],
      available: true,
      outOfStockReason: '',
    });
  });

  it('pre-fills an existing item, keeping its modifier group id on save', async () => {
    // Arrange
    const user = userEvent.setup();
    const initial = makeItem({ modifiers: [sizeGroup], dietaryTags: ['vegetarian'] });
    const { onSubmit } = renderForm({ initial });

    // Assert
    expect(screen.getByLabelText('Item name *')).toHaveValue('Margherita');
    expect(screen.getByLabelText('Price (USD) *')).toHaveValue(12);
    expect(screen.getByRole('button', { name: 'vegetarian' })).toHaveAttribute('aria-pressed', 'true');

    // Act
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    // Assert
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ modifiers: [sizeGroup] }));
  });
});

describe('MenuItemList', () => {
  const all: MenuItemPermissions = { manage: true, toggle: true, viewRecipes: true, recipes: true };
  const none: MenuItemPermissions = { manage: false, toggle: false, viewRecipes: false, recipes: false };

  function handlers() {
    return { onEdit: vi.fn(), onDelete: vi.fn(), onMarkOut: vi.fn(), onMarkIn: vi.fn(), onRecipe: vi.fn(), onAdd: vi.fn() };
  }

  const pizza = makeItem({
    modifiers: [sizeGroup],
    allergens: ['dairy'],
    dietaryTags: ['vegetarian'],
    recipe: [{ inventoryId: 'inv_1', qty: 0.3, name: 'Flour', unit: 'kg' }],
  });
  const calzone = makeItem({ id: 'item_2', name: 'Calzone', available: false, outOfStockReason: 'Out of ricotta', recipe: [] });

  it('groups items by category with availability counts, tags, modifiers and recipe status', () => {
    // Arrange
    const categories = [makeCategory({ items: [pizza, calzone] }), makeCategory({ id: 'cat_2', name: 'Desserts', items: [] })];

    // Act
    render(<MenuItemList categories={categories} permissions={all} {...handlers()} />);

    // Assert
    const pizzaSection = screen.getByRole('region', { name: 'Pizza' });
    expect(within(pizzaSection).getByText('1/2 available')).toBeInTheDocument();
    const card = screen.getByText('Margherita').closest('article')!;
    expect(within(card).getByText('Available')).toBeInTheDocument();
    expect(within(card).getByText('vegetarian')).toBeInTheDocument();
    expect(within(card).getByText('dairy')).toBeInTheDocument();
    expect(within(card).getByText('+$4.00')).toBeInTheDocument();
    expect(within(card).getByText(/1 ingredient/)).toBeInTheDocument();
    const out = screen.getByText('Calzone').closest('article')!;
    expect(within(out).getByText('Out of stock')).toBeInTheDocument();
    expect(within(out).getByText('Out of ricotta')).toBeInTheDocument();
    expect(within(out).getByText(/no recipe — stock won't auto-deduct/i)).toBeInTheDocument();
    // An empty category offers to add an item
    expect(screen.getByRole('button', { name: '+ Add item to Desserts' })).toBeInTheDocument();
  });

  it('toggles availability through the mark-out and back-in actions', async () => {
    // Arrange
    const h = handlers();
    const user = userEvent.setup();
    render(<MenuItemList categories={[makeCategory({ items: [pizza, calzone] })]} permissions={all} {...h} />);

    // Act
    await user.click(screen.getByRole('button', { name: 'Mark out of stock' }));
    await user.click(screen.getByRole('button', { name: 'Back in stock' }));

    // Assert
    expect(h.onMarkOut).toHaveBeenCalledWith(pizza);
    expect(h.onMarkIn).toHaveBeenCalledWith(calzone);
  });

  it('disables the toggle while that item is updating', () => {
    // Arrange / Act
    render(<MenuItemList categories={[makeCategory({ items: [calzone] })]} permissions={all} busyId="item_2" {...handlers()} />);

    // Assert
    expect(screen.getByRole('button', { name: 'Updating…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
  });

  it('skips empty categories while a search/filter is active and says when nothing matches', () => {
    // Arrange
    const categories = [makeCategory({ items: [pizza] }), makeCategory({ id: 'cat_2', name: 'Desserts', items: [] })];

    // Act
    const { rerender } = render(<MenuItemList categories={categories} permissions={all} filtered {...handlers()} />);

    // Assert
    expect(screen.getByRole('region', { name: 'Pizza' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Desserts' })).not.toBeInTheDocument();

    // Act
    rerender(<MenuItemList categories={[categories[1]]} permissions={all} filtered {...handlers()} />);

    // Assert
    expect(screen.getByText('No menu items match.')).toBeInTheDocument();
  });

  it('shows no actions or recipe status to a role without permissions', () => {
    // Arrange / Act
    render(<MenuItemList categories={[makeCategory({ items: [pizza] })]} permissions={none} {...handlers()} />);

    // Assert
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByText(/recipe:/i)).not.toBeInTheDocument();
  });

  it('renders a waiter view of items without `recipe` and shows no recipe warning', () => {
    // Arrange — the server omits `recipe` for waiters
    const { recipe: _omitted, ...pizzaNoRecipe } = pizza;
    void _omitted;
    const items = [pizzaNoRecipe as typeof pizza, { ...calzone, recipe: undefined } as unknown as typeof calzone];

    // Act
    render(<MenuItemList categories={[makeCategory({ items })]} permissions={none} {...handlers()} />);

    // Assert
    expect(screen.getByText('Margherita')).toBeInTheDocument();
    expect(screen.getByText('Calzone')).toBeInTheDocument();
    expect(screen.queryByText(/no recipe/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/recipe:/i)).not.toBeInTheDocument();
  });

  it('hides recipe status from a role that cannot view recipes even if the data is present', () => {
    // Arrange
    const waiter: MenuItemPermissions = { ...none, viewRecipes: false };
    const chef: MenuItemPermissions = { ...none, toggle: true, viewRecipes: true };

    // Act
    const { rerender } = render(<MenuItemList categories={[makeCategory({ items: [pizza, calzone] })]} permissions={waiter} {...handlers()} />);
    // Assert
    expect(screen.queryByText(/no recipe/i)).not.toBeInTheDocument();

    // Act
    rerender(<MenuItemList categories={[makeCategory({ items: [pizza, calzone] })]} permissions={chef} {...handlers()} />);
    // Assert
    expect(screen.getByText(/1 ingredient/)).toBeInTheDocument();
    expect(screen.getByText(/no recipe — stock won't auto-deduct/i)).toBeInTheDocument();
  });
});

describe('PublicMenu', () => {
  const menu = {
    menu: [
      makeCategory({
        items: [
          makeItem({ dietaryTags: ['vegetarian'], allergens: ['dairy'] }),
          makeItem({ id: 'item_2', name: 'Pepperoni', price: 14, allergens: ['dairy'] }),
        ],
      }),
      makeCategory({ id: 'cat_2', name: 'Desserts', items: [makeItem({ id: 'item_3', name: 'Tiramisu', price: 7 })] }),
      makeCategory({ id: 'cat_3', name: 'Secret menu', active: false, items: [makeItem({ id: 'item_4', name: 'Hidden dish' })] }),
    ],
    tags: ['vegetarian'],
    allergens: ['dairy'],
  };

  function renderMenu() {
    return render(
      <CartProvider>
        <PublicMenu />
        <CartDrawer />
      </CartProvider>,
    );
  }

  it('renders active categories as menu item cards and hides inactive ones', async () => {
    // Arrange
    signIn(null);
    vi.mocked(menuApi.get).mockResolvedValue(menu);

    // Act
    renderMenu();

    // Assert
    expect(await screen.findByRole('heading', { name: 'Pizza' })).toBeInTheDocument();
    expect(screen.getByText('2 dishes')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Desserts' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Tiramisu to order' })).toBeInTheDocument();
    expect(screen.queryByText('Secret menu')).not.toBeInTheDocument();
    expect(screen.queryByText('Hidden dish')).not.toBeInTheDocument();
  });

  it('filters dishes by dietary tag', async () => {
    // Arrange
    signIn(null);
    vi.mocked(menuApi.get).mockResolvedValue(menu);
    const user = userEvent.setup();
    renderMenu();
    await screen.findByRole('heading', { name: 'Pizza' });

    // Act
    await user.click(screen.getByRole('button', { name: 'vegetarian' }));

    // Assert
    expect(screen.getByText('Margherita')).toBeInTheDocument();
    expect(screen.queryByText('Pepperoni')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Desserts' })).not.toBeInTheDocument();
  });

  it("adds a dish to the signed-in customer's cart and flags dishes clashing with their allergies", async () => {
    // Arrange
    signIn('customer');
    vi.mocked(menuApi.get).mockResolvedValue(menu);
    vi.mocked(customerApi.me).mockResolvedValue({ customer: { preferences: { allergies: ['dairy'] } } } as never);
    const user = userEvent.setup();
    renderMenu();
    await screen.findByRole('heading', { name: 'Pizza' });

    // Assert — allergy notice from the customer's profile
    expect(await screen.findByText(/we're flagging dishes that contain/i)).toHaveTextContent('dairy');

    // Act
    await user.click(screen.getByRole('button', { name: 'Add Tiramisu to order' }));

    // Assert — the cart picks it up
    expect(toastFn).toHaveBeenCalledWith('Tiramisu added to your order.', 'success');
    expect(screen.getByRole('button', { name: 'View your order, 1 item, $7.00' })).toBeInTheDocument();
  });

  it('shows an error when the menu fails to load', async () => {
    // Arrange
    signIn(null);
    vi.mocked(menuApi.get).mockRejectedValue(new Error('Network down'));

    // Act
    renderMenu();

    // Assert
    await waitFor(() => expect(screen.getByText('Network down')).toBeInTheDocument());
    expect(screen.getByText(/is the kitchen open/i)).toBeInTheDocument();
  });
});

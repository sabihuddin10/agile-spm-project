import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { CartProvider, useCart } from '@/context/cart-context';
import { useAuth } from '@/context/auth-context';
import type { MenuItem, User } from '@/types';

const toast = vi.fn();
vi.mock('@/components/ui/toast', () => ({ useToast: () => toast }));
vi.mock('@/context/auth-context', () => ({ useAuth: vi.fn() }));

const STORAGE_KEY = 'plate_flame_cart_v2';

function makeUser(overrides: Partial<User> = {}): User {
  return { id: 'usr_1', name: 'Casey Customer', email: 'casey@example.com', role: 'customer', active: true, ...overrides };
}

function makeItem(overrides: Partial<MenuItem> = {}): MenuItem {
  return {
    id: 'item_1',
    name: 'Margherita Pizza',
    categoryId: 'cat_1',
    price: 18,
    description: '',
    dietaryTags: [],
    allergens: [],
    modifiers: [],
    available: true,
    outOfStockReason: '',
    ...overrides,
  };
}

function renderCart() {
  return renderHook(() => useCart(), { wrapper: CartProvider });
}

describe('CartProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    toast.mockReset();
    vi.mocked(useAuth).mockReturnValue({ user: makeUser() } as ReturnType<typeof useAuth>);
  });

  it('refuses to add an item for a signed-out visitor', async () => {
    // Arrange
    vi.mocked(useAuth).mockReturnValue({ user: null } as ReturnType<typeof useAuth>);
    const { result } = renderCart();
    await waitFor(() => expect(result.current.lines).toEqual([]));

    // Act
    let added: boolean;
    act(() => {
      added = result.current.add(makeItem());
    });

    // Assert
    expect(added!).toBe(false);
    expect(toast).toHaveBeenCalledWith('Sign in to start an order.', 'info');
    expect(result.current.lines).toEqual([]);
  });

  it('refuses to add an item for staff', async () => {
    // Arrange
    vi.mocked(useAuth).mockReturnValue({ user: makeUser({ role: 'waiter' }) } as ReturnType<typeof useAuth>);
    const { result } = renderCart();
    await waitFor(() => expect(result.current.lines).toEqual([]));

    // Act
    act(() => result.current.add(makeItem()));

    // Assert
    expect(toast).toHaveBeenCalledWith('Staff place orders from the staff console.', 'info');
    expect(result.current.lines).toEqual([]);
  });

  it('refuses to add an unavailable item', async () => {
    // Arrange
    const { result } = renderCart();
    await waitFor(() => expect(result.current.lines).toEqual([]));

    // Act
    act(() => result.current.add(makeItem({ available: false })));

    // Assert
    expect(toast).toHaveBeenCalledWith(expect.stringContaining('unavailable'), 'error');
    expect(result.current.lines).toEqual([]);
  });

  it('refuses a 51st different line with a friendly message, but still adds to an existing line', async () => {
    // Arrange — fill the cart with 50 different dishes
    const { result } = renderCart();
    await waitFor(() => expect(result.current.lines).toEqual([]));
    for (let i = 0; i < 50; i += 1) {
      act(() => {
        result.current.add(makeItem({ id: `item_${i}`, name: `Dish ${i}` }));
      });
    }
    toast.mockReset();

    // Act
    let added: boolean;
    act(() => {
      added = result.current.add(makeItem({ id: 'item_51', name: 'One too many' }));
    });

    // Assert
    expect(added!).toBe(false);
    expect(result.current.lines).toHaveLength(50);
    expect(toast).toHaveBeenCalledWith(expect.stringMatching(/at most 50 different dishes/), 'error');

    // Act
    act(() => {
      added = result.current.add(makeItem({ id: 'item_0', name: 'Dish 0' }));
    });

    // Assert
    expect(added!).toBe(true);
    expect(result.current.lines[0].qty).toBe(2);
  });

  it('merges the same item and modifiers into one line instead of duplicating it', async () => {
    // Arrange
    const item = makeItem();
    const { result } = renderCart();
    await waitFor(() => expect(result.current.lines).toEqual([]));

    // Act
    act(() => result.current.add(item));
    act(() => result.current.add(item));

    // Assert
    expect(result.current.lines).toHaveLength(1);
    expect(result.current.lines[0].qty).toBe(2);
    expect(result.current.count).toBe(2);
    expect(result.current.subtotal).toBe(36);
  });

  it('setQty adjusts the quantity and removes the line once it reaches zero', async () => {
    // Arrange
    const { result } = renderCart();
    await waitFor(() => expect(result.current.lines).toEqual([]));
    act(() => result.current.add(makeItem()));
    const key = result.current.lines[0].key;

    // Act
    act(() => result.current.setQty(key, -1));

    // Assert
    expect(result.current.lines).toEqual([]);
  });

  it('remove drops only the targeted line', async () => {
    // Arrange
    const { result } = renderCart();
    await waitFor(() => expect(result.current.lines).toEqual([]));
    act(() => result.current.add(makeItem({ id: 'item_1', name: 'Pizza' })));
    act(() => result.current.add(makeItem({ id: 'item_2', name: 'Soda' })));
    const [first, second] = result.current.lines;

    // Act
    act(() => result.current.remove(first.key));

    // Assert
    expect(result.current.lines).toEqual([second]);
  });

  it('clear empties the cart', async () => {
    // Arrange
    const { result } = renderCart();
    await waitFor(() => expect(result.current.lines).toEqual([]));
    act(() => result.current.add(makeItem()));

    // Act
    act(() => result.current.clear());

    // Assert
    expect(result.current.lines).toEqual([]);
  });

  it('rehydrates a previously saved cart from storage', async () => {
    // Arrange
    const item = makeItem();
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{ item, qty: 2, modifiers: [] }]));

    // Act
    const { result } = renderCart();

    // Assert
    await waitFor(() => expect(result.current.lines).toHaveLength(1));
    expect(result.current.lines[0].qty).toBe(2);
  });

  it('ignores malformed stored data instead of crashing', async () => {
    // Arrange
    localStorage.setItem(STORAGE_KEY, 'not json');

    // Act
    const { result } = renderCart();

    // Assert
    await waitFor(() => expect(result.current.lines).toEqual([]));
  });

  it('clears the cart when a different account signs in on the same browser', async () => {
    // Arrange
    const userA = makeUser({ id: 'usr_a' });
    vi.mocked(useAuth).mockReturnValue({ user: userA } as ReturnType<typeof useAuth>);
    const { result, rerender } = renderCart();
    await waitFor(() => expect(result.current.lines).toEqual([]));
    act(() => result.current.add(makeItem()));
    expect(result.current.lines).toHaveLength(1);

    // Act
    const userB = makeUser({ id: 'usr_b' });
    vi.mocked(useAuth).mockReturnValue({ user: userB } as ReturnType<typeof useAuth>);
    rerender();

    // Assert
    await waitFor(() => expect(result.current.lines).toEqual([]));
  });
});

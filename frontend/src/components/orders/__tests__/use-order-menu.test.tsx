import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useMenuIndex, useOrderMenu } from '@/components/orders/use-order-menu';
import { menuApi } from '@/lib/api';
import type { MenuCategory, MenuItem } from '@/types';

vi.mock('@/lib/api', () => ({ menuApi: { get: vi.fn(), items: vi.fn() } }));
vi.mock('@/components/ui/toast', () => ({ useToast: () => vi.fn() }));

describe('useOrderMenu', () => {
  it('loads the menu and exposes its categories', async () => {
    // Arrange
    const menu: MenuCategory[] = [{ id: 'cat_1', name: 'Mains', sort: 0, active: true }];
    vi.mocked(menuApi.get).mockResolvedValue({ menu, tags: [], allergens: [] });

    // Act
    const { result } = renderHook(() => useOrderMenu());

    // Assert
    expect(result.current).toBe(null);
    await waitFor(() => expect(result.current).toEqual(menu));
  });

  it('falls back to an empty list when loading fails', async () => {
    // Arrange
    vi.mocked(menuApi.get).mockRejectedValue(new Error('network down'));

    // Act
    const { result } = renderHook(() => useOrderMenu());

    // Assert
    await waitFor(() => expect(result.current).toEqual([]));
  });
});

describe('useMenuIndex', () => {
  it('indexes every menu item by id', async () => {
    // Arrange
    const items = [{ id: 'item_1', name: 'Pizza' }] as MenuItem[];
    vi.mocked(menuApi.items).mockResolvedValue({ items });

    // Act
    const { result } = renderHook(() => useMenuIndex());

    // Assert
    await waitFor(() => expect(result.current.get('item_1')).toEqual(items[0]));
  });

  it('does not fetch when disabled', () => {
    // Arrange / Act
    renderHook(() => useMenuIndex(false));

    // Assert
    expect(menuApi.items).not.toHaveBeenCalled();
  });
});

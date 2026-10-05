'use client';

import { useEffect, useState } from 'react';
import type { MenuCategory, MenuItem } from '@/types';
import { menuApi } from '@/lib/api';
import { errorMessage } from '@/lib/format';
import { useToast } from '@/components/ui/toast';

/** The orderable menu grouped by category, for the order line editor. `null` while loading. */
export function useOrderMenu(): MenuCategory[] | null {
  const toast = useToast();
  const [categories, setCategories] = useState<MenuCategory[] | null>(null);

  useEffect(() => {
    let alive = true;
    menuApi
      .get()
      .then(({ menu }) => {
        if (alive) setCategories(menu);
      })
      .catch((err) => {
        if (!alive) return;
        toast(errorMessage(err, 'Failed to load the menu.'), 'error');
        setCategories([]);
      });
    return () => {
      alive = false;
    };
  }, [toast]);

  return categories;
}

/**
 * Every dish by id, loaded once — used to cross-check order lines against a
 * guest's allergies (US1.5). Best effort: an empty map just means no flags.
 */
export function useMenuIndex(enabled = true): Map<string, MenuItem> {
  const [index, setIndex] = useState<Map<string, MenuItem>>(() => new Map());

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    menuApi
      .items()
      .then(({ items }) => {
        if (alive) setIndex(new Map(items.map((i) => [i.id, i])));
      })
      .catch(() => {
        /* allergen cross-check is optional */
      });
    return () => {
      alive = false;
    };
  }, [enabled]);

  return index;
}

'use client';

import { useMemo, useState } from 'react';
import type { InventoryItem, MenuItem } from '@/types';
import { money, percent } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { HEALTH, qty, recipeCost } from './helpers';

/**
 * Every dish with its bill of materials and food cost per portion (US8.2).
 * Managers/admins can open the recipe editor; chefs see it read-only.
 */
export function RecipesPanel({
  items,
  inventory,
  canEdit,
  loading,
  onEdit,
}: {
  items: MenuItem[];
  inventory: InventoryItem[];
  canEdit: boolean;
  loading?: boolean;
  onEdit: (item: MenuItem) => void;
}) {
  const [search, setSearch] = useState('');
  const [missingOnly, setMissingOnly] = useState(false);

  const missing = items.filter((i) => (i.recipe ?? []).length === 0).length;
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter((i) => !missingOnly || (i.recipe ?? []).length === 0)
      .filter(
        (i) =>
          !q ||
          i.name.toLowerCase().includes(q) ||
          (i.category ?? '').toLowerCase().includes(q) ||
          (i.recipe ?? []).some((r) => (r.name ?? '').toLowerCase().includes(q)),
      );
  }, [items, missingOnly, search]);

  return (
    <div>
      <div className="flex flex-col gap-3 border-b border-stone-100 p-4 sm:flex-row sm:items-center">
        <div className="flex-1">
          <h2 className="font-semibold text-stone-800">Recipes (bill of materials)</h2>
          <p className="mt-0.5 text-sm text-stone-500">
            Ingredients used by one portion of each dish. These amounts are deducted when an order closes.
          </p>
        </div>
        <input
          type="search"
          className="input sm:w-56"
          placeholder="Search dish or ingredient…"
          aria-label="Search recipes"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          type="button"
          aria-pressed={missingOnly}
          onClick={() => setMissingOnly((v) => !v)}
          className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition ${
            missingOnly ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-stone-200 text-stone-500 hover:bg-stone-50'
          }`}
        >
          No recipe ({missing})
        </button>
      </div>

      {loading && items.length === 0 ? (
        <Spinner label="Loading recipes…" />
      ) : shown.length === 0 ? (
        <p className="py-12 text-center text-sm text-stone-500">No dishes match.</p>
      ) : (
        <div className="grid gap-3 p-4 md:grid-cols-2 2xl:grid-cols-3">
          {shown.map((dish) => {
            const recipe = dish.recipe ?? [];
            const cost = recipeCost(recipe, inventory);
            return (
              <article key={dish.id} className="flex flex-col rounded-xl border border-stone-200 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-stone-800">{dish.name}</p>
                    <p className="text-xs text-stone-500">
                      {dish.category} · {money(dish.price)}
                      {!dish.available ? <span className="text-red-600"> · out of stock</span> : null}
                    </p>
                  </div>
                  {canEdit ? (
                    <button className="btn-sm btn-secondary shrink-0" onClick={() => onEdit(dish)}>
                      Edit recipe
                    </button>
                  ) : null}
                </div>

                {recipe.length === 0 ? (
                  <p className="mt-3 rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
                    No recipe — stock won&apos;t auto-deduct when this dish is sold.
                  </p>
                ) : (
                  <>
                    <ul className="mt-3 divide-y divide-stone-100 text-sm">
                      {recipe.map((line) => {
                        const ing = inventory.find((i) => i.id === line.inventoryId);
                        return (
                          <li key={line.inventoryId} className="flex items-center justify-between gap-2 py-1">
                            <span className="min-w-0 truncate text-stone-700">
                              {line.name ?? ing?.name ?? 'Unknown'}
                              {ing && ing.health !== 'ok' ? (
                                <Badge tone={HEALTH[ing.health].tone} className="ml-1.5 !px-1.5 !py-0 text-xs">
                                  {ing.health}
                                </Badge>
                              ) : null}
                            </span>
                            <span className="shrink-0 tabular-nums text-stone-500">
                              {qty(line.qty)} {line.unit ?? ing?.unit ?? ''}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                    <p className="mt-auto flex justify-between border-t border-stone-100 pt-2 text-xs text-stone-500">
                      <span>Food cost / portion</span>
                      <span className="font-medium tabular-nums text-stone-700">
                        {money(cost)}
                        {dish.price > 0 ? <span className="font-normal text-stone-500"> · {percent(cost / dish.price)}</span> : null}
                      </span>
                    </p>
                  </>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

'use client';

import { useMemo, useState } from 'react';
import type { InventoryItem, MenuItem } from '@/types';
import { menuApi } from '@/lib/api';
import { errorMessage, money, percent } from '@/lib/format';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { HEALTH, qty as fmtQty, recipeCost, toNumber } from './helpers';

interface Row {
  key: number;
  inventoryId: string;
  qty: string;
}

let rowSeq = 0;
const newRow = (inventoryId = '', qty = ''): Row => ({ key: ++rowSeq, inventoryId, qty });

/**
 * Modal editor for a dish's bill of materials — which ingredients, and how much
 * of each, one portion uses (US8.2). Saving replaces the recipe via
 * PUT /menu/items/:id/recipe; closing an order then deducts these amounts (US8.3).
 */
export function RecipeEditor({
  item,
  inventory,
  onClose,
  onSaved,
}: {
  item: MenuItem;
  inventory: InventoryItem[];
  onClose: () => void;
  onSaved: (item: MenuItem) => void;
}) {
  const toast = useToast();
  const [rows, setRows] = useState<Row[]>(() =>
    (item.recipe ?? []).map((r) => newRow(r.inventoryId, String(r.qty))),
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const byCategory = useMemo(() => {
    const groups = new Map<string, InventoryItem[]>();
    for (const ing of [...inventory].sort((a, b) => a.name.localeCompare(b.name))) {
      groups.set(ing.category, [...(groups.get(ing.category) ?? []), ing]);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [inventory]);

  const lines = rows
    .filter((r) => r.inventoryId && toNumber(r.qty) > 0)
    .map((r) => ({ inventoryId: r.inventoryId, qty: toNumber(r.qty) }));
  const cost = recipeCost(lines, inventory);

  function patch(key: number, change: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...change } : r)));
    setError('');
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const filled = rows.filter((r) => r.inventoryId || r.qty.trim());
    if (filled.some((r) => !r.inventoryId)) return setError('Choose an ingredient for every row (or remove the row).');
    if (filled.some((r) => !(toNumber(r.qty) > 0))) return setError('Each ingredient quantity must be greater than zero.');

    setSaving(true);
    try {
      const recipe = filled.map((r) => ({ inventoryId: r.inventoryId, qty: toNumber(r.qty) }));
      const { item: updated } = await menuApi.setRecipe(item.id, recipe);
      toast(
        recipe.length
          ? `Recipe for ${item.name} saved (${recipe.length} ingredient${recipe.length === 1 ? '' : 's'}).`
          : `Recipe for ${item.name} cleared.`,
        'success',
      );
      onSaved(updated);
    } catch (err) {
      toast(errorMessage(err, 'Failed to save recipe.'), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={`Recipe · ${item.name}`} onClose={onClose} wide>
      <form onSubmit={save} className="space-y-4">
        <p className="text-sm text-stone-500">
          Quantities are for <span className="font-medium text-stone-700">one portion</span>. When an order with this
          dish is closed, these amounts are deducted from inventory automatically.
        </p>

        {inventory.length === 0 ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            No ingredients in inventory yet — add some on the Inventory page first.
          </p>
        ) : null}

        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-800">
            No ingredients — stock won&apos;t auto-deduct when this dish is sold.
          </p>
        ) : (
          <div className="space-y-2">
            <div className="hidden grid-cols-[1fr_8.5rem_5rem_2rem] gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-stone-400 sm:grid">
              <span>Ingredient</span>
              <span>Qty / portion</span>
              <span className="text-right">Cost</span>
              <span />
            </div>
            {rows.map((row) => {
              const ing = inventory.find((i) => i.id === row.inventoryId);
              const taken = new Set(rows.filter((r) => r.key !== row.key).map((r) => r.inventoryId));
              const q = toNumber(row.qty);
              return (
                <div
                  key={row.key}
                  className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-lg border border-stone-100 p-2 sm:grid-cols-[1fr_8.5rem_5rem_2rem] sm:border-0 sm:p-0"
                >
                  <select
                    className="input col-span-2 sm:col-span-1"
                    aria-label="Ingredient"
                    value={row.inventoryId}
                    onChange={(e) => patch(row.key, { inventoryId: e.target.value })}
                  >
                    <option value="">Select ingredient…</option>
                    {byCategory.map(([category, list]) => (
                      <optgroup key={category} label={category}>
                        {list.map((i) => (
                          <option key={i.id} value={i.id} disabled={taken.has(i.id)}>
                            {i.name} ({i.unit}){i.health === 'low' ? ' · low stock' : ''}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <div className="flex items-center gap-1.5">
                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="any"
                      inputMode="decimal"
                      aria-label={`Quantity${ing ? ` of ${ing.name}` : ''}`}
                      placeholder="0"
                      value={row.qty}
                      onChange={(e) => patch(row.key, { qty: e.target.value })}
                    />
                    <span className="w-10 shrink-0 text-xs text-stone-500">{ing?.unit ?? ''}</span>
                  </div>
                  <span className="hidden text-right text-sm text-stone-500 sm:block">
                    {ing && q > 0 ? money(ing.costPerUnit * q) : '—'}
                  </span>
                  <button
                    type="button"
                    className="justify-self-end rounded p-1 text-stone-400 hover:bg-red-50 hover:text-red-600"
                    aria-label={`Remove ${ing?.name ?? 'row'}`}
                    onClick={() => setRows((prev) => prev.filter((r) => r.key !== row.key))}
                  >
                    ✕
                  </button>
                  {ing && ing.health !== 'ok' ? (
                    <p className={`col-span-2 text-xs sm:col-span-4 ${ing.health === 'low' ? 'text-red-600' : 'text-amber-600'}`}>
                      {HEALTH[ing.health].label}: {fmtQty(ing.stock)} {ing.unit} in stock
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}

        <button
          type="button"
          className="text-sm font-medium text-brand-600 hover:underline disabled:opacity-50"
          disabled={inventory.length === 0 || rows.length >= inventory.length}
          onClick={() => setRows((prev) => [...prev, newRow()])}
        >
          + Add ingredient
        </button>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-stone-50 px-3 py-2 text-sm">
          <span className="text-stone-500">Food cost per portion</span>
          <span className="font-semibold text-stone-800">
            {money(cost)}
            {item.price > 0 ? (
              <span className="ml-2 font-normal text-stone-500">{percent(cost / item.price)} of {money(item.price)}</span>
            ) : null}
          </span>
        </div>

        {error ? (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save recipe'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

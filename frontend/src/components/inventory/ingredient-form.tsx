'use client';

import { useState } from 'react';
import type { InventoryItem } from '@/types';
import { qty, toNumber } from './helpers';

interface Draft {
  name: string;
  category: string;
  unit: string;
  stock: string;
  reorderLevel: string;
  costPerUnit: string;
  supplier: string;
}

/**
 * Add / edit an ingredient (US8.1, manager/admin). On edit, changing "stock on
 * hand" is logged as a stock-count movement; use Adjust for deliveries/wastage.
 */
export function IngredientForm({
  initial,
  units,
  categories,
  suppliers,
  onSubmit,
  onCancel,
  submitting,
}: {
  initial?: InventoryItem | null;
  units: string[];
  categories: string[];
  suppliers: string[];
  onSubmit: (data: Partial<InventoryItem>) => void;
  onCancel: () => void;
  submitting?: boolean;
}) {
  const [draft, setDraft] = useState<Draft>(() => ({
    name: initial?.name ?? '',
    category: initial?.category ?? '',
    unit: initial?.unit ?? (units.includes('kg') ? 'kg' : units[0] ?? ''),
    stock: initial ? String(initial.stock) : '',
    reorderLevel: initial ? String(initial.reorderLevel) : '',
    costPerUnit: initial ? String(initial.costPerUnit) : '',
    supplier: initial?.supplier ?? '',
  }));
  const [error, setError] = useState('');

  const set = (key: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setDraft((d) => ({ ...d, [key]: e.target.value }));
    setError('');
  };

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.name.trim()) return setError('Ingredient name is required.');
    if (!draft.category.trim()) return setError('Category is required.');
    const numbers = {
      stock: draft.stock.trim() === '' ? 0 : toNumber(draft.stock),
      reorderLevel: draft.reorderLevel.trim() === '' ? 0 : toNumber(draft.reorderLevel),
      costPerUnit: draft.costPerUnit.trim() === '' ? 0 : toNumber(draft.costPerUnit),
    };
    const labels = { stock: 'Stock', reorderLevel: 'Reorder level', costPerUnit: 'Cost per unit' };
    for (const key of Object.keys(numbers) as (keyof typeof numbers)[]) {
      if (!(numbers[key] >= 0)) return setError(`${labels[key]} must be zero or more.`);
    }

    const data: Partial<InventoryItem> = {
      name: draft.name.trim(),
      category: draft.category.trim(),
      unit: draft.unit,
      reorderLevel: numbers.reorderLevel,
      costPerUnit: numbers.costPerUnit,
      supplier: draft.supplier.trim(),
    };
    // Only send stock when it changed, so an edit doesn't log a no-op count.
    if (!initial || numbers.stock !== initial.stock) data.stock = numbers.stock;
    onSubmit(data);
  }

  const stockChanged = initial && draft.stock.trim() !== '' && toNumber(draft.stock) !== initial.stock;

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="ing-name">
            Name *
          </label>
          <input id="ing-name" className="input" required value={draft.name} onChange={set('name')} />
        </div>
        <div>
          <label className="label" htmlFor="ing-category">
            Category *
          </label>
          <input
            id="ing-category"
            className="input"
            list="ing-categories"
            required
            placeholder="e.g. Produce"
            value={draft.category}
            onChange={set('category')}
          />
          <datalist id="ing-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="label" htmlFor="ing-unit">
            Unit *
          </label>
          <select id="ing-unit" className="input" value={draft.unit} onChange={set('unit')}>
            {units.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="ing-stock">
            {initial ? 'Stock on hand (count)' : 'Opening stock'}
          </label>
          <div className="flex items-center gap-2">
            <input
              id="ing-stock"
              className="input"
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              placeholder="0"
              value={draft.stock}
              onChange={set('stock')}
            />
            <span className="w-12 shrink-0 text-sm text-stone-500">{draft.unit}</span>
          </div>
          {stockChanged ? (
            <p className="mt-1 text-xs text-blue-700">
              Recorded as a stock count ({qty(initial.stock)} → {draft.stock} {draft.unit}).
            </p>
          ) : null}
        </div>
        <div>
          <label className="label" htmlFor="ing-reorder">
            Reorder level
          </label>
          <div className="flex items-center gap-2">
            <input
              id="ing-reorder"
              className="input"
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              placeholder="0"
              value={draft.reorderLevel}
              onChange={set('reorderLevel')}
            />
            <span className="w-12 shrink-0 text-sm text-stone-500">{draft.unit}</span>
          </div>
          <p className="mt-1 text-xs text-stone-400">At or below this, the item is flagged low and managers are alerted.</p>
        </div>
        <div>
          <label className="label" htmlFor="ing-cost">
            Cost per {draft.unit || 'unit'} (USD)
          </label>
          <input
            id="ing-cost"
            className="input"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            placeholder="0.00"
            value={draft.costPerUnit}
            onChange={set('costPerUnit')}
          />
        </div>
        <div>
          <label className="label" htmlFor="ing-supplier">
            Supplier
          </label>
          <input
            id="ing-supplier"
            className="input"
            list="ing-suppliers"
            value={draft.supplier}
            onChange={set('supplier')}
          />
          <datalist id="ing-suppliers">
            {suppliers.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Saving…' : initial ? 'Save changes' : 'Add ingredient'}
        </button>
      </div>
    </form>
  );
}

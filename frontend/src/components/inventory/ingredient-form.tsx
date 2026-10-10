'use client';

import { useState } from 'react';
import type { InventoryItem } from '@/types';
import { FieldError, SubmitHint, describedBy } from '@/components/forms/field-error';
import { TONES } from '@/components/forms/tone';
import { validateMaxLength, validateNumberInRange } from '@/lib/validation/fields';
import { useFormValidation, type Rules } from '@/lib/validation/use-form-validation';
import { qty, toNumber } from './helpers';

/** Limits from server/src/routes/inventory.js. */
export const INVENTORY_LIMITS = { name: 80, category: 60, supplier: 120, amount: 1_000_000 } as const;
const ERR = TONES.light.inputError;

const amount = (label: string) => (v: string) =>
  validateNumberInRange(v, 0, INVENTORY_LIMITS.amount, label, { required: false });

interface Draft {
  name: string;
  category: string;
  unit: string;
  stock: string;
  reorderLevel: string;
  costPerUnit: string;
  supplier: string;
}

const RULES: Rules<Draft> = {
  name: (v) => (v.trim() ? validateMaxLength(v.trim(), INVENTORY_LIMITS.name, 'Name') : 'Ingredient name is required.'),
  category: (v) => (v.trim() ? validateMaxLength(v.trim(), INVENTORY_LIMITS.category, 'Category') : 'Category is required.'),
  stock: amount('Stock'),
  reorderLevel: amount('Reorder level'),
  costPerUnit: amount('Cost per unit'),
  supplier: (v) => validateMaxLength(v.trim(), INVENTORY_LIMITS.supplier, 'Supplier'),
};
const LABELS = {
  name: 'Name',
  category: 'Category',
  stock: 'Stock',
  reorderLevel: 'Reorder level',
  costPerUnit: 'Cost per unit',
  supplier: 'Supplier',
};

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
  const v = useFormValidation(draft, RULES, { labels: LABELS });
  const errors = v.errors;

  const set = (key: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setDraft((d) => ({ ...d, [key]: e.target.value }));
  };

  /** aria and error-border props for one field. */
  const invalid = (key: keyof Draft, extra?: string) => ({
    'aria-invalid': Boolean(errors[key]) || undefined,
    'aria-describedby': describedBy(extra, errors[key] && `ing-${key}-err`),
    onBlur: () => v.blur(key),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!v.touchAll()) return;
    const numbers = {
      stock: draft.stock.trim() === '' ? 0 : toNumber(draft.stock),
      reorderLevel: draft.reorderLevel.trim() === '' ? 0 : toNumber(draft.reorderLevel),
      costPerUnit: draft.costPerUnit.trim() === '' ? 0 : toNumber(draft.costPerUnit),
    };

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
    <form onSubmit={submit} noValidate className="space-y-3 sm:space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="ing-name">
            Name *
          </label>
          <input
            id="ing-name"
            className={`input ${errors.name ? ERR : ''}`}
            required
            maxLength={INVENTORY_LIMITS.name}
            placeholder="e.g. Fresh basil"
            value={draft.name}
            onChange={set('name')}
            {...invalid('name')}
          />
          <FieldError id="ing-name-err" message={errors.name} />
        </div>
        <div>
          <label className="label" htmlFor="ing-category">
            Category *
          </label>
          <input
            id="ing-category"
            className={`input ${errors.category ? ERR : ''}`}
            list="ing-categories"
            required
            maxLength={INVENTORY_LIMITS.category}
            placeholder="e.g. Produce"
            value={draft.category}
            onChange={set('category')}
            {...invalid('category')}
          />
          <FieldError id="ing-category-err" message={errors.category} />
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
              className={`input ${errors.stock ? ERR : ''}`}
              type="number"
              min="0"
              max={INVENTORY_LIMITS.amount}
              step="any"
              inputMode="decimal"
              placeholder="e.g. 12"
              value={draft.stock}
              onChange={set('stock')}
              {...invalid('stock')}
            />
            <span className="w-12 shrink-0 text-sm text-stone-500">{draft.unit}</span>
          </div>
          <FieldError id="ing-stock-err" message={errors.stock} />
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
              className={`input ${errors.reorderLevel ? ERR : ''}`}
              type="number"
              min="0"
              max={INVENTORY_LIMITS.amount}
              step="any"
              inputMode="decimal"
              placeholder="e.g. 5"
              value={draft.reorderLevel}
              onChange={set('reorderLevel')}
              {...invalid('reorderLevel', 'ing-reorder-hint')}
            />
            <span className="w-12 shrink-0 text-sm text-stone-500">{draft.unit}</span>
          </div>
          <FieldError id="ing-reorderLevel-err" message={errors.reorderLevel} />
          <p id="ing-reorder-hint" className="mt-1 text-xs text-stone-500">
            At or below this, the item is flagged low and managers are alerted.
          </p>
        </div>
        <div>
          <label className="label" htmlFor="ing-cost">
            Cost per {draft.unit || 'unit'} (USD)
          </label>
          <input
            id="ing-cost"
            className={`input ${errors.costPerUnit ? ERR : ''}`}
            type="number"
            min="0"
            max={INVENTORY_LIMITS.amount}
            step="0.01"
            inputMode="decimal"
            placeholder="e.g. 2.40"
            value={draft.costPerUnit}
            onChange={set('costPerUnit')}
            {...invalid('costPerUnit')}
          />
          <FieldError id="ing-costPerUnit-err" message={errors.costPerUnit} />
        </div>
        <div>
          <label className="label" htmlFor="ing-supplier">
            Supplier
          </label>
          <input
            id="ing-supplier"
            className={`input ${errors.supplier ? ERR : ''}`}
            list="ing-suppliers"
            maxLength={INVENTORY_LIMITS.supplier}
            placeholder="e.g. Green Valley Farms"
            value={draft.supplier}
            onChange={set('supplier')}
            {...invalid('supplier')}
          />
          <FieldError id="ing-supplier-err" message={errors.supplier} />
          <datalist id="ing-suppliers">
            {suppliers.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
      </div>

      <div className="space-y-2">
        <SubmitHint id="ing-submit-hint" fields={v.invalidLabels} className="text-right" />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={submitting || !v.isValid}
            aria-disabled={submitting || !v.isValid}
            aria-describedby={v.isValid ? undefined : 'ing-submit-hint'}
          >
            {submitting ? 'Saving…' : initial ? 'Save changes' : 'Add ingredient'}
          </button>
        </div>
      </div>
    </form>
  );
}

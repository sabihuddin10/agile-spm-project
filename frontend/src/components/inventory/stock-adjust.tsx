'use client';

import { useState } from 'react';
import type { InventoryItem } from '@/types';
import { inventoryApi } from '@/lib/api';
import { errorMessage } from '@/lib/format';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { HEALTH, qty as fmt, toNumber } from './helpers';

type Mode = 'receive' | 'waste';

/**
 * Manual stock adjustment (US8.1; chef, manager, admin): receive a delivery
 * (+) or record wastage (−). Sends { delta }, which the server logs as a
 * restock / wastage movement (US8.3) and alerts managers when it crosses the
 * reorder level (US8.4).
 */
export function StockAdjust({
  item,
  onClose,
  onSaved,
}: {
  item: InventoryItem;
  onClose: () => void;
  onSaved: (item: InventoryItem) => void;
}) {
  const toast = useToast();
  const [mode, setMode] = useState<Mode>('receive');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const value = toNumber(amount);
  const valid = value > 0 && (mode === 'receive' || value <= item.stock);
  const after = valid ? Math.max(0, item.stock + (mode === 'receive' ? value : -value)) : null;
  const willAlert = after !== null && item.stock > item.reorderLevel && after <= item.reorderLevel;
  const overWaste =
    mode === 'waste' && value > item.stock
      ? `Only ${fmt(item.stock)} ${item.unit} in stock — you can't record more wastage than that.`
      : '';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!(value > 0)) return setError('Enter a quantity greater than zero.');
    if (overWaste) return setError(overWaste);
    setSaving(true);
    try {
      const { item: updated } = await inventoryApi.update(item.id, { delta: mode === 'receive' ? value : -value });
      toast(
        mode === 'receive'
          ? `Received ${fmt(value)} ${item.unit} of ${item.name}.`
          : `Recorded ${fmt(value)} ${item.unit} of ${item.name} as wastage.`,
        'success',
      );
      onSaved(updated);
    } catch (err) {
      toast(errorMessage(err, 'Failed to adjust stock.'), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={`Adjust stock · ${item.name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-stone-50 px-3 py-2 text-sm">
          <span>
            In stock: <span className="font-semibold">{fmt(item.stock)} {item.unit}</span>
          </span>
          <span className="text-stone-500">
            Reorder at {fmt(item.reorderLevel)} {item.unit}
          </span>
          <Badge tone={HEALTH[item.health].tone}>{HEALTH[item.health].label}</Badge>
        </div>

        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Adjustment type">
          {(
            [
              { id: 'receive', title: 'Receive stock', hint: 'Delivery or transfer in (+)', on: 'border-emerald-400 bg-emerald-50 text-emerald-800' },
              { id: 'waste', title: 'Record wastage', hint: 'Spoiled, dropped, expired (−)', on: 'border-red-400 bg-red-50 text-red-800' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={mode === opt.id}
              onClick={() => {
                setMode(opt.id);
                setError('');
              }}
              className={`rounded-lg border px-3 py-2 text-left transition ${
                mode === opt.id ? opt.on : 'border-stone-200 text-stone-600 hover:bg-stone-50'
              }`}
            >
              <span className="block text-sm font-semibold">{opt.title}</span>
              <span className="block text-xs opacity-75">{opt.hint}</span>
            </button>
          ))}
        </div>

        <div>
          <label className="label" htmlFor="adjust-qty">
            Quantity
          </label>
          <div className="flex items-center gap-2">
            <input
              id="adjust-qty"
              className="input"
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              autoFocus
              placeholder="e.g. 5"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setError('');
              }}
            />
            <span className="w-12 shrink-0 text-sm text-stone-500">{item.unit}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[1, 5, 10, 25].map((n) => (
              <button
                key={n}
                type="button"
                className="rounded-full border border-stone-200 px-2.5 py-0.5 text-xs text-stone-600 hover:bg-stone-50"
                onClick={() => {
                  setAmount(String(n));
                  setError('');
                }}
              >
                {n} {item.unit}
              </button>
            ))}
          </div>
        </div>

        {after !== null ? (
          <p className="text-sm text-stone-600">
            New stock:{' '}
            <span className={`font-semibold ${mode === 'receive' ? 'text-emerald-700' : 'text-red-700'}`}>
              {fmt(after)} {item.unit}
            </span>
            {willAlert ? (
              <span className="mt-1 block text-xs text-red-600">This drops it to its reorder level — managers will get a low-stock alert.</span>
            ) : null}
          </p>
        ) : null}

        {error || overWaste ? (
          <p role="alert" className="text-sm text-red-600">
            {error || overWaste}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={mode === 'receive' ? 'btn-primary' : 'btn-danger'} disabled={saving || !valid}>
            {saving ? 'Saving…' : mode === 'receive' ? 'Receive stock' : 'Record wastage'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

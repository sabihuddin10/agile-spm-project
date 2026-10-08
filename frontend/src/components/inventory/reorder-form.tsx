'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { InventoryItem, PurchaseOrder } from '@/types';
import { inventoryApi, settingsApi } from '@/lib/api';
import { errorMessage, formatDateTime, money } from '@/lib/format';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/components/ui/toast';
import { Spinner } from '@/components/ui/spinner';
import { qty, suggestedQty, toNumber } from './helpers';

interface Line {
  inventoryId: string;
  name: string;
  unit: string;
  supplier: string;
  stock: number;
  reorderLevel: number;
  costPerUnit: number;
  suggested: number;
  qty: string;
}

/**
 * Supplier reorder form (US8.5, manager/admin): starts from the server's
 * low-stock suggestions, lets the manager edit quantities, drop or add lines
 * and add notes, prints cleanly (.print-area) and submits as a purchase order.
 * `reloadKey` changes reload the suggestions (e.g. after stock is received).
 */
export function ReorderForm({
  inventory,
  reloadKey = 0,
  onSubmitted,
}: {
  inventory: InventoryItem[];
  reloadKey?: number;
  onSubmitted: (po: PurchaseOrder) => void;
}) {
  const { user } = useAuth();
  const toast = useToast();
  const [lines, setLines] = useState<Line[]>([]);
  const [notes, setNotes] = useState('');
  const [addId, setAddId] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [restaurant, setRestaurant] = useState({ name: 'Plate & Flame', address: '' });
  const [preparedAt, setPreparedAt] = useState(() => new Date().toISOString());

  const loadSuggestions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await inventoryApi.reorder();
      setLines(
        res.lines.map((l) => ({
          inventoryId: l.inventoryId,
          name: l.name,
          unit: l.unit,
          supplier: l.supplier,
          stock: l.stock,
          reorderLevel: l.reorderLevel,
          costPerUnit: l.costPerUnit,
          suggested: l.suggestedQty,
          qty: String(l.suggestedQty),
        })),
      );
      setPreparedAt(new Date().toISOString());
    } catch (err) {
      toast(errorMessage(err, 'Failed to load reorder suggestions.'), 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadSuggestions();
  }, [loadSuggestions, reloadKey]);

  useEffect(() => {
    settingsApi
      .get()
      .then(({ settings }) => setRestaurant({ name: settings.restaurantName, address: settings.address }))
      .catch(() => undefined); // header falls back to the default name
  }, []);

  const groups = useMemo(() => {
    const map = new Map<string, Line[]>();
    for (const l of lines) map.set(l.supplier || 'No supplier set', [...(map.get(l.supplier || 'No supplier set') ?? []), l]);
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [lines]);

  const lineCost = (l: Line) => {
    const q = toNumber(l.qty);
    return q > 0 ? q * l.costPerUnit : 0;
  };
  const total = lines.reduce((s, l) => s + lineCost(l), 0);
  const addable = inventory
    .filter((i) => !lines.some((l) => l.inventoryId === i.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  function setQty(id: string, value: string) {
    setLines((prev) => prev.map((l) => (l.inventoryId === id ? { ...l, qty: value } : l)));
  }

  function addLine() {
    const ing = inventory.find((i) => i.id === addId);
    if (!ing) return;
    const suggested = suggestedQty(ing);
    setLines((prev) => [
      ...prev,
      {
        inventoryId: ing.id,
        name: ing.name,
        unit: ing.unit,
        supplier: ing.supplier,
        stock: ing.stock,
        reorderLevel: ing.reorderLevel,
        costPerUnit: ing.costPerUnit,
        suggested,
        qty: String(suggested),
      },
    ]);
    setAddId('');
  }

  async function submit() {
    if (lines.length === 0) return toast('Add at least one ingredient to the reorder form.', 'error');
    const bad = lines.find((l) => !(toNumber(l.qty) > 0));
    if (bad) return toast(`Quantity for ${bad.name} must be greater than zero.`, 'error');
    const suppliers = groups.length;
    if (!window.confirm(`Send this order (${lines.length} line${lines.length === 1 ? '' : 's'}, ${money(total)}) to ${suppliers} supplier${suppliers === 1 ? '' : 's'}?`)) {
      return;
    }
    setSubmitting(true);
    try {
      const { purchaseOrder } = await inventoryApi.createPurchaseOrder(
        lines.map((l) => ({ inventoryId: l.inventoryId, qty: toNumber(l.qty) })),
        notes.trim(),
      );
      toast(`${purchaseOrder.number} sent to suppliers · ${money(purchaseOrder.total)}.`, 'success');
      setNotes('');
      onSubmitted(purchaseOrder);
      await loadSuggestions();
    } catch (err) {
      toast(errorMessage(err, 'Failed to submit the reorder form.'), 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div id="reorder-form" className="scroll-mt-6">
      <div className="no-print mb-3 flex flex-wrap items-center gap-2">
        <div className="flex-1">
          <h2 className="font-semibold text-stone-800">Supplier reorder form</h2>
          <p className="text-sm text-stone-500">
            Pre-filled with every ingredient at or below its reorder level, topped back up to twice that level.
          </p>
        </div>
        <button type="button" className="btn-ghost text-xs" onClick={loadSuggestions} disabled={loading || submitting}>
          ↻ Reset to suggestions
        </button>
      </div>

      <div className="print-area rounded-xl border border-stone-200 bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-200 pb-3">
          <div>
            <p className="text-lg font-bold text-stone-900">{restaurant.name}</p>
            {restaurant.address ? <p className="text-xs text-stone-500">{restaurant.address}</p> : null}
            <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-stone-500">Purchase order request</p>
          </div>
          <div className="text-right text-xs text-stone-500">
            <p>Prepared {formatDateTime(preparedAt)}</p>
            {user ? <p>By {user.name}</p> : null}
          </div>
        </div>

        {loading ? (
          <Spinner label="Loading reorder suggestions…" />
        ) : lines.length === 0 ? (
          <p className="py-8 text-center text-sm text-stone-400">
            Nothing is low right now. Add any ingredient below to order it anyway.
          </p>
        ) : (
          <div className="-mx-4 overflow-x-auto sm:-mx-5">
            <table className="table-base min-w-[720px]">
              <thead>
                <tr>
                  <th>Ingredient</th>
                  <th className="text-right">In stock</th>
                  <th className="text-right">Reorder at</th>
                  <th>Order qty</th>
                  <th className="text-right">Unit cost</th>
                  <th className="text-right">Est. cost</th>
                  <th className="no-print w-8">
                    <span className="sr-only">Remove</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {groups.map(([supplier, list]) => (
                  <SupplierGroup
                    key={supplier}
                    supplier={supplier}
                    lines={list}
                    lineCost={lineCost}
                    onQty={setQty}
                    onRemove={(id) => setLines((prev) => prev.filter((l) => l.inventoryId !== id))}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="no-print mt-3 flex flex-col gap-2 sm:flex-row">
          <select
            className="input sm:max-w-xs"
            aria-label="Add another ingredient"
            value={addId}
            onChange={(e) => setAddId(e.target.value)}
          >
            <option value="">Add another ingredient…</option>
            {addable.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name} — {qty(i.stock)} {i.unit} in stock
              </option>
            ))}
          </select>
          <button type="button" className="btn-secondary" onClick={addLine} disabled={!addId}>
            + Add line
          </button>
        </div>

        <div className="mt-4">
          <label className="label" htmlFor="reorder-notes">
            Notes for suppliers
          </label>
          <textarea
            id="reorder-notes"
            className="input min-h-[60px] print:hidden"
            placeholder="e.g. Deliver before Friday lunch service; call on arrival."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <p className="hidden whitespace-pre-wrap text-sm print:block">{notes || '—'}</p>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-stone-200 pt-3">
          <span className="text-sm text-stone-500">
            {lines.length} line{lines.length === 1 ? '' : 's'} · {groups.length} supplier{groups.length === 1 ? '' : 's'}
          </span>
          <span className="text-lg font-bold text-stone-900">Estimated total {money(total)}</span>
        </div>
      </div>

      <div className="no-print mt-3 flex flex-wrap justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={() => window.print()} disabled={lines.length === 0}>
          Print form
        </button>
        <button type="button" className="btn-primary" onClick={submit} disabled={submitting || loading || lines.length === 0}>
          {submitting ? 'Submitting…' : 'Submit to supplier'}
        </button>
      </div>
    </div>
  );
}

function SupplierGroup({
  supplier,
  lines,
  lineCost,
  onQty,
  onRemove,
}: {
  supplier: string;
  lines: Line[];
  lineCost: (l: Line) => number;
  onQty: (id: string, value: string) => void;
  onRemove: (id: string) => void;
}) {
  const subtotal = lines.reduce((s, l) => s + lineCost(l), 0);
  return (
    <>
      <tr className="bg-stone-50">
        <td colSpan={5} className="text-xs font-semibold uppercase tracking-wide text-stone-600">
          {supplier}
        </td>
        <td className="text-right text-xs font-semibold text-stone-600">{money(subtotal)}</td>
        <td className="no-print" />
      </tr>
      {lines.map((l) => {
        const q = toNumber(l.qty);
        return (
          <tr key={l.inventoryId}>
            <td className="font-medium text-stone-800">{l.name}</td>
            <td className={`text-right tabular-nums ${l.stock <= l.reorderLevel ? 'font-semibold text-red-600' : 'text-stone-500'}`}>
              {qty(l.stock)} {l.unit}
            </td>
            <td className="text-right tabular-nums text-stone-500">
              {qty(l.reorderLevel)} {l.unit}
            </td>
            <td>
              <div className="flex items-center gap-1.5 print:hidden">
                <input
                  className={`input !w-24 !py-1 ${q > 0 ? '' : '!border-red-400'}`}
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  aria-label={`Order quantity for ${l.name}`}
                  value={l.qty}
                  onChange={(e) => onQty(l.inventoryId, e.target.value)}
                />
                <span className="text-xs text-stone-500">{l.unit}</span>
              </div>
              <span className="hidden tabular-nums print:inline">
                {l.qty} {l.unit}
              </span>
              {q > 0 && q !== l.suggested ? (
                <span className="no-print mt-0.5 block text-[11px] text-stone-400">
                  suggested {qty(l.suggested)}
                </span>
              ) : null}
            </td>
            <td className="text-right tabular-nums text-stone-500">{money(l.costPerUnit)}</td>
            <td className="text-right tabular-nums font-medium">{money(lineCost(l))}</td>
            <td className="no-print text-right">
              <button
                type="button"
                className="rounded p-1 text-stone-400 hover:bg-red-50 hover:text-red-600"
                aria-label={`Remove ${l.name} from the order`}
                onClick={() => onRemove(l.inventoryId)}
              >
                ✕
              </button>
            </td>
          </tr>
        );
      })}
    </>
  );
}

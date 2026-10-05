'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Customer, Order, Table } from '@/types';
import { orderApi, tableApi } from '@/lib/api';
import { TABLE_STATUS, errorMessage } from '@/lib/format';
import { Modal } from '@/components/ui/modal';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/toast';
import { CustomerLookup } from './customer-lookup';
import { OrderLineEditor, indexMenu, toOrderLines, unavailableLines, type DraftLine } from './order-editor';
import { useOrderMenu } from './use-order-menu';

type Kind = 'dine-in' | 'takeaway';

const TABLE_HINT: Partial<Record<Table['status'], string>> = {
  occupied: 'This table is occupied — the order will be added to it.',
  reserved: 'This table is reserved — check the booking before seating guests.',
  cleaning: 'This table is marked for cleaning.',
};

/**
 * Take an order at the table or on the phone (US3.1, US3.5, US6.3): dine-in
 * (optionally linked to a table) or takeaway pickup, an optional ledger guest
 * whose allergies are surfaced (US1.5), the menu line editor and notes. Staff
 * either send it straight to the kitchen or hold it as "placed".
 */
export function NewOrderModal({ onClose, onCreated }: { onClose: () => void; onCreated: (order: Order) => void }) {
  const toast = useToast();
  const categories = useOrderMenu();
  const byId = useMemo(() => indexMenu(categories ?? []), [categories]);
  const [tables, setTables] = useState<Table[]>([]);
  const [kind, setKind] = useState<Kind>('dine-in');
  const [tableId, setTableId] = useState('');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [notes, setNotes] = useState('');
  const [pending, setPending] = useState<'send' | 'hold' | null>(null);

  useEffect(() => {
    let alive = true;
    tableApi
      .list()
      .then(({ tables: list }) => {
        if (alive) setTables([...list].sort((a, b) => a.number - b.number));
      })
      .catch((err) => {
        if (alive) toast(errorMessage(err, 'Failed to load tables.'), 'error');
      });
    return () => {
      alive = false;
    };
  }, [toast]);

  const requestClose = useCallback(() => {
    if (pending) return;
    if (lines.length > 0 && !window.confirm('Discard this order?')) return;
    onClose();
  }, [lines.length, onClose, pending]);

  const blocked = unavailableLines(lines, byId);
  const table = tables.find((t) => t.id === tableId);
  const canSubmit = lines.length > 0 && blocked.length === 0 && !pending;

  async function submit(sendToKitchen: boolean) {
    setPending(sendToKitchen ? 'send' : 'hold');
    try {
      const { order } = await orderApi.create({
        type: kind === 'dine-in' ? 'dine-in' : 'online',
        ...(kind === 'dine-in' ? { tableId: tableId || null } : { fulfillment: 'pickup' as const }),
        customerId: customer?.id ?? null,
        items: toOrderLines(lines),
        notes: notes.trim() || undefined,
        sendToKitchen,
      });
      toast(
        sendToKitchen
          ? `Order #${order.number} sent to the kitchen.`
          : `Order #${order.number} held as placed — confirm it to send it to the kitchen.`,
        'success',
      );
      onCreated(order);
    } catch (err) {
      toast(errorMessage(err, 'Failed to place the order.'), 'error');
    } finally {
      setPending(null);
    }
  }

  return (
    <Modal title="New order" onClose={requestClose} wide>
      <div className="space-y-5">
        {/* Order type */}
        <div>
          <p className="label">Order type</p>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Order type">
            {(
              [
                { key: 'dine-in', title: 'Dine-in', hint: 'Seated at a table' },
                { key: 'takeaway', title: 'Takeaway', hint: 'Collected at the counter' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.key}
                type="button"
                role="radio"
                aria-checked={kind === opt.key}
                onClick={() => setKind(opt.key)}
                className={`rounded-lg border px-3 py-2.5 text-left transition ${
                  kind === opt.key
                    ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500'
                    : 'border-stone-200 bg-white hover:bg-stone-50'
                }`}
              >
                <span className="block text-sm font-semibold text-stone-800">{opt.title}</span>
                <span className="block text-xs text-stone-500">{opt.hint}</span>
              </button>
            ))}
          </div>
        </div>

        {kind === 'dine-in' ? (
          <div>
            <label htmlFor="new-order-table" className="label">
              Table <span className="font-normal text-stone-400">(optional — you can assign it later)</span>
            </label>
            <select id="new-order-table" className="input" value={tableId} onChange={(e) => setTableId(e.target.value)}>
              <option value="">No table yet</option>
              {tables.map((t) => (
                <option key={t.id} value={t.id}>
                  Table {t.number} · {t.seats} seats · {t.zone} · {TABLE_STATUS[t.status].label}
                </option>
              ))}
            </select>
            {table && TABLE_HINT[table.status] ? (
              <p className="mt-1 text-xs text-amber-700">{TABLE_HINT[table.status]}</p>
            ) : null}
          </div>
        ) : (
          <p className="rounded-lg bg-stone-50 px-3 py-2 text-xs text-stone-500">
            Takeaway orders are queued as pickup orders and never take a table.
          </p>
        )}

        <div>
          <p className="label">Customer</p>
          <CustomerLookup value={customer} onChange={setCustomer} />
        </div>

        {categories === null ? (
          <Spinner label="Loading menu…" />
        ) : (
          <OrderLineEditor
            categories={categories}
            lines={lines}
            onChange={setLines}
            allergies={customer?.preferences.allergies}
          />
        )}

        <div>
          <label htmlFor="new-order-notes" className="label">
            Notes <span className="font-normal text-stone-400">(optional)</span>
          </label>
          <textarea
            id="new-order-notes"
            className="input min-h-[4.5rem]"
            maxLength={500}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. birthday — bring the dessert with a candle"
          />
        </div>

        {blocked.length > 0 ? (
          <p className="text-sm text-red-600">Remove unavailable dishes before placing the order.</p>
        ) : null}

        <div className="flex flex-col-reverse gap-2 border-t border-stone-200 pt-4 sm:flex-row sm:justify-end">
          <button type="button" className="btn-ghost" onClick={requestClose} disabled={Boolean(pending)}>
            Cancel
          </button>
          <button type="button" className="btn-secondary" onClick={() => submit(false)} disabled={!canSubmit}>
            {pending === 'hold' ? 'Holding…' : 'Hold as placed'}
          </button>
          <button type="button" className="btn-primary" onClick={() => submit(true)} disabled={!canSubmit}>
            {pending === 'send' ? 'Sending…' : 'Send to kitchen'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

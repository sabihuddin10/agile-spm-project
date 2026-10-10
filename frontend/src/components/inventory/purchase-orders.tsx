'use client';

import { useState } from 'react';
import type { PurchaseOrder } from '@/types';
import { inventoryApi } from '@/lib/api';
import { errorMessage, formatDateTime, money } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/toast';
import { qty } from './helpers';

/**
 * Submitted supplier reorders (US8.5). "Mark received" restocks every line,
 * which is logged as restock movements (US8.3).
 */
export function PurchaseOrders({
  orders,
  loading,
  onReceived,
}: {
  orders: PurchaseOrder[];
  loading?: boolean;
  onReceived: (po: PurchaseOrder) => void;
}) {
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<PurchaseOrder | null>(null);

  async function receive(po: PurchaseOrder) {
    setBusyId(po.id);
    try {
      const { purchaseOrder } = await inventoryApi.receivePurchaseOrder(po.id);
      toast(`${purchaseOrder.number} received — stock updated for ${purchaseOrder.lines.length} ingredients.`, 'success');
      setConfirming(null);
      onReceived(purchaseOrder);
    } catch (err) {
      toast(errorMessage(err, 'Failed to mark the order received.'), 'error');
    } finally {
      setBusyId(null);
    }
  }

  const openCount = orders.filter((o) => o.status === 'sent').length;

  return (
    <div className="no-print">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-stone-100 p-4">
        <h2 className="font-semibold text-stone-800">Purchase orders</h2>
        <span className="text-xs text-stone-500">
          {orders.length} total · {openCount} awaiting delivery
        </span>
      </div>

      {loading && orders.length === 0 ? (
        <Spinner label="Loading purchase orders…" />
      ) : orders.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-stone-500">
          No purchase orders yet. Submit the reorder form to send one.
        </p>
      ) : (
        <ul className="divide-y divide-stone-100">
          {orders.map((po) => {
            const open = expanded === po.id;
            const suppliers = Array.from(new Set(po.lines.map((l) => l.supplier || 'No supplier')));
            return (
              <li key={po.id} className="px-3.5 py-3 sm:p-4">
                <div className="flex flex-wrap items-start gap-x-4 gap-y-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <span className="font-mono text-sm font-semibold text-stone-800">{po.number}</span>
                      {po.status === 'received' ? (
                        <Badge tone="emerald">Received</Badge>
                      ) : (
                        <Badge tone="amber">Sent · awaiting delivery</Badge>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-stone-500">
                      Sent {formatDateTime(po.createdAt)}
                      {po.receivedAt ? ` · received ${formatDateTime(po.receivedAt)}` : ''}
                    </p>
                    <p className="mt-1 text-sm text-stone-600">
                      {po.lines.length} line{po.lines.length === 1 ? '' : 's'} · {suppliers.join(', ')}
                    </p>
                  </div>
                  <div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto sm:gap-2">
                    <span className="mr-auto text-sm font-bold tabular-nums text-stone-900 sm:mr-0">{money(po.total)}</span>
                    <button
                      type="button"
                      className="btn-sm btn-ghost"
                      aria-expanded={open}
                      onClick={() => setExpanded(open ? null : po.id)}
                    >
                      {open ? 'Hide lines' : 'View lines'}
                    </button>
                    {po.status === 'sent' ? (
                      <button
                        type="button"
                        className="btn-sm btn-primary"
                        disabled={busyId === po.id}
                        onClick={() => setConfirming(po)}
                      >
                        {busyId === po.id ? 'Receiving…' : 'Mark received'}
                      </button>
                    ) : null}
                  </div>
                </div>

                {open ? (
                  <div className="mt-2.5 rounded-lg border border-stone-100 bg-stone-50/60 sm:mt-3">
                    <ul className="divide-y divide-stone-100 text-sm">
                      {po.lines.map((l) => (
                        // Ingredient and supplier on the left; line cost over qty × unit price on the right.
                        <li key={l.inventoryId} className="flex items-start gap-2.5 px-2.5 py-2 sm:px-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-stone-700">{l.name}</p>
                            <p className="text-xs text-stone-500">{l.supplier || 'No supplier'}</p>
                          </div>
                          <div className="flex shrink-0 flex-col items-end">
                            <span className="font-medium tabular-nums text-stone-700">{money(l.cost)}</span>
                            <span className="text-xs tabular-nums text-stone-500">
                              {qty(l.qty)} {l.unit} × {money(l.costPerUnit)}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                    {po.notes ? <p className="border-t border-stone-100 px-3 py-2 text-xs text-stone-500">Notes: {po.notes}</p> : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {confirming ? (
        <ConfirmDialog
          title={`Mark ${confirming.number} as received?`}
          confirmLabel="Mark received"
          danger={false}
          busy={busyId === confirming.id}
          onConfirm={() => receive(confirming)}
          onCancel={() => setConfirming(null)}
        >
          <p>
            Stock for all {confirming.lines.length} line{confirming.lines.length === 1 ? '' : 's'} will be added and logged
            as restock movements.
          </p>
        </ConfirmDialog>
      ) : null}
    </div>
  );
}

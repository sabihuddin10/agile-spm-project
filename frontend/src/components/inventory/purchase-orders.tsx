'use client';

import { useState } from 'react';
import type { PurchaseOrder } from '@/types';
import { inventoryApi } from '@/lib/api';
import { errorMessage, formatDateTime, money } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
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

  async function receive(po: PurchaseOrder) {
    if (!window.confirm(`Mark ${po.number} as received? Stock for all ${po.lines.length} lines will be added.`)) return;
    setBusyId(po.id);
    try {
      const { purchaseOrder } = await inventoryApi.receivePurchaseOrder(po.id);
      toast(`${purchaseOrder.number} received — stock updated for ${purchaseOrder.lines.length} ingredients.`, 'success');
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
        <span className="text-xs text-stone-400">
          {orders.length} total · {openCount} awaiting delivery
        </span>
      </div>

      {loading && orders.length === 0 ? (
        <Spinner label="Loading purchase orders…" />
      ) : orders.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-stone-400">
          No purchase orders yet. Submit the reorder form to send one.
        </p>
      ) : (
        <ul className="divide-y divide-stone-100">
          {orders.map((po) => {
            const open = expanded === po.id;
            const suppliers = Array.from(new Set(po.lines.map((l) => l.supplier || 'No supplier')));
            return (
              <li key={po.id} className="p-4">
                <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
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
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-stone-900">{money(po.total)}</span>
                    <button
                      type="button"
                      className="btn-ghost !px-2 !py-1 text-xs"
                      aria-expanded={open}
                      onClick={() => setExpanded(open ? null : po.id)}
                    >
                      {open ? 'Hide lines' : 'View lines'}
                    </button>
                    {po.status === 'sent' ? (
                      <button
                        type="button"
                        className="btn-primary !px-2.5 !py-1 text-xs"
                        disabled={busyId === po.id}
                        onClick={() => receive(po)}
                      >
                        {busyId === po.id ? 'Receiving…' : 'Mark received'}
                      </button>
                    ) : null}
                  </div>
                </div>

                {open ? (
                  <div className="mt-3 rounded-lg border border-stone-100 bg-stone-50/60">
                    <ul className="divide-y divide-stone-100 text-sm">
                      {po.lines.map((l) => (
                        <li key={l.inventoryId} className="flex flex-wrap justify-between gap-2 px-3 py-1.5">
                          <span className="text-stone-700">
                            {l.name} <span className="text-xs text-stone-400">· {l.supplier || 'No supplier'}</span>
                          </span>
                          <span className="tabular-nums text-stone-500">
                            {qty(l.qty)} {l.unit} × {money(l.costPerUnit)} ={' '}
                            <span className="font-medium text-stone-700">{money(l.cost)}</span>
                          </span>
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
    </div>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { StaffLayout } from '@/components/layout/staff-layout';
import { orderApi } from '@/lib/api';
import type { Order } from '@/types';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { Spinner } from '@/components/ui/spinner';

const KITCHEN_STATES: Record<string, string> = {
  placed: 'New',
  confirmed: 'New',
  in_kitchen: 'In prep',
  ready: 'Ready',
};

export default function KitchenPage() {
  const toast = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await orderApi.list();
      const kitchen = res.orders.filter((o) => ['placed', 'confirmed', 'in_kitchen', 'ready'].includes(o.status));
      setOrders(kitchen);
    } catch {
      toast('Failed to load kitchen queue.', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function mark(itemId: string, orderId: string, status: string) {
    try {
      await orderApi.update(orderId, { itemId, itemStatus: status });
      toast('Item updated.', 'success');
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Update failed.', 'error');
    }
  }

  async function advanceOrder(order: Order) {
    const next = order.status === 'confirmed' ? 'in_kitchen' : order.status === 'in_kitchen' ? 'ready' : null;
    if (!next) return;
    try {
      await orderApi.update(order.id, { status: next });
      toast(`Order #${order.number} → ${next.replace('_', ' ')}`, 'success');
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Update failed.', 'error');
    }
  }

  return (
    <StaffLayout>
      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-2xl font-bold">Kitchen Display</h1>
        <Badge tone="amber">Sprint 4 · Live</Badge>
      </div>

      {loading ? (
        <Spinner label="Loading kitchen…" />
      ) : orders.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-sm text-stone-500">Kitchen is clear — no orders in prep.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {orders.map((order) => (
            <div
              key={order.id}
              className={`card p-5 ${
                order.status === 'ready' ? 'border-emerald-300 bg-emerald-50/40' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-stone-400">#{order.number}</span>
                  {order.tableNumber ? (
                    <Badge tone="blue">Table {order.tableNumber}</Badge>
                  ) : (
                    <Badge tone="brand">Takeaway</Badge>
                  )}
                </div>
                <Badge tone={order.status === 'ready' ? 'emerald' : 'amber'}>
                  {KITCHEN_STATES[order.status]}
                </Badge>
              </div>

              <p className="mt-1 text-xs text-stone-400">
                {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>

              <div className="mt-4 space-y-2 border-t border-stone-100 pt-3">
                {order.items.map((item) => {
                  const state = item.status;
                  return (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 ${
                        state === 'ready'
                          ? 'bg-emerald-100 text-emerald-800'
                          : state === 'served'
                            ? 'bg-stone-100 text-stone-400 line-through'
                            : 'bg-stone-50 text-stone-700'
                      }`}
                    >
                      <span>
                        <span className="font-semibold">{item.qty}×</span> {item.name}
                        {item.modifiers && item.modifiers.length ? (
                          <span className="ml-1 block text-xs text-stone-500">({item.modifiers.join(', ')})</span>
                        ) : null}
                      </span>
                      {state !== 'served' && state !== 'ready' ? (
                        <button
                          className="rounded bg-amber-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-amber-700"
                          onClick={() => mark(item.id, order.id, 'ready')}
                        >
                          Done
                        </button>
                      ) : state === 'ready' ? (
                        <Badge tone="emerald">Ready</Badge>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 border-t border-stone-100 pt-3">
                {order.status === 'ready' ? (
                  <span className="text-xs font-medium text-emerald-600">
                    Ready to serve — hand over to floor staff.
                  </span>
                ) : (
                  <button
                    className="btn-ghost !py-1.5 text-sm"
                    onClick={() => advanceOrder(order)}
                    disabled={order.status === 'placed' || order.status === 'confirmed' ? false : false}
                  >
                    {order.status === 'confirmed' ? 'Start cooking →' : 'Mark ready →'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </StaffLayout>
  );
}
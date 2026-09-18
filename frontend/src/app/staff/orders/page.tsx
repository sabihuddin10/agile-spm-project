'use client';

import { useCallback, useEffect, useState } from 'react';
import { StaffLayout } from '@/components/layout/staff-layout';
import { orderApi } from '@/lib/api';
import type { Order } from '@/types';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { Spinner } from '@/components/ui/spinner';

const STATUS_FLOW: { key: string; label: string; tone: string }[] = [
  { key: 'placed', label: 'Placed', tone: 'stone' },
  { key: 'confirmed', label: 'Confirmed', tone: 'blue' },
  { key: 'in_kitchen', label: 'In kitchen', tone: 'amber' },
  { key: 'ready', label: 'Ready', tone: 'emerald' },
  { key: 'served', label: 'Served', tone: 'emerald' },
  { key: 'paid', label: 'Paid', tone: 'brand' },
  { key: 'cancelled', label: 'Cancelled', tone: 'red' },
];

const NEXT: Record<string, string> = {
  placed: 'confirmed',
  confirmed: 'in_kitchen',
  in_kitchen: 'ready',
  ready: 'served',
};

export default function OrdersPage() {
  const toast = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await orderApi.list();
      setOrders(res.orders);
    } catch {
      toast('Failed to load orders.', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function advance(order: Order) {
    const next = NEXT[order.status];
    if (!next) return;
    try {
      await orderApi.update(order.id, { status: next });
      toast(`Order #${order.number} → ${next.replace('_', ' ')}`, 'success');
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Update failed.', 'error');
    }
  }

  async function cancel(order: Order) {
    try {
      await orderApi.update(order.id, { status: 'cancelled' });
      toast(`Order #${order.number} cancelled.`, 'success');
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Cancel failed.', 'error');
    }
  }

  const active = orders.filter((o) => o.status !== 'cancelled' && o.status !== 'paid');
  const history = orders.filter((o) => o.status === 'paid' || o.status === 'cancelled');

  return (
    <StaffLayout>
      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-2xl font-bold">Orders</h1>
        <Badge tone="blue">Sprint 3 · Live</Badge>
        <span className="ml-auto text-sm text-stone-500">{active.length} active order(s)</span>
      </div>

      {loading ? (
        <Spinner label="Loading orders…" />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            {active.length === 0 ? (
              <p className="text-sm text-stone-500">No active orders.</p>
            ) : (
              active.map((order) => {
                const step = STATUS_FLOW.findIndex((s) => s.key === order.status);
                const current = STATUS_FLOW[step];
                return (
                  <div key={order.id} className="card p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-semibold text-stone-400">#{order.number}</span>
                          {order.tableNumber ? (
                            <Badge tone="blue">Table {order.tableNumber}</Badge>
                          ) : (
                            <Badge tone="brand">Online</Badge>
                          )}
                          {order.customer ? (
                            <Badge tone="stone">{order.customer.name}</Badge>
                          ) : null}
                        </div>
                        <p className="mt-2 text-xs text-stone-400">
                          {new Date(order.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <Badge tone={current.tone as 'stone'}>{current.label}</Badge>
                    </div>

                    <div className="mt-4 space-y-1.5">
                      {order.items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between text-sm">
                          <span className="text-stone-700">
                            <span className="font-medium">{item.qty}×</span> {item.name}
                            {item.modifiers && item.modifiers.length ? (
                              <span className="ml-1 text-stone-400">({item.modifiers.join(', ')})</span>
                            ) : null}
                          </span>
                          <span className="text-stone-500">${(item.price * item.qty).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-3">
                      <span className="text-sm font-semibold">${order.total.toFixed(2)}</span>
                      <div className="flex gap-2">
                        {order.status === 'served' ? (
                          <span className="text-xs text-stone-400">Waiting on payment…</span>
                        ) : order.status === 'placed' ? (
                          <button className="btn-primary !py-1.5 text-sm" onClick={() => advance(order)}>
                            Confirm
                          </button>
                        ) : (
                          <button className="btn-primary !py-1.5 text-sm" onClick={() => advance(order)}>
                            Advance →
                          </button>
                        )}
                        {order.status !== 'paid' && order.status !== 'cancelled' ? (
                          <button className="btn-ghost !py-1.5 text-sm text-red-600" onClick={() => cancel(order)}>
                            Cancel
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {history.length > 0 ? (
            <div className="mt-8">
              <h2 className="mb-3 text-lg font-semibold">History</h2>
              <div className="card overflow-hidden p-0">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Type</th>
                      <th>Table</th>
                      <th>Status</th>
                      <th>Total</th>
                      <th>Placed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((o) => (
                      <tr key={o.id}>
                        <td className="font-mono text-stone-500">#{o.number}</td>
                        <td className="capitalize">{o.type}</td>
                        <td>{o.tableNumber ?? '—'}</td>
                        <td className="capitalize">{o.status}</td>
                        <td className="font-semibold">${o.total.toFixed(2)}</td>
                        <td className="text-stone-500">{new Date(o.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </>
      )}
    </StaffLayout>
  );
}
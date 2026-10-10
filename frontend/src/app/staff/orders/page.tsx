'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Order, OrderStatus, Table } from '@/types';
import { orderApi, tableApi } from '@/lib/api';
import { can, canAccess } from '@/lib/permissions';
import { errorMessage } from '@/lib/format';
import { useAuth } from '@/context/auth-context';
import { useNow, usePolling } from '@/hooks/use-polling';
import { StaffLayout } from '@/components/layout/staff-layout';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';
import { OrderCard } from '@/components/orders/order-card';
import { NewOrderModal } from '@/components/orders/new-order-modal';
import { EditItemsModal } from '@/components/orders/edit-items-modal';
import { OrderHistoryTable } from '@/components/orders/order-history-table';
import { useMenuIndex } from '@/components/orders/use-order-menu';
import { ACTIVE_ORDER_STATUSES } from '@/components/orders/labels';

type FilterKey = 'all' | 'placed' | 'kitchen' | 'ready' | 'served';

const FILTERS: { key: FilterKey; label: string; statuses: OrderStatus[]; empty: string }[] = [
  { key: 'all', label: 'All active', statuses: ACTIVE_ORDER_STATUSES, empty: 'No active orders right now.' },
  { key: 'placed', label: 'Needs confirmation', statuses: ['placed'], empty: 'Nothing waiting for confirmation.' },
  { key: 'kitchen', label: 'In kitchen', statuses: ['confirmed', 'preparing'], empty: 'The kitchen has nothing in progress.' },
  { key: 'ready', label: 'Ready to serve', statuses: ['ready'], empty: 'No orders waiting at the pass.' },
  { key: 'served', label: 'Awaiting payment', statuses: ['served'], empty: 'No served orders awaiting payment.' },
];

/** Floor priority: food at the pass first, then orders to confirm, then the rest; oldest first. */
const URGENCY: Partial<Record<OrderStatus, number>> = { ready: 0, placed: 1, confirmed: 2, preparing: 2, served: 3 };

/** Tables change far less often than orders, so they refresh on a slower cycle (and after order actions). */
const TABLES_REFRESH_MS = 30000;

/**
 * Live floor view of today's orders: take new orders, confirm / edit / cancel
 * placed ones, follow each order through its lifecycle, serve ready dishes,
 * assign tables, and review today's closed and cancelled orders. Orders refresh
 * every 5 seconds; each card has id="order-<number>" so the floor plan can link
 * straight to it.
 */
export default function OrdersPage() {
  const { user } = useAuth();
  const toast = useToast();
  const role = user?.role;
  const allowed = canAccess(role, 'orders');
  const now = useNow(30000);
  const menuById = useMenuIndex(allowed);

  const [orders, setOrders] = useState<Order[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [newOpen, setNewOpen] = useState(false);
  const [editing, setEditing] = useState<Order | null>(null);
  const seq = useRef(0);
  const lastError = useRef<string | null>(null);
  // Last payload applied, so a poll that returns the same data doesn't re-render every card.
  const ordersSig = useRef('');
  const tablesSig = useRef('');

  const loadTables = useCallback(async () => {
    try {
      const t = await tableApi.list();
      const sorted = [...t.tables].sort((a, b) => a.number - b.number);
      const sig = JSON.stringify(sorted);
      if (sig === tablesSig.current) return;
      tablesSig.current = sig;
      setTables(sorted);
    } catch {
      // The table picker just keeps its last list; the orders poll reports connection problems.
    }
  }, []);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    try {
      const o = await orderApi.list({ scope: 'today' });
      if (mine !== seq.current) return;
      const sig = JSON.stringify(o.orders);
      if (sig !== ordersSig.current) {
        ordersSig.current = sig;
        setOrders(o.orders);
      }
      setError(null);
      lastError.current = null;
    } catch (err) {
      if (mine !== seq.current) return;
      const message = errorMessage(err, 'Failed to load orders.');
      if (!lastError.current) toast(message, 'error');
      lastError.current = message;
      setError(message);
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (allowed) {
      load();
      loadTables();
    }
  }, [allowed, load, loadTables]);
  usePolling(load, 5000, allowed);
  usePolling(loadTables, TABLES_REFRESH_MS, allowed);

  const active = useMemo(
    () =>
      orders
        .filter((o) => ACTIVE_ORDER_STATUSES.includes(o.status))
        .sort((a, b) => (URGENCY[a.status] ?? 9) - (URGENCY[b.status] ?? 9) || a.createdAt.localeCompare(b.createdAt)),
    [orders],
  );
  const history = useMemo(
    () =>
      orders
        .filter((o) => o.status === 'closed' || o.status === 'cancelled')
        .sort((a, b) => (b.closedAt ?? b.cancelledAt ?? b.createdAt).localeCompare(a.closedAt ?? a.cancelledAt ?? a.createdAt)),
    [orders],
  );

  const current = FILTERS.find((f) => f.key === filter) ?? FILTERS[0];
  const shown = active.filter((o) => current.statuses.includes(o.status));

  const replaceOrder = useCallback(
    (updated: Order) => {
      setOrders((prev) =>
        prev.some((o) => o.id === updated.id) ? prev.map((o) => (o.id === updated.id ? updated : o)) : [updated, ...prev],
      );
      // The local merge no longer matches the last payload, so the next load must apply.
      ordersSig.current = '';
      load();
      // Assigning, serving or cancelling can change a table's status.
      loadTables();
    },
    [load, loadTables],
  );

  // Cards render after the first fetch, so a /staff/orders#order-<n> link has to scroll once they exist.
  const scrolledToHash = useRef(false);
  useEffect(() => {
    if (loading || scrolledToHash.current) return;
    scrolledToHash.current = true;
    const hash = window.location.hash.slice(1);
    if (hash.startsWith('order-')) document.getElementById(hash)?.scrollIntoView?.({ block: 'start' });
  }, [loading]);

  return (
    <StaffLayout section="orders">
      <PageHeader
        title="Orders"
        subtitle="Today's orders, live. Confirm new orders, serve what's ready, and assign tables."
        action={
          can.placeStaffOrders(role) ? (
            <button type="button" className="btn-primary" onClick={() => setNewOpen(true)}>
              + New order
            </button>
          ) : null
        }
      />

      {error && !loading ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          <span>Couldn&apos;t refresh orders: {error} Retrying automatically…</span>
          <button type="button" className="btn-sm btn-ghost text-red-700 hover:bg-red-100" onClick={() => load()}>
            Retry now
          </button>
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filter orders">
        {FILTERS.map((f) => {
          const count = active.filter((o) => f.statuses.includes(o.status)).length;
          const selected = f.key === filter;
          return (
            <button
              key={f.key}
              type="button"
              aria-pressed={selected}
              onClick={() => setFilter(f.key)}
              className={`inline-flex min-h-[36px] items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                selected
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
              }`}
            >
              {f.label}
              <span
                className={`rounded-full px-1.5 text-xs font-semibold ${
                  selected ? 'bg-white/20 text-white' : count && f.key !== 'all' ? 'bg-brand-100 text-brand-700' : 'bg-stone-100 text-stone-500'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <Card>
          <Spinner label="Loading orders…" />
        </Card>
      ) : shown.length === 0 ? (
        <Card>
          <EmptyState
            title={current.empty}
            hint={filter === 'all' ? 'New table and online orders appear here automatically.' : undefined}
            action={
              filter === 'all' && can.placeStaffOrders(role) ? (
                <button type="button" className="btn-secondary" onClick={() => setNewOpen(true)}>
                  + New order
                </button>
              ) : null
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {shown.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              role={role}
              tables={tables}
              menuById={menuById}
              now={now}
              onChanged={replaceOrder}
              onEditItems={setEditing}
            />
          ))}
        </div>
      )}

      <section className="mt-8" aria-labelledby="history-heading">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h2 id="history-heading" className="text-lg font-semibold text-stone-900">
            Today&apos;s history
          </h2>
          <span className="text-sm text-stone-500">{history.length} closed or cancelled</span>
        </div>
        <Card className="!p-0">{loading ? <Spinner /> : <OrderHistoryTable orders={history} />}</Card>
      </section>

      {newOpen ? (
        <NewOrderModal
          onClose={() => setNewOpen(false)}
          onCreated={(order) => {
            setNewOpen(false);
            setFilter('all');
            replaceOrder(order);
          }}
        />
      ) : null}

      {editing ? (
        <EditItemsModal
          order={editing}
          onClose={() => setEditing(null)}
          onSaved={(order) => {
            setEditing(null);
            replaceOrder(order);
          }}
        />
      ) : null}
    </StaffLayout>
  );
}

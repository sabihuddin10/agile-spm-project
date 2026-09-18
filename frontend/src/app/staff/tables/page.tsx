'use client';

import { useCallback, useEffect, useState } from 'react';
import { StaffLayout } from '@/components/layout/staff-layout';
import { tableApi, orderApi } from '@/lib/api';
import type { Table } from '@/types';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/components/ui/toast';
import { Spinner } from '@/components/ui/spinner';

const STATUS_TONE: Record<string, 'emerald' | 'amber' | 'blue' | 'stone'> = {
  free: 'emerald',
  occupied: 'amber',
  reserved: 'blue',
  cleaning: 'stone',
};

export default function TablesPage() {
  const toast = useToast();
  const { user } = useAuth();
  const [tables, setTables] = useState<Table[]>([]);
  const [orderCounts, setOrderCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async () => {
      try {
        const [t, o] = await Promise.all([tableApi.list(), orderApi.list()]);
        setTables(t.tables);
        const counts: Record<string, number> = {};
        const active = o.orders.filter((x) => ['placed', 'confirmed', 'in_kitchen', 'ready', 'served'].includes(x.status));
        for (const ord of active) {
          if (ord.tableId) counts[ord.tableId] = (counts[ord.tableId] || 0) + 1;
        }
        setOrderCounts(counts);
      } catch {
        toast('Failed to load tables.', 'error');
      } finally {
        setLoading(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    load();
  }, [load]);

  async function setStatus(t: Table, status: Table['status']) {
    try {
      await tableApi.update(t.id, { status });
      toast(`Table ${t.number} → ${status}`, 'success');
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Update failed.', 'error');
    }
  }

  async function assignMe(t: Table) {
    if (!user) return;
    try {
      await tableApi.update(t.id, { waiterId: user.role === 'waiter' || user.role === 'manager' || user.role === 'admin' ? user.id : t.waiterId });
      toast(`Table ${t.number} assigned to ${user.name}.`, 'success');
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Update failed.', 'error');
    }
  }

  const isManager = user?.role === 'manager' || user?.role === 'admin';

  return (
    <StaffLayout>
      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-2xl font-bold">Tables</h1>
        <Badge tone="blue">Sprint 6 · Live</Badge>
      </div>

      {loading ? (
        <Spinner label="Loading tables…" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {tables.map((t) => (
            <div key={t.id} className="card p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-stone-100 text-lg font-bold text-stone-700">
                    {t.number}
                  </div>
                  <div>
                    <p className="font-semibold">{t.seats} seats</p>
                    {orderCounts[t.id] ? (
                      <span className="text-xs text-amber-600">{orderCounts[t.id]} active order(s)</span>
                    ) : (
                      <span className="text-xs text-stone-400">No active orders</span>
                    )}
                  </div>
                </div>
                <Badge tone={STATUS_TONE[t.status]}>{t.status}</Badge>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {(['free', 'occupied', 'reserved', 'cleaning'] as Table['status'][]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatus(t, s)}
                    disabled={t.status === s}
                    className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                      t.status === s
                        ? 'bg-stone-200 text-stone-500'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-stone-400">
                  {t.waiterId ? 'Assigned' : 'Unassigned'}
                </span>
                {t.status !== 'free' && !t.waiterId ? (
                  <button className="btn-ghost !py-1 text-xs" onClick={() => assignMe(t)}>
                    Take this table
                  </button>
                ) : null}
              </div>

              {isManager ? (
                <button
                  className="btn-ghost mt-2 !py-1 text-xs text-red-500"
                  onClick={async () => {
                    await tableApi.remove(t.id);
                    toast(`Table ${t.number} removed.`, 'success');
                    load();
                  }}
                >
                  Remove table
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </StaffLayout>
  );
}
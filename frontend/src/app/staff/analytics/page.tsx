'use client';

import { useCallback, useEffect, useState } from 'react';
import { StaffLayout } from '@/components/layout/staff-layout';
import { analyticsApi, inventoryApi, orderApi } from '@/lib/api';
import type { AnalyticsSummary } from '@/types';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { Spinner } from '@/components/ui/spinner';

export default function AnalyticsPage() {
  const toast = useToast();
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await analyticsApi.summary();
      setSummary(res.summary);
    } catch {
      toast('Failed to load analytics.', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const maxQty = summary ? Math.max(...summary.topItems.map((i) => i.qty), 1) : 1;
  const maxStatus = summary ? Math.max(...(Object.values(summary.statusCounts) as number[]), 1) : 1;

  const cardCls = 'card p-5';

  return (
    <StaffLayout>
      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <Badge tone="blue">Sprint 10 · Live</Badge>
        <span className="ml-auto text-sm text-stone-500">Manager / Admin</span>
      </div>

      {loading || !summary ? (
        <Spinner label="Loading analytics…" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className={cardCls}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">Revenue</p>
              <p className="mt-1 text-2xl font-bold text-stone-800">${summary.revenue.toFixed(2)}</p>
            </div>
            <div className={cardCls}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">Orders</p>
              <p className="mt-1 text-2xl font-bold text-stone-800">{summary.orderCount}</p>
              <p className="text-xs text-stone-400">{summary.paidCount} paid</p>
            </div>
            <div className={cardCls}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">Avg order</p>
              <p className="mt-1 text-2xl font-bold text-stone-800">${summary.avgOrder.toFixed(2)}</p>
            </div>
            <div className={cardCls}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">Customers</p>
              <p className="mt-1 text-2xl font-bold text-stone-800">{summary.customerCount}</p>
            </div>
            <div className={cardCls}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">Low stock</p>
              <p className={`mt-1 text-2xl font-bold ${summary.lowStock > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {summary.lowStock}
              </p>
              <p className="text-xs text-stone-400">inventory items</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="card p-5">
              <h2 className="font-semibold">Top selling items</h2>
              <div className="mt-4 space-y-3">
                {summary.topItems.length === 0 ? (
                  <p className="text-sm text-stone-500">No orders yet — place some to see rankings.</p>
                ) : (
                  summary.topItems.map((item) => (
                    <div key={item.name}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span className="text-stone-700">{item.name}</span>
                        <span className="font-medium text-stone-500">{item.qty} sold</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded bg-stone-100">
                        <div
                          className="h-full rounded bg-brand-500"
                          style={{ width: `${(item.qty / maxQty) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="card p-5">
              <h2 className="font-semibold">Orders by status</h2>
              <div className="mt-4 space-y-3">
                {Object.entries(summary.statusCounts).map(([status, count]) => (
                  <div key={status}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="capitalize text-stone-700">{status.replace('_', ' ')}</span>
                      <span className="font-medium text-stone-500">{count}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded bg-stone-100">
                      <div
                        className="h-full rounded bg-stone-400"
                        style={{ width: `${(count / maxStatus) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </StaffLayout>
  );
}
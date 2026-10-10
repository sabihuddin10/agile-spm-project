'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type { AnalyticsDashboard as DashboardData } from '@/types';
import { analyticsApi } from '@/lib/api';
import { errorMessage } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';
import { RangeControls, presetRange, type RangeState } from '@/components/analytics/range-controls';
import { KpiTiles } from '@/components/analytics/kpi-tiles';
import { TableUtilization } from '@/components/analytics/table-utilization';
import { InventoryHealth } from '@/components/analytics/inventory-health';
import { ReservationStats } from '@/components/analytics/reservation-stats';
import { longDate } from '@/components/analytics/analytics-format';

/** Card-sized skeleton shown while a Chart.js panel's code loads. */
function chartPlaceholder(className: string) {
  function ChartPlaceholder() {
    return (
      <div className={`card animate-pulse motion-reduce:animate-none ${className}`} aria-hidden="true">
        <div className="h-4 w-40 rounded bg-stone-100" />
        <div className="mt-2 h-3 w-64 max-w-full rounded bg-stone-100" />
        <div className="mt-4 h-48 rounded-lg bg-stone-50 sm:mt-5 sm:h-64" />
      </div>
    );
  }
  return ChartPlaceholder;
}

// Chart.js is the heaviest dependency on this screen — load the chart panels on demand.
const RevenueTrendChart = dynamic(() => import('@/components/analytics/revenue-trend-chart').then((m) => m.RevenueTrendChart), {
  ssr: false,
  loading: chartPlaceholder(''),
});
const TopDishes = dynamic(() => import('@/components/analytics/top-dishes').then((m) => m.TopDishes), {
  ssr: false,
  loading: chartPlaceholder('lg:col-span-2'),
});
const PeakHoursChart = dynamic(() => import('@/components/analytics/peak-hours-chart').then((m) => m.PeakHoursChart), {
  ssr: false,
  loading: chartPlaceholder('lg:col-span-2'),
});

const GRANULARITY_LABEL = { day: 'day', week: 'week', month: 'month' } as const;

/**
 * Manager/admin KPI dashboard (US10.1–US10.6). One period filter scopes every
 * panel; the previous result stays on screen (dimmed) while a new range loads.
 */
export function AnalyticsDashboard() {
  const toast = useToast();
  const [range, setRange] = useState<RangeState>(() => ({ preset: '30', granularity: 'day', ...presetRange('30') }));
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const requestId = useRef(0);

  const rangeError = range.from > range.to ? '“From” must be on or before “To”.' : null;
  const { from, to, granularity } = range;

  const load = useCallback(async () => {
    if (from > to) return;
    const id = ++requestId.current;
    setLoading(true);
    try {
      const res = await analyticsApi.dashboard({ from, to, granularity });
      if (id !== requestId.current) return;
      setData(res);
      setLoadError(null);
    } catch (err) {
      if (id !== requestId.current) return;
      const message = errorMessage(err, 'Failed to load analytics.');
      setLoadError(message);
      toast(message, 'error');
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [from, to, granularity, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const refreshing = loading && data !== null;

  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle="Sales, menu, floor, stock and booking performance for the period you choose."
        action={
          <button type="button" onClick={load} className="btn-secondary" disabled={loading || Boolean(rangeError)}>
            <svg
              className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.023 9.348h4.992V4.356M2.985 19.644v-4.992h4.992m0 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182"
              />
            </svg>
            Refresh
          </button>
        }
      />

      <Card className="mb-5">
        <RangeControls value={range} onChange={setRange} error={rangeError} />
        <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-stone-100 pt-3 text-sm text-stone-600" aria-live="polite">
          {data ? (
            <>
              <span>
                Showing <span className="font-semibold text-stone-900">{longDate(data.range.from)}</span> –{' '}
                <span className="font-semibold text-stone-900">{longDate(data.range.to)}</span>
              </span>
              <span className="text-stone-400">·</span>
              <span>
                {data.range.days} day{data.range.days === 1 ? '' : 's'}, grouped by {GRANULARITY_LABEL[data.range.granularity]}
              </span>
            </>
          ) : (
            <span>Loading period…</span>
          )}
          {refreshing ? <span className="text-xs text-stone-500">Updating…</span> : null}
        </p>
      </Card>

      {!data ? (
        loading ? (
          <Card>
            <Spinner label="Loading analytics…" />
          </Card>
        ) : (
          <Card>
            <EmptyState
              title="Analytics couldn’t be loaded"
              hint={loadError ?? 'Please try again.'}
              action={
                <button type="button" onClick={load} className="btn-secondary">
                  Try again
                </button>
              }
            />
          </Card>
        )
      ) : (
        <div
          className={`space-y-3 transition-opacity sm:space-y-5 ${refreshing ? 'pointer-events-none opacity-60' : ''}`}
          aria-busy={refreshing}
        >
          <KpiTiles kpis={data.kpis} />
          <RevenueTrendChart data={data} />
          <div className="grid gap-3 sm:gap-5 lg:grid-cols-3">
            <TopDishes dishes={data.dishes} className="lg:col-span-2" />
            <ReservationStats stats={data.reservations} />
          </div>
          <div className="grid gap-3 sm:gap-5 lg:grid-cols-3">
            <PeakHoursChart hours={data.peakHours} className="lg:col-span-2" />
            <InventoryHealth items={data.inventory} />
          </div>
          <TableUtilization tables={data.tables} zones={data.zones} days={data.range.days} />
        </div>
      )}
    </>
  );
}

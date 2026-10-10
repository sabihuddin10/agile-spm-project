'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { StaffPerformance } from '@/types';
import { staffApi } from '@/lib/api';
import { can } from '@/lib/permissions';
import { addDaysISO, errorMessage, localDateISO, money } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/toast';
import { ROLE_META, formatHours, parseISODate, roleRank } from '@/components/staff/role-meta';

const PRESETS = [7, 30, 90] as const;

interface Column {
  key: string;
  label: string;
  /** null = not applicable to this person's role (rendered as an em dash). */
  value: (r: StaffPerformance) => number | null;
  format: (n: number) => string;
  /** Which end of the column is "best"; that cell is highlighted. */
  best: 'max' | 'min';
}

const frontOfHouse = (r: StaffPerformance) => can.placeStaffOrders(r.role);
const kitchen = (r: StaffPerformance) => can.cookOrders(r.role);
const count = (n: number) => n.toLocaleString();

const COLUMNS: Column[] = [
  { key: 'ordersTaken', label: 'Orders taken', value: (r) => (frontOfHouse(r) ? r.ordersTaken : null), format: count, best: 'max' },
  { key: 'ordersServed', label: 'Orders served', value: (r) => (can.serveOrders(r.role) ? r.ordersServed : null), format: count, best: 'max' },
  { key: 'revenueHandled', label: 'Revenue handled', value: (r) => (frontOfHouse(r) ? r.revenueHandled : null), format: money, best: 'max' },
  { key: 'tips', label: 'Tips', value: (r) => (frontOfHouse(r) ? r.tips : null), format: money, best: 'max' },
  { key: 'itemsPrepared', label: 'Items prepared', value: (r) => (kitchen(r) ? r.itemsPrepared : null), format: count, best: 'max' },
  { key: 'avgPrepMinutes', label: 'Avg prep', value: (r) => (kitchen(r) ? r.avgPrepMinutes : null), format: (n) => `${n} min`, best: 'min' },
  { key: 'shiftsCompleted', label: 'Shifts done / missed', value: (r) => r.shiftsCompleted, format: count, best: 'max' },
  { key: 'hoursWorked', label: 'Hours worked', value: (r) => r.hoursWorked, format: formatHours, best: 'max' },
];

const rangeLabel = (from: string, to: string) => {
  const fmt = (d: string, year = false) =>
    parseISODate(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}) });
  return `${fmt(from)} – ${fmt(to, true)}`;
};

/**
 * Staff performance: orders taken/served, revenue and tips handled,
 * items prepared and average prep time, and shift attendance per staff member
 * over the last 7, 30 or 90 days. The best value in each column is highlighted.
 */
export function PerformancePanel() {
  const toast = useToast();
  const [days, setDays] = useState<(typeof PRESETS)[number]>(30);
  const [data, setData] = useState<{ from: string; to: string; staff: StaffPerformance[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const res = await staffApi.performance({ from: addDaysISO(-(days - 1)), to: localDateISO() });
      if (id === requestId.current) setData(res);
    } catch (err) {
      if (id === requestId.current) toast(errorMessage(err), 'error');
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [days, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(
    () =>
      (data?.staff ?? []).slice().sort((a, b) => roleRank(a.role) - roleRank(b.role) || a.name.localeCompare(b.name)),
    [data],
  );

  const best = useMemo(() => {
    const out: Record<string, number | null> = {};
    for (const col of COLUMNS) {
      const values = rows.map(col.value).filter((v): v is number => v !== null && v > 0);
      out[col.key] = values.length ? (col.best === 'max' ? Math.max(...values) : Math.min(...values)) : null;
    }
    return out;
  }, [rows]);

  const totals = useMemo(
    () => ({
      revenue: rows.reduce((s, r) => s + r.revenueHandled, 0),
      tips: rows.reduce((s, r) => s + r.tips, 0),
      items: rows.reduce((s, r) => s + r.itemsPrepared, 0),
      hours: rows.reduce((s, r) => s + r.hoursWorked, 0),
      missed: rows.reduce((s, r) => s + r.shiftsMissed, 0),
    }),
    [rows],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex w-full rounded-lg border border-stone-300 bg-white p-0.5 sm:inline-flex sm:w-auto" role="group" aria-label="Date range">
          {PRESETS.map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={days === n}
              onClick={() => setDays(n)}
              className={`min-h-[32px] flex-1 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition sm:flex-none sm:px-3 sm:text-sm ${
                days === n ? 'bg-brand-600 text-white' : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              Last {n} days
            </button>
          ))}
        </div>
        {data ? <p className="text-sm text-stone-500">{rangeLabel(data.from, data.to)}</p> : null}
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4">
        {[
          { label: 'Revenue handled', value: money(totals.revenue) },
          { label: 'Tips', value: money(totals.tips) },
          { label: 'Items prepared', value: count(totals.items) },
          { label: 'Hours worked', value: formatHours(totals.hours), sub: totals.missed ? `${totals.missed} missed shift${totals.missed === 1 ? '' : 's'}` : 'No missed shifts' },
        ].map((k) => (
          <div key={k.label} className="card grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 p-3 sm:block sm:p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{k.label}</p>
            <p className="text-xl font-bold tabular-nums text-stone-800 sm:mt-1 sm:text-2xl">{loading && !data ? '–' : k.value}</p>
            {k.sub ? <p className="col-span-2 text-xs text-stone-500">{k.sub}</p> : null}
          </div>
        ))}
      </div>

      <Card className={`p-0 ${loading && data ? 'opacity-60' : ''}`}>
        {loading && !data ? (
          <Spinner label="Crunching performance…" />
        ) : rows.length === 0 ? (
          <EmptyState title="No staff to report on" />
        ) : (
          <>
          {/* Phones: one card per person, showing only the columns that apply to their role. */}
          <ul className="divide-y divide-stone-100 sm:hidden" aria-label="Staff performance">
            {rows.map((r) => (
              <li key={r.userId} className="px-3.5 py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-stone-800">{r.name}</span>
                  <Badge tone={ROLE_META[r.role].tone}>{ROLE_META[r.role].label}</Badge>
                  {!r.active ? <Badge tone="red">Suspended</Badge> : null}
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                  {COLUMNS.map((c) => {
                    const v = c.value(r);
                    if (v === null) return null;
                    const top = best[c.key] !== null && v === best[c.key];
                    return (
                      <div key={c.key} className="flex items-baseline justify-between gap-2">
                        <dt className="text-xs text-stone-500">{c.label}</dt>
                        <dd className={`tabular-nums ${top ? 'font-semibold text-brand-700' : 'text-stone-700'}`}>
                          {c.format(v)}
                          {c.key === 'shiftsCompleted' ? (
                            <span className={r.shiftsMissed ? 'font-semibold text-red-600' : 'text-stone-500'}> / {r.shiftsMissed}</span>
                          ) : null}
                          {top ? <span className="sr-only"> (top)</span> : null}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto sm:block">
            <table className="table-base min-w-[960px]">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-white">Staff</th>
                  {COLUMNS.map((c) => (
                    <th key={c.key} className="text-right">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.userId}>
                    <td className="sticky left-0 z-10 bg-white">
                      <p className="whitespace-nowrap font-medium text-stone-800">{r.name}</p>
                      <div className="mt-0.5 flex gap-1">
                        <Badge tone={ROLE_META[r.role].tone}>{ROLE_META[r.role].label}</Badge>
                        {!r.active ? <Badge tone="red">Suspended</Badge> : null}
                      </div>
                    </td>
                    {COLUMNS.map((c) => {
                      const v = c.value(r);
                      const top = v !== null && best[c.key] !== null && v === best[c.key];
                      return (
                        <td
                          key={c.key}
                          className={`whitespace-nowrap text-right tabular-nums ${
                            top ? 'bg-brand-50 font-semibold text-brand-700' : v === null ? 'text-stone-300' : 'text-stone-700'
                          }`}
                        >
                          {v === null ? (
                            <span aria-label="Not applicable">—</span>
                          ) : (
                            <>
                              {c.format(v)}
                              {c.key === 'shiftsCompleted' ? (
                                <span className={r.shiftsMissed ? 'font-semibold text-red-600' : 'font-normal text-stone-500'}>
                                  {' '}
                                  / {r.shiftsMissed}
                                </span>
                              ) : null}
                              {top ? <span className="sr-only"> (top)</span> : null}
                            </>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </Card>

      <p className="text-xs text-stone-500">
        <span className="mr-1 inline-block h-3 w-3 rounded-sm bg-brand-100 align-middle" aria-hidden="true" />
        Highlighted = best in the column (fastest for prep time). “—” = not part of that role. Revenue and tips count
        settled orders the waiter took, net of refunds; prep time runs from kitchen confirmation to item ready.
      </p>
    </div>
  );
}

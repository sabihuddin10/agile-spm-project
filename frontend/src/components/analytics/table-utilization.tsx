import type { AnalyticsDashboard } from '@/types';
import { AnalyticsCard } from '@/components/analytics/analytics-card';
import { count, pct } from '@/components/analytics/analytics-format';
import { formatMinutes } from '@/lib/format';
import { EmptyState } from '@/components/ui/empty-state';

/** Occupancy meter: brand fill on a lighter brand track; the value is printed beside it. */
function OccupancyBar({ rate }: { rate: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-full min-w-[4rem] overflow-hidden rounded-full bg-brand-100" aria-hidden="true">
        <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.min(100, Math.max(0, rate))}%` }} />
      </div>
      <span className="w-12 shrink-0 text-right text-sm tabular-nums text-stone-700">{pct(rate)}</span>
    </div>
  );
}

/**
 * US10.3 — table turnover and utilization: per-zone summary cards and a
 * per-table breakdown of turns, average sitting length and occupancy.
 */
export function TableUtilization({
  tables,
  zones,
  days,
}: {
  tables: AnalyticsDashboard['tables'];
  zones: AnalyticsDashboard['zones'];
  days: number;
}) {
  const totalTurns = tables.reduce((s, t) => s + t.turns, 0);
  const busiest = tables.reduce<(typeof tables)[number] | null>((b, t) => (!b || t.occupancyRate > b.occupancyRate ? t : b), null);

  return (
    <AnalyticsCard
      title="Table turnover & utilization"
      story="US10.3"
      subtitle={`Closed dine-in sittings. Occupancy = seated time ÷ opening hours over ${days} day${days === 1 ? '' : 's'}.`}
    >
      {tables.length === 0 ? (
        <EmptyState title="No tables configured" hint="Add tables on the floor plan to track turnover." />
      ) : (
        <>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {zones.map((z) => (
              <li key={z.zone} className="rounded-lg border border-stone-200 bg-stone-50/60 p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-semibold text-stone-900">{z.zone}</p>
                  <p className="text-xs text-stone-500">
                    {z.tables} table{z.tables === 1 ? '' : 's'}
                  </p>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className="text-xs text-stone-500">Turns</dt>
                    <dd className="text-lg font-semibold text-stone-900">{count(z.turns)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-stone-500">Avg turnover</dt>
                    <dd className="text-lg font-semibold text-stone-900">{z.turns ? formatMinutes(z.avgTurnoverMinutes) : '—'}</dd>
                  </div>
                </dl>
                <p className="mb-1 mt-3 text-xs text-stone-500">Avg occupancy</p>
                <OccupancyBar rate={z.occupancyRate} />
              </li>
            ))}
          </ul>

          <div className="mt-5 overflow-x-auto">
            <table className="table-base min-w-[36rem]">
              <caption className="sr-only">Turnover and occupancy per table</caption>
              <thead>
                <tr>
                  <th scope="col">Table</th>
                  <th scope="col">Zone</th>
                  <th scope="col" className="text-right">Seats</th>
                  <th scope="col" className="text-right">Turns</th>
                  <th scope="col" className="text-right">Avg turnover</th>
                  <th scope="col" className="w-2/5">Occupancy</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {tables.map((t) => (
                  <tr key={t.tableId}>
                    <td className="font-medium text-stone-900">
                      T{t.number}
                      {busiest && busiest.tableId === t.tableId && t.occupancyRate > 0 ? (
                        <span className="ml-2 rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700">Busiest</span>
                      ) : null}
                    </td>
                    <td className="text-stone-600">{t.zone}</td>
                    <td className="text-right text-stone-600">{t.seats}</td>
                    <td className="text-right text-stone-800">{count(t.turns)}</td>
                    <td className="text-right text-stone-800">{t.turns ? formatMinutes(t.avgTurnoverMinutes) : '—'}</td>
                    <td>
                      <OccupancyBar rate={t.occupancyRate} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalTurns === 0 ? (
            <p className="mt-3 text-sm text-stone-500">No closed dine-in sittings in this period yet.</p>
          ) : null}
        </>
      )}
    </AnalyticsCard>
  );
}

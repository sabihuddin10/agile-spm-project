import type { AnalyticsDashboard } from '@/types';
import { AnalyticsCard } from '@/components/analytics/analytics-card';
import { count, pct } from '@/components/analytics/analytics-format';
import { EmptyState } from '@/components/ui/empty-state';

/**
 * US10.6 — reservation no-show rate (no-shows ÷ bookings that were due to
 * arrive) with seated / no-show / cancelled counts and the cancellation rate.
 */
export function ReservationStats({
  stats,
  className = '',
}: {
  stats: AnalyticsDashboard['reservations'];
  className?: string;
}) {
  const due = stats.seated + stats.noShows;
  const other = Math.max(0, stats.total - due - stats.cancelled);
  const segments = [
    { key: 'seated', label: 'Seated', value: stats.seated, color: 'bg-emerald-500' },
    { key: 'noShows', label: 'No-shows', value: stats.noShows, color: 'bg-red-500' },
    { key: 'cancelled', label: 'Cancelled', value: stats.cancelled, color: 'bg-amber-400' },
    { key: 'other', label: 'Upcoming / pending', value: other, color: 'bg-stone-300' },
  ].filter((s) => s.value > 0);

  return (
    <AnalyticsCard title="Reservation no-shows" story="US10.6" subtitle="Bookings dated within the period." className={className}>
      {stats.total === 0 ? (
        <EmptyState title="No bookings in this period" />
      ) : (
        <>
          <div>
            <p className="text-4xl font-semibold tracking-tight text-stone-900">{pct(stats.noShowRate)}</p>
            <p className="mt-1 text-sm text-stone-500">
              {due > 0
                ? `no-show rate — ${count(stats.noShows)} of ${count(due)} bookings due to arrive didn’t show.`
                : 'no-show rate — no bookings in this period have come due yet.'}
            </p>
          </div>

          <div
            className="mt-5 flex h-2.5 gap-0.5 overflow-hidden rounded-full"
            role="img"
            aria-label={`Of ${stats.total} bookings: ${segments.map((s) => `${s.value} ${s.label.toLowerCase()}`).join(', ')}.`}
          >
            {segments.map((s) => (
              <div key={s.key} className={`${s.color} h-full`} style={{ flexGrow: s.value, flexBasis: 0 }} />
            ))}
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            {[
              { label: 'Seated', value: stats.seated, color: 'bg-emerald-500' },
              { label: 'No-shows', value: stats.noShows, color: 'bg-red-500' },
              { label: 'Cancelled', value: stats.cancelled, color: 'bg-amber-400' },
              { label: 'Total bookings', value: stats.total, color: '' },
            ].map((row) => (
              <div key={row.label}>
                <dt className="flex items-center gap-1.5 text-xs text-stone-500">
                  {row.color ? <span className={`h-2 w-2 rounded-sm ${row.color}`} aria-hidden="true" /> : null}
                  {row.label}
                </dt>
                <dd className="text-lg font-semibold tabular-nums text-stone-900">{count(row.value)}</dd>
              </div>
            ))}
          </dl>

          {other > 0 ? (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-stone-500">
              <span className="h-2 w-2 rounded-sm bg-stone-300" aria-hidden="true" />
              {count(other)} upcoming or awaiting confirmation
            </p>
          ) : null}

          <p className="mt-4 border-t border-stone-100 pt-3 text-sm text-stone-600">
            Cancellation rate <span className="font-semibold text-stone-900">{pct(stats.cancellationRate)}</span>
            <span className="text-stone-500"> of all bookings</span>
          </p>
        </>
      )}
    </AnalyticsCard>
  );
}

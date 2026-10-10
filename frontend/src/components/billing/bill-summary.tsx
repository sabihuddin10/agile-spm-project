import type { BillingSummary } from '@/types';
import { money } from '@/lib/format';

function Stat({ label, value, hint, tone }: { label: string; value: string; hint: string; tone: string }) {
  return (
    // On phones the figure sits to the right of its label, so three totals stay short.
    <div className="card grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 p-3 sm:block sm:p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{label}</p>
      <p className={`col-start-2 row-span-2 row-start-1 text-xl font-bold tabular-nums sm:mt-1 sm:text-2xl ${tone}`}>{value}</p>
      <p className="mt-0.5 text-xs text-stone-500">{hint}</p>
    </div>
  );
}

function StatSkeleton() {
  return (
    <div className="card animate-pulse p-3 sm:p-4" aria-hidden="true">
      <div className="h-3 w-20 rounded bg-stone-200" />
      <div className="mt-2 h-7 w-28 rounded bg-stone-200" />
      <div className="mt-2 h-3 w-24 rounded bg-stone-100" />
    </div>
  );
}

/** Outstanding vs. paid-today totals for the billing desk. One card per row on phones. */
export function BillSummary({ summary, readyCount }: { summary: BillingSummary | null; readyCount: number }) {
  if (!summary) {
    return (
      <div className="mb-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-3" role="status" aria-label="Loading billing totals">
        <StatSkeleton />
        <StatSkeleton />
        <StatSkeleton />
      </div>
    );
  }
  return (
    <div className="mb-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-3">
      <Stat
        label="Outstanding"
        value={money(summary.outstanding)}
        hint={`${summary.openCount} open ${summary.openCount === 1 ? 'bill' : 'bills'}`}
        tone="text-amber-700"
      />
      <Stat
        label="Paid today"
        value={money(summary.paidToday)}
        hint={`${summary.paidTodayCount} ${summary.paidTodayCount === 1 ? 'bill' : 'bills'} · net of refunds`}
        tone="text-emerald-700"
      />
      <Stat label="Ready to bill" value={String(readyCount)} hint="Served, waiting for payment" tone="text-brand-700" />
    </div>
  );
}

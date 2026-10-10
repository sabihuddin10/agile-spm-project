import type { BillingSummary } from '@/types';
import { money } from '@/lib/format';

const TONE_TEXT = { amber: 'text-amber-700', emerald: 'text-emerald-700', brand: 'text-brand-700' } as const;

function Stat({ label, value, hint, tone }: { label: string; value: string; hint: string; tone: keyof typeof TONE_TEXT }) {
  return (
    // A pill like the order filter chips on phones (see .stat in globals.css), a tile from sm.
    <div className={`stat stat-${tone} card p-4`}>
      <p className="stat-label text-xs font-semibold uppercase tracking-wide text-stone-500">{label}</p>
      <p className={`stat-value mt-1 text-2xl font-bold tabular-nums ${TONE_TEXT[tone]}`}>{value}</p>
      <p className="stat-extra mt-0.5 text-xs text-stone-500">{hint}</p>
    </div>
  );
}

function StatSkeleton() {
  return (
    <div className="stat card animate-pulse p-4" aria-hidden="true">
      <div className="stat-label h-3 w-20 rounded bg-stone-200" />
      <div className="stat-value mt-2 h-7 w-28 rounded bg-stone-200" />
      <div className="stat-extra mt-2 h-3 w-24 rounded bg-stone-100" />
    </div>
  );
}

/** Outstanding vs. paid-today totals for the billing desk. Pills in a wrapping row on phones. */
export function BillSummary({ summary, readyCount }: { summary: BillingSummary | null; readyCount: number }) {
  if (!summary) {
    return (
      <div className="stat-row mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3" role="status" aria-label="Loading billing totals">
        <StatSkeleton />
        <StatSkeleton />
        <StatSkeleton />
      </div>
    );
  }
  return (
    <div className="stat-row mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Stat
        label="Outstanding"
        value={money(summary.outstanding)}
        hint={`${summary.openCount} open ${summary.openCount === 1 ? 'bill' : 'bills'}`}
        tone="amber"
      />
      <Stat
        label="Paid today"
        value={money(summary.paidToday)}
        hint={`${summary.paidTodayCount} ${summary.paidTodayCount === 1 ? 'bill' : 'bills'} · net of refunds`}
        tone="emerald"
      />
      <Stat label="Ready to bill" value={String(readyCount)} hint="Served, waiting for payment" tone="brand" />
    </div>
  );
}

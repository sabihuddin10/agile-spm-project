import type { BillingSummary } from '@/types';
import { money } from '@/lib/format';

function Stat({ label, value, hint, tone }: { label: string; value: string; hint: string; tone: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${tone}`}>{value}</p>
      <p className="mt-0.5 text-xs text-stone-500">{hint}</p>
    </div>
  );
}

/** Outstanding vs. paid-today totals for the billing desk (US5.4). */
export function BillSummary({ summary, readyCount }: { summary: BillingSummary | null; readyCount: number }) {
  const s = summary ?? { outstanding: 0, openCount: 0, paidToday: 0, paidTodayCount: 0 };
  return (
    <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
      <Stat
        label="Outstanding"
        value={money(s.outstanding)}
        hint={`${s.openCount} open ${s.openCount === 1 ? 'bill' : 'bills'}`}
        tone="text-amber-700"
      />
      <Stat
        label="Paid today"
        value={money(s.paidToday)}
        hint={`${s.paidTodayCount} ${s.paidTodayCount === 1 ? 'bill' : 'bills'} · net of refunds`}
        tone="text-emerald-700"
      />
      <div className="col-span-2 lg:col-span-1">
        <Stat
          label="Ready to bill"
          value={String(readyCount)}
          hint="Served, waiting for payment"
          tone="text-brand-700"
        />
      </div>
    </div>
  );
}

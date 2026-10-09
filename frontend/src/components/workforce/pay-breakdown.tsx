import type { ReactNode } from 'react';
import type { PayBreakdown } from '@/types';
import { formatDate, money } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { monthLabel, signedMoney } from '@/components/workforce/workforce-format';

function Line({ label, sub, amount, tone = 'default', action }: { label: ReactNode; sub?: string; amount: string; tone?: 'default' | 'minus'; action?: ReactNode }) {
  return (
    <li className="flex items-start justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="text-sm text-stone-700">{label}</p>
        {sub ? <p className="text-xs text-stone-500">{sub}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className={`text-sm tabular-nums ${tone === 'minus' ? 'text-red-700' : 'text-stone-900'}`}>{amount}</span>
        {action}
      </div>
    </li>
  );
}

/**
 * Monthly pay estimate: paid hours × hourly wage, tips, each bonus or
 * correction, each late deduction, and the net. "Estimated" until the month ends.
 */
export function PayBreakdownCard({
  pay,
  monthPicker,
  onRemoveAdjustment,
  footer,
}: {
  pay: PayBreakdown;
  monthPicker?: ReactNode;
  /** Admin only: shows a remove button next to each bonus. */
  onRemoveAdjustment?: (id: string) => void;
  footer?: ReactNode;
}) {
  return (
    <section className="card" aria-labelledby="pay-heading">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="pay-heading" className="text-lg font-semibold">
              Pay
            </h2>
            {pay.estimated ? <Badge tone="amber">Estimated</Badge> : <Badge tone="stone">Final</Badge>}
          </div>
          <p className="mt-0.5 text-sm text-stone-500">
            {monthLabel(pay.month)}
            {pay.estimated ? ' · updates as you work until the month ends' : ''}
          </p>
        </div>
        {monthPicker}
      </div>

      <ul className="divide-y divide-stone-100" aria-label="Pay lines">
        <Line label="Hourly wage" amount={`${money(pay.hourlyWage)} / h`} />
        <Line label="Paid hours" sub="Worked time minus unpaid breaks" amount={`${pay.paidHours.toFixed(2)} h`} />
        <Line label="Base pay" sub={`${pay.paidHours.toFixed(2)} h × ${money(pay.hourlyWage)}`} amount={money(pay.base)} />
        <Line label="Tips" sub="From bills you served" amount={money(pay.tips)} />
        {pay.bonuses.map((b) => (
          <Line
            key={b.id}
            label={b.amount < 0 ? `Correction: ${b.reason}` : `Bonus: ${b.reason}`}
            sub={formatDate(b.date)}
            amount={signedMoney(b.amount)}
            tone={b.amount < 0 ? 'minus' : 'default'}
            action={
              onRemoveAdjustment ? (
                <button
                  type="button"
                  className="btn-ghost !px-2 !py-1 text-xs text-red-700"
                  onClick={() => onRemoveAdjustment(b.id)}
                  aria-label={`Remove ${b.reason} (${signedMoney(b.amount)})`}
                >
                  Remove
                </button>
              ) : undefined
            }
          />
        ))}
        {pay.latePenalties.map((p, i) => (
          <Line
            key={`${p.date}-${i}`}
            label="Late deduction"
            sub={`${formatDate(p.date)} · ${p.minutes} min late`}
            amount={`−${money(p.amount)}`}
            tone="minus"
          />
        ))}
      </ul>

      <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-stone-200 pt-3">
        <p className="font-semibold text-stone-900">{pay.estimated ? 'Estimated net' : 'Net pay'}</p>
        <p className="text-2xl font-bold tabular-nums text-stone-900" data-testid="pay-net">
          {money(pay.net)}
        </p>
      </div>
      {footer}
    </section>
  );
}

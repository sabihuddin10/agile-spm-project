'use client';

import type { Invoice } from '@/types';
import { billingApi } from '@/lib/api';
import { formatTime, money } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { CheckIcon, XMarkIcon } from '@/components/ui/icons';
import { fromCents, toCents } from './bill-utils';
import { useBillAction } from './use-bill-action';

/**
 * The shares of a split bill (US5.3): each guest's amount and items, paid state
 * and Card/Cash buttons, a check that the shares add up to the bill total, and
 * "Undo split" while nobody has paid. Paying the last share settles the bill.
 */
export function SplitParts({
  invoice,
  onUpdated,
  onConflict,
}: {
  invoice: Invoice;
  onUpdated: (invoice: Invoice) => void;
  onConflict?: () => void;
}) {
  const { pending, run } = useBillAction(onUpdated, onConflict);
  const split = invoice.split;
  if (!split) return null;

  const parts = split.parts;
  const paidCount = parts.filter((p) => p.paid).length;
  const sumC = parts.reduce((s, p) => s + toCents(p.amount), 0);
  const remainingC = parts.filter((p) => !p.paid).reduce((s, p) => s + toCents(p.amount), 0);
  const adds = sumC === toCents(invoice.total);
  const settled = invoice.paymentStatus !== 'unpaid';
  const lineName = (id: string) => {
    const line = invoice.lines.find((l) => l.id === id);
    return line ? `${line.qty} × ${line.name}` : 'Item';
  };

  function pay(index: number, method: 'card' | 'cash') {
    const label = parts[index].label;
    run(`part-${index}-${method}`, () => billingApi.paySplitPart(invoice.id, index, method), (inv) =>
      inv.paymentStatus === 'paid'
        ? `${label} paid by ${method} — all shares paid, bill #${inv.number} settled.`
        : `${label} paid ${money(parts[index].amount)} by ${method}.`,
    );
  }

  function undo() {
    run('undo', () => billingApi.clearSplit(invoice.id), 'Split removed — the bill is back to one payment.');
  }

  return (
    <section aria-labelledby="split-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="split-heading" className="text-sm font-semibold text-stone-800">
          Split {split.mode === 'even' ? `evenly · ${parts.length} payers` : `by items · ${parts.length} guests`}
        </h3>
        <span className="text-xs text-stone-500">
          {paidCount} of {parts.length} paid
          {!settled && remainingC > 0 ? ` · ${money(fromCents(remainingC))} to collect` : ''}
        </span>
      </div>

      <ul className="mt-2 divide-y divide-stone-100 rounded-lg border border-stone-200">
        {parts.map((p, i) => (
          <li key={`${p.label}-${i}`} className={`px-3 py-2.5 ${p.paid ? 'bg-emerald-50/50' : ''}`}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {p.label} <span className="font-semibold tabular-nums">{money(p.amount)}</span>
                </p>
                {split.mode === 'items' && p.itemIds.length ? (
                  <p className="text-xs text-stone-500">{p.itemIds.map(lineName).join(', ')}</p>
                ) : null}
              </div>
              {p.paid ? (
                <Badge tone="emerald">
                  Paid {p.method ?? ''}
                  {p.paidAt ? ` · ${formatTime(p.paidAt)}` : ''}
                </Badge>
              ) : settled ? (
                <Badge tone="stone">Settled with bill</Badge>
              ) : (
                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    className="btn-sm btn-primary"
                    onClick={() => pay(i, 'card')}
                    disabled={pending !== null}
                    aria-label={`${p.label}: pay ${money(p.amount)} by card`}
                  >
                    {pending === `part-${i}-card` ? 'Paying…' : 'Pay card'}
                  </button>
                  <button
                    type="button"
                    className="btn-sm btn-secondary"
                    onClick={() => pay(i, 'cash')}
                    disabled={pending !== null}
                    aria-label={`${p.label}: pay ${money(p.amount)} in cash`}
                  >
                    {pending === `part-${i}-cash` ? 'Paying…' : 'Pay cash'}
                  </button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>

      <p className={`mt-2 flex items-center gap-1 text-xs font-medium tabular-nums ${adds ? 'text-emerald-700' : 'text-red-600'}`}>
        {adds ? <CheckIcon className="h-3.5 w-3.5 shrink-0" /> : <XMarkIcon className="h-3.5 w-3.5 shrink-0" />}
        <span>
          Shares total {money(fromCents(sumC))} {adds ? '=' : '≠'} bill total {money(invoice.total)} ·{' '}
          {adds ? 'Adds up' : 'Does not add up'}
        </span>
      </p>

      {!settled ? (
        paidCount === 0 ? (
          <button type="button" className="btn-sm btn-ghost mt-2" onClick={undo} disabled={pending !== null}>
            {pending === 'undo' ? 'Undoing…' : 'Undo split'}
          </button>
        ) : (
          <p className="mt-2 text-xs text-stone-500">
            A share has been paid, so the split can&apos;t be undone. The bill is settled when every share is paid.
          </p>
        )
      ) : null}
    </section>
  );
}

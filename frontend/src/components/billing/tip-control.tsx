'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Invoice } from '@/types';
import { billingApi } from '@/lib/api';
import { money } from '@/lib/format';
import { toCents } from './bill-utils';
import { useBillAction } from './use-bill-action';

const PRESETS = [0, 10, 12, 15, 20];

/**
 * Tip on an unpaid bill (US5.2): quick percentages of the subtotal or a custom
 * amount. The server recomputes the total and clears any split, so splitting
 * should happen after the tip is settled.
 */
export function TipControl({
  invoice,
  onUpdated,
  onConflict,
}: {
  invoice: Invoice;
  onUpdated: (invoice: Invoice) => void;
  onConflict?: () => void;
}) {
  const { pending, run } = useBillAction(onUpdated, onConflict);
  const [custom, setCustom] = useState('');
  const [error, setError] = useState<string | null>(null);

  const sharePaid = Boolean(invoice.split?.parts.some((p) => p.paid));
  const locked = sharePaid || pending !== null;
  const tipC = toCents(invoice.tip);
  const subtotalC = toCents(invoice.subtotal);
  const activePreset = PRESETS.find((p) => Math.round(subtotalC * (p / 100)) === tipC);

  function setPercent(percent: number) {
    setError(null);
    run(`tip-${percent}`, () => billingApi.tip(invoice.id, { percent }), (inv) =>
      percent === 0 ? 'Tip removed.' : `Tip set to ${percent}% (${money(inv.tip)}).`,
    );
  }

  async function submitCustom(e: FormEvent) {
    e.preventDefault();
    const amount = Number(custom);
    if (custom.trim() === '' || !Number.isFinite(amount) || amount < 0) {
      setError('Enter a tip of $0.00 or more.');
      return;
    }
    setError(null);
    const ok = await run('tip-custom', () => billingApi.tip(invoice.id, { amount: Math.round(amount * 100) / 100 }), (inv) =>
      `Tip set to ${money(inv.tip)}.`,
    );
    if (ok) setCustom('');
  }

  return (
    <section aria-labelledby="tip-heading">
      <div className="flex items-baseline justify-between gap-2">
        <h3 id="tip-heading" className="text-sm font-semibold text-stone-800">
          Tip
        </h3>
        <span className="text-sm font-semibold">{money(invoice.tip)}</span>
      </div>
      <p className="mt-0.5 text-xs text-stone-500">Percentages are of the subtotal ({money(invoice.subtotal)}).</p>

      <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Tip percentage">
        {PRESETS.map((p) => {
          const active = activePreset === p;
          return (
            <button
              key={p}
              type="button"
              onClick={() => setPercent(p)}
              disabled={locked}
              aria-pressed={active}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
                active
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-50'
              }`}
            >
              {pending === `tip-${p}` ? '…' : p === 0 ? 'No tip' : `${p}%`}
            </button>
          );
        })}
      </div>

      <form onSubmit={submitCustom} className="mt-2 flex gap-2">
        <label htmlFor={`tip-custom-${invoice.id}`} className="sr-only">
          Custom tip amount
        </label>
        <div className="relative flex-1">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-stone-400">$</span>
          <input
            id={`tip-custom-${invoice.id}`}
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            placeholder="Custom amount"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            disabled={locked}
            className="input pl-7"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `tip-error-${invoice.id}` : undefined}
          />
        </div>
        <button type="submit" className="btn-secondary" disabled={locked || custom.trim() === ''}>
          {pending === 'tip-custom' ? 'Saving…' : 'Set tip'}
        </button>
      </form>
      {error ? (
        <p id={`tip-error-${invoice.id}`} className="mt-1 text-xs text-red-600">
          {error}
        </p>
      ) : null}

      {sharePaid ? (
        <p className="mt-2 rounded-lg bg-stone-100 px-3 py-2 text-xs text-stone-600">
          A guest has already paid their share, so the tip can no longer change.
        </p>
      ) : invoice.split ? (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          This bill is split — changing the tip changes the total and clears the split, so you&apos;ll need to split again.
        </p>
      ) : (
        <p className="mt-2 text-xs text-stone-400">Changing the tip clears any split on the bill.</p>
      )}
    </section>
  );
}

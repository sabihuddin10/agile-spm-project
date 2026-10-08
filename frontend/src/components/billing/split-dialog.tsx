'use client';

import { useState } from 'react';
import type { Invoice } from '@/types';
import { billingApi } from '@/lib/api';
import { modifierText, money } from '@/lib/format';
import { Modal } from '@/components/ui/modal';
import { previewEvenSplit, previewItemSplit, toCents } from './bill-utils';
import { useBillAction } from './use-bill-action';

const EVEN_MIN = 2;
const EVEN_MAX = 20;
const GUESTS_MIN = 2;
const GUESTS_MAX = 8;

function Stepper({
  value,
  min,
  max,
  onChange,
  noun,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  noun: string;
}) {
  return (
    <div className="inline-flex items-center rounded-lg border border-stone-300 bg-white">
      <button
        type="button"
        className="h-9 w-9 text-lg text-stone-600 hover:bg-stone-50 disabled:opacity-40"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label={`Fewer ${noun}`}
      >
        −
      </button>
      <span className="min-w-[3rem] text-center text-sm font-semibold" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        className="h-9 w-9 text-lg text-stone-600 hover:bg-stone-50 disabled:opacity-40"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label={`More ${noun}`}
      >
        +
      </button>
    </div>
  );
}

function CheckLine({ amounts, total }: { amounts: number[]; total: number }) {
  const sumC = amounts.reduce((s, a) => s + toCents(a), 0);
  const ok = sumC === toCents(total);
  return (
    <p className={`text-xs font-medium ${ok ? 'text-emerald-700' : 'text-red-600'}`}>
      Shares total {money(sumC / 100)} {ok ? '=' : '≠'} bill total {money(total)} {ok ? '✓' : '✗'}
    </p>
  );
}

/**
 * Split an unpaid bill (US5.3) evenly between 2–20 payers, or by assigning each
 * line to a guest. Previews mirror the server's cent-exact maths so the shares
 * always add up to the bill total.
 */
export function SplitDialog({
  invoice,
  onClose,
  onUpdated,
  onConflict,
}: {
  invoice: Invoice;
  onClose: () => void;
  onUpdated: (invoice: Invoice) => void;
  onConflict?: () => void;
}) {
  const { pending, run } = useBillAction(onUpdated, onConflict);
  const canSplitItems = invoice.lines.length >= 2;
  const [mode, setMode] = useState<'even' | 'items'>('even');
  const [ways, setWays] = useState(2);
  const [guests, setGuests] = useState(2);
  // line id → guest number (1-based); 0 = not assigned yet.
  const [assign, setAssign] = useState<Record<string, number>>({});

  const evenParts = previewEvenSplit(invoice.total, ways);

  const guestGroups = Array.from({ length: guests }, (_, g) =>
    invoice.lines.filter((l) => (assign[l.id] ?? 0) === g + 1),
  );
  const filled = guestGroups.map((lines, g) => ({ guest: g + 1, lines })).filter((g) => g.lines.length > 0);
  const itemShares = filled.length ? previewItemSplit(invoice, filled.map((g) => g.lines.map((l) => l.id))) : [];
  const unassigned = invoice.lines.filter((l) => !assign[l.id]).length;
  const itemsProblem =
    unassigned > 0
      ? `Assign ${unassigned === 1 ? 'the last item' : `all ${unassigned} remaining items`} to a guest.`
      : filled.length < 2
        ? 'Give items to at least two guests.'
        : null;
  const skipsGuests = filled.length > 0 && filled.length < guests;

  function changeGuests(n: number) {
    setGuests(n);
    // Items assigned to a guest that no longer exists go back to unassigned.
    setAssign((prev) => Object.fromEntries(Object.entries(prev).map(([id, g]) => [id, g > n ? 0 : g])));
  }

  async function submit() {
    const ok =
      mode === 'even'
        ? await run('split', () => billingApi.splitEven(invoice.id, ways), `Bill split evenly between ${ways} payers.`)
        : await run(
            'split',
            () => billingApi.splitByItems(invoice.id, filled.map((g) => g.lines.map((l) => l.id))),
            `Bill split by items between ${filled.length} guest${filled.length === 1 ? '' : 's'}.`,
          );
    if (ok) onClose();
  }

  return (
    <Modal title={`Split bill #${invoice.number}`} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-lg bg-stone-50 px-3 py-2 text-sm">
          <span className="text-stone-600">Bill total (incl. tax, service &amp; tip)</span>
          <span className="font-semibold">{money(invoice.total)}</span>
        </div>

        <div className="grid grid-cols-2 gap-1 rounded-lg bg-stone-100 p-1" role="tablist" aria-label="Split mode">
          {(['even', 'items'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              disabled={m === 'items' && !canSplitItems}
              onClick={() => setMode(m)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                mode === m ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              {m === 'even' ? 'Evenly' : 'By items'}
            </button>
          ))}
        </div>
        {!canSplitItems ? (
          <p className="text-xs text-stone-500">Splitting by items needs at least two lines on the bill.</p>
        ) : null}

        {mode === 'even' ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="label !mb-0">Number of payers</p>
                <p className="text-xs text-stone-500">Between {EVEN_MIN} and {EVEN_MAX}.</p>
              </div>
              <Stepper value={ways} min={EVEN_MIN} max={EVEN_MAX} onChange={setWays} noun="payers" />
            </div>
            <ul className="max-h-56 divide-y divide-stone-100 overflow-y-auto rounded-lg border border-stone-200 text-sm">
              {evenParts.map((amount, i) => (
                <li key={i} className="flex justify-between px-3 py-1.5">
                  <span>Guest {i + 1}</span>
                  <span className="font-medium">{money(amount)}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-stone-500">Shares differ by at most one cent so they always add up exactly.</p>
            <CheckLine amounts={evenParts} total={invoice.total} />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="label !mb-0">Number of guests</p>
                <p className="text-xs text-stone-500">Each line goes to one guest; tax, service and tip are shared in proportion.</p>
              </div>
              <Stepper value={guests} min={GUESTS_MIN} max={GUESTS_MAX} onChange={changeGuests} noun="guests" />
            </div>

            <ul className="divide-y divide-stone-100 rounded-lg border border-stone-200">
              {invoice.lines.map((l) => (
                <li key={l.id} className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 text-sm">
                    <p className="font-medium">
                      {l.qty} × {l.name} <span className="font-normal text-stone-500">· {money(l.lineTotal)}</span>
                    </p>
                    {l.modifiers.length ? <p className="text-xs text-stone-500">{modifierText(l.modifiers)}</p> : null}
                  </div>
                  <select
                    className={`input sm:w-40 ${assign[l.id] ? '' : 'border-amber-400'}`}
                    value={assign[l.id] ?? 0}
                    onChange={(e) => setAssign((prev) => ({ ...prev, [l.id]: Number(e.target.value) }))}
                    aria-label={`Guest paying for ${l.name}`}
                  >
                    <option value={0}>Choose guest…</option>
                    {Array.from({ length: guests }, (_, g) => (
                      <option key={g + 1} value={g + 1}>
                        Guest {g + 1}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>

            <div className="rounded-lg bg-stone-50 p-3 text-sm">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-500">Preview</p>
              <ul className="space-y-1">
                {guestGroups.map((lines, g) => {
                  const idx = filled.findIndex((f) => f.guest === g + 1);
                  return (
                    <li key={g} className="flex justify-between gap-3">
                      <span className={lines.length ? '' : 'text-stone-400'}>
                        Guest {g + 1}
                        <span className="text-xs text-stone-500">
                          {lines.length ? ` · ${lines.map((l) => l.name).join(', ')}` : ' · no items (skipped)'}
                        </span>
                      </span>
                      <span className="shrink-0 font-medium">{idx >= 0 && !unassigned ? money(itemShares[idx]) : '—'}</span>
                    </li>
                  );
                })}
              </ul>
              {!itemsProblem ? (
                <div className="mt-2 border-t border-stone-200 pt-2">
                  <CheckLine amounts={itemShares} total={invoice.total} />
                </div>
              ) : null}
            </div>
            {skipsGuests && !itemsProblem ? (
              <p className="text-xs text-stone-500">Guests without items are left out and the shares are numbered in order.</p>
            ) : null}
            {itemsProblem ? <p className="text-xs font-medium text-amber-700">{itemsProblem}</p> : null}
          </div>
        )}

        {invoice.tip === 0 ? (
          <p className="text-xs text-stone-500">Add any tip before splitting — changing the tip later clears the split.</p>
        ) : null}

        <div className="flex flex-col-reverse gap-2 border-t border-stone-200 pt-4 sm:flex-row sm:justify-end">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={pending !== null}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={submit}
            disabled={pending !== null || (mode === 'items' && Boolean(itemsProblem))}
          >
            {pending ? 'Splitting…' : mode === 'even' ? `Split ${ways} ways` : filled.length === 1 ? 'Split between 1 guest' : `Split between ${filled.length || '…'} guests`}
          </button>
        </div>
      </div>
    </Modal>
  );
}

'use client';

import { useState } from 'react';
import { formatDate, localDateISO } from '@/lib/format';
import { ConfirmDialog } from '@/components/staff/confirm-dialog';
import { signedMoney } from '@/components/workforce/workforce-format';

/**
 * Admin control: give a bonus (positive) or a correction (negative) with a
 * reason and date, e.g. "Eid bonus" or "Birthday". Confirmed before saving.
 */
export function AdjustmentForm({
  name,
  onSubmit,
  defaultDate,
}: {
  name: string;
  onSubmit: (input: { amount: number; reason: string; date: string }) => Promise<void>;
  defaultDate?: string;
}) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [date, setDate] = useState(defaultDate ?? localDateISO());
  const [errors, setErrors] = useState<{ amount?: string; reason?: string; date?: string }>({});
  const [pending, setPending] = useState<{ amount: number; reason: string; date: string } | null>(null);
  const [busy, setBusy] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(amount);
    const next: typeof errors = {};
    if (amount.trim() === '' || !Number.isFinite(value) || value === 0) next.amount = 'Enter an amount (negative for a correction).';
    else if (Math.abs(value) > 10000) next.amount = 'Amounts are limited to $10,000.';
    if (!reason.trim()) next.reason = 'Give a reason, e.g. "Eid bonus".';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) next.date = 'Pick a date.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setPending({ amount: Math.round(value * 100) / 100, reason: reason.trim(), date });
  }

  async function confirm() {
    if (!pending) return;
    setBusy(true);
    try {
      await onSubmit(pending);
      setPending(null);
      setAmount('');
      setReason('');
    } finally {
      setBusy(false);
    }
  }

  const fieldClass = (bad?: string) => `input ${bad ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : ''}`;

  /** The note under a field: its error when there is one, otherwise its hint. */
  function note(key: 'amount' | 'reason' | 'date', hint?: string) {
    const error = errors[key];
    const text = error ?? hint;
    if (!text) return { id: undefined, node: null };
    const id = `adj-${key}-${error ? 'error' : 'hint'}`;
    return {
      id,
      node: (
        <p id={id} role={error ? 'alert' : undefined} className={`mt-1 text-xs ${error ? 'font-medium text-red-600' : 'text-stone-500'}`}>
          {text}
        </p>
      ),
    };
  }

  const amountNote = note('amount', 'Use a minus sign for a correction.');
  const reasonNote = note('reason');
  const dateNote = note('date');

  return (
    <form onSubmit={submit} noValidate aria-labelledby="adjustment-heading">
      <h3 id="adjustment-heading" className="text-sm font-semibold text-stone-800">
        Add bonus or correction
      </h3>
      <div className="mt-2 grid grid-cols-1 items-start gap-3 sm:grid-cols-[9rem_1fr_10rem]">
        <div>
          <label htmlFor="adj-amount" className="label">
            Amount
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-stone-500" aria-hidden="true">
              $
            </span>
            <input
              id="adj-amount"
              className={`${fieldClass(errors.amount)} pl-7 tabular-nums`}
              type="number"
              inputMode="decimal"
              step={0.01}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              aria-invalid={errors.amount ? true : undefined}
              aria-describedby={amountNote.id}
            />
          </div>
          {amountNote.node}
        </div>
        <div>
          <label htmlFor="adj-reason" className="label">
            Reason
          </label>
          <input
            id="adj-reason"
            className={fieldClass(errors.reason)}
            maxLength={200}
            placeholder="Eid bonus"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            aria-invalid={errors.reason ? true : undefined}
            aria-describedby={reasonNote.id}
          />
          {reasonNote.node}
        </div>
        <div>
          <label htmlFor="adj-date" className="label">
            Date
          </label>
          <input
            id="adj-date"
            className={fieldClass(errors.date)}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-invalid={errors.date ? true : undefined}
            aria-describedby={dateNote.id}
          />
          {dateNote.node}
        </div>
      </div>
      <button type="submit" className="btn-secondary mt-3">
        Add to pay
      </button>
      {pending ? (
        <ConfirmDialog
          title={pending.amount < 0 ? 'Add correction' : 'Add bonus'}
          confirmLabel={pending.amount < 0 ? 'Add correction' : 'Add bonus'}
          danger={false}
          busy={busy}
          onConfirm={confirm}
          onCancel={() => setPending(null)}
        >
          <p>
            Add <strong>{signedMoney(pending.amount)}</strong> to {name}&apos;s pay for “{pending.reason}” on{' '}
            {formatDate(pending.date)}?
          </p>
        </ConfirmDialog>
      ) : null}
    </form>
  );
}

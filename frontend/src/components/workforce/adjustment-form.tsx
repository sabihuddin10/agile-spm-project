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

  const fieldClass = (bad?: string) => `input ${bad ? 'border-red-400' : ''}`;

  return (
    <form onSubmit={submit} noValidate aria-labelledby="adjustment-heading">
      <h3 id="adjustment-heading" className="text-sm font-semibold text-stone-800">
        Add bonus or correction
      </h3>
      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-[8rem_1fr_10rem]">
        <div>
          <label htmlFor="adj-amount" className="label">
            Amount
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-stone-400">$</span>
            <input
              id="adj-amount"
              className={`${fieldClass(errors.amount)} pl-7`}
              type="number"
              inputMode="decimal"
              step={0.01}
              placeholder="e.g. 25.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              aria-invalid={Boolean(errors.amount)}
              aria-describedby={errors.amount ? 'adj-amount-error' : undefined}
            />
          </div>
        </div>
        <div>
          <label htmlFor="adj-reason" className="label">
            Reason
          </label>
          <input
            id="adj-reason"
            className={fieldClass(errors.reason)}
            maxLength={200}
            placeholder="e.g. Eid bonus"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            aria-invalid={Boolean(errors.reason)}
            aria-describedby={errors.reason ? 'adj-reason-error' : undefined}
          />
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
            aria-invalid={Boolean(errors.date)}
          />
        </div>
      </div>
      {Object.entries(errors).map(([k, msg]) =>
        msg ? (
          <p key={k} id={`adj-${k}-error`} role="alert" className="mt-1 text-xs font-medium text-red-600">
            {msg}
          </p>
        ) : null,
      )}
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

'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Invoice } from '@/types';
import { billingApi } from '@/lib/api';
import { money } from '@/lib/format';
import { Modal } from '@/components/ui/modal';
import { FieldError, SubmitHint, describedBy } from '@/components/forms/field-error';
import { TONES } from '@/components/forms/tone';
import { useFormValidation, type Rules } from '@/lib/validation/use-form-validation';
import { fromCents, toCents } from './bill-utils';
import { useBillAction } from './use-bill-action';

/** Refund reasons are at most 500 characters (server/src/routes/billing.js). */
const REASON_MAX = 500;
const ERR = TONES.light.inputError;

/**
 * Manager/Admin refund of a paid bill (US5.5): a reason is required; the amount
 * defaults to whatever has not been refunded yet. Refunds are excluded from
 * reported revenue, and a full refund also reverses the loyalty points earned.
 */
export function RefundDialog({
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
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState('');

  const remainingC = toCents(invoice.total) - toCents(invoice.refundedAmount);
  const remaining = fromCents(remainingC);
  const amountC = amount.trim() === '' ? remainingC : toCents(Number(amount));
  const full = amountC === remainingC;

  const rules: Rules<{ reason: string; amount: string }> = {
    reason: (v) => {
      const clean = v.trim();
      if (clean.length < 3) return 'Give a reason (at least 3 characters).';
      if (clean.length > REASON_MAX) return `Keep the reason to ${REASON_MAX} characters (${clean.length} now).`;
      return undefined;
    },
    amount: (v) => {
      if (v.trim() === '') return undefined;
      const n = Number(v);
      return !Number.isFinite(n) || toCents(n) < 1 || toCents(n) > remainingC
        ? `Enter an amount between $0.01 and ${money(remaining)}.`
        : undefined;
    },
  };
  const v = useFormValidation({ reason, amount }, rules, { labels: { reason: 'Reason', amount: 'Amount' } });
  const errors = v.errors;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!v.touchAll()) return;

    const value = amount.trim() === '' ? undefined : fromCents(toCents(Number(amount)));
    const ok = await run(
      'refund',
      () => billingApi.refund(invoice.id, reason.trim(), value),
      (inv) =>
        inv.paymentStatus === 'refunded'
          ? `Bill #${inv.number} fully refunded (${money(inv.refundedAmount)}).`
          : `Refunded ${money(fromCents(amountC))} on bill #${inv.number}.`,
    );
    if (ok) onClose();
  }

  return (
    <Modal title={`Refund bill #${invoice.number}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <dl className="grid grid-cols-3 gap-2 rounded-lg bg-stone-50 p-3 text-sm">
          <div>
            <dt className="text-xs text-stone-500">Bill total</dt>
            <dd className="font-semibold">{money(invoice.total)}</dd>
          </div>
          <div>
            <dt className="text-xs text-stone-500">Already refunded</dt>
            <dd className="font-semibold">{money(invoice.refundedAmount)}</dd>
          </div>
          <div>
            <dt className="text-xs text-stone-500">Refundable</dt>
            <dd className="font-semibold text-red-700">{money(remaining)}</dd>
          </div>
        </dl>

        <div>
          <label htmlFor="refund-reason" className="label">
            Reason <span className="text-red-600">*</span>
          </label>
          <textarea
            id="refund-reason"
            className={`input min-h-[80px] ${errors.reason ? ERR : ''}`}
            maxLength={REASON_MAX}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onBlur={() => v.blur('reason')}
            placeholder="e.g. Dish returned — overcooked steak"
            aria-invalid={Boolean(errors.reason)}
            aria-describedby={describedBy('refund-reason-count', errors.reason && 'refund-reason-error')}
            autoFocus
          />
          <p id="refund-reason-count" className="mt-1 text-right text-xs text-stone-500">
            {reason.length}/{REASON_MAX}
          </p>
          <FieldError id="refund-reason-error" message={errors.reason} />
        </div>

        <div>
          <label htmlFor="refund-amount" className="label">
            Amount <span className="font-normal text-stone-500">(optional)</span>
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-stone-400">$</span>
            <input
              id="refund-amount"
              type="number"
              inputMode="decimal"
              min={0.01}
              max={remaining}
              step="0.01"
              className={`input pl-7 ${errors.amount ? ERR : ''}`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onBlur={() => v.blur('amount')}
              placeholder={remaining.toFixed(2)}
              aria-invalid={Boolean(errors.amount)}
              aria-describedby="refund-amount-hint"
            />
          </div>
          <p id="refund-amount-hint" className={`mt-1 text-xs ${errors.amount ? 'text-red-600' : 'text-stone-500'}`}>
            {errors.amount ?? `Leave blank to refund the full remaining ${money(remaining)}.`}
          </p>
        </div>

        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Refunds are excluded from reported revenue.
          {full ? ' A full refund marks the bill Refunded and removes any Flame Points the guest earned.' : ''}
        </p>

        <SubmitHint id="refund-submit-hint" fields={v.invalidLabels} className="sm:text-right" />
        <div className="flex flex-col-reverse gap-2 border-t border-stone-200 pt-4 sm:flex-row sm:justify-end">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={pending !== null}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn-danger"
            disabled={pending !== null || !v.isValid}
            aria-disabled={pending !== null || !v.isValid}
            aria-describedby={v.isValid ? undefined : 'refund-submit-hint'}
          >
            {pending
              ? 'Refunding…'
              : `Refund ${amountC > 0 && amountC <= remainingC ? money(fromCents(amountC)) : ''}`.trim()}
          </button>
        </div>
      </form>
    </Modal>
  );
}

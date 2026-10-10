'use client';

import { useState } from 'react';
import type { Invoice, Role } from '@/types';
import { billingApi } from '@/lib/api';
import { can } from '@/lib/permissions';
import { ORDER_STATUS, formatDateTime, money } from '@/lib/format';
import { billWhere, fromCents, toCents } from './bill-utils';
import { useBillAction } from './use-bill-action';

interface ActionProps {
  invoice: Invoice;
  onUpdated: (invoice: Invoice) => void;
  onConflict?: () => void;
}

/**
 * Record payment for an open bill by card or cash (US5.4). Paid bills leave the
 * Open list; a served order closes, frees its table and deducts stock.
 */
export function PayActions({ invoice, onUpdated, onConflict }: ActionProps) {
  const { pending, run } = useBillAction(onUpdated, onConflict);
  const sharePaid = Boolean(invoice.split?.parts.some((p) => p.paid));

  if (sharePaid) {
    return (
      <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800">
        Guests are paying their shares — collect the remaining shares above to settle the bill.
      </p>
    );
  }

  function pay(method: 'card' | 'cash') {
    let already = false;
    run(
      `pay-${method}`,
      async () => {
        const res = await billingApi.pay(invoice.id, method);
        already = res.alreadyPaid;
        return res;
      },
      (inv) =>
        already
          ? `Bill #${inv.number} was already paid.`
          : `Bill #${inv.number} paid by ${method} (${money(inv.total)}) — moved out of Open bills.`,
    );
  }

  const served = invoice.status === 'served';
  return (
    <section aria-labelledby="pay-heading">
      <div className="flex items-baseline justify-between gap-2">
        <h3 id="pay-heading" className="text-sm font-semibold text-stone-800">
          {invoice.split ? 'Or take the whole bill in one payment' : 'Mark paid'}
        </h3>
        <span className="text-lg font-bold tabular-nums">{money(invoice.total)}</span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button type="button" className="btn-primary" onClick={() => pay('card')} disabled={pending !== null}>
          {pending === 'pay-card' ? 'Recording…' : 'Paid by card'}
        </button>
        <button type="button" className="btn-secondary" onClick={() => pay('cash')} disabled={pending !== null}>
          {pending === 'pay-cash' ? 'Recording…' : 'Paid in cash'}
        </button>
      </div>
      <p className="mt-2 text-xs text-stone-500">
        {served
          ? `Paying closes the order${invoice.tableNumber ? ` and frees ${billWhere(invoice)}` : ''}.`
          : `Order is still ${ORDER_STATUS[invoice.status].label.toLowerCase()} — this records a prepayment and the order closes once it is served.`}
      </p>
    </section>
  );
}

/**
 * A settled bill: payment details, refund details and net total (US5.5), "Mark
 * unpaid" with a confirm step for payments recorded by mistake (US5.4), and the
 * manager-only Refund entry point. Reversing a payment is manager/admin only too.
 */
export function PaidActions({
  invoice,
  role,
  onUpdated,
  onConflict,
  onRefund,
}: ActionProps & { role: Role | undefined; onRefund: () => void }) {
  const { pending, run } = useBillAction(onUpdated, onConflict);
  const [confirming, setConfirming] = useState(false);

  const remainingC = toCents(invoice.total) - toCents(invoice.refundedAmount);
  const canUnpay = can.reversePayment(role) && invoice.paymentStatus === 'paid' && !invoice.refund;
  const canRefund = can.refund(role) && invoice.paymentStatus === 'paid' && remainingC > 0;

  async function unpay() {
    const ok = await run('unpay', () => billingApi.unpay(invoice.id), (inv) => `Bill #${inv.number} is unpaid again and back in Open bills.`);
    if (ok) setConfirming(false);
  }

  return (
    <section aria-labelledby="paid-heading" className="space-y-3">
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900">
        <p id="paid-heading" className="font-semibold">
          Paid {money(invoice.total)} {invoice.paymentMethod === 'split' ? 'as a split bill' : `by ${invoice.paymentMethod ?? 'card'}`}
        </p>
        <p className="text-xs text-emerald-800">
          {formatDateTime(invoice.paidAt)}
          {invoice.status === 'closed' ? ' · order closed' : ` · order ${ORDER_STATUS[invoice.status].label.toLowerCase()}`}
          {invoice.pointsEarned ? ` · +${invoice.pointsEarned} Flame Points` : ''}
        </p>
      </div>

      {invoice.refund ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-900">
          <p className="font-semibold">
            {invoice.paymentStatus === 'refunded' ? 'Fully refunded' : 'Partially refunded'} · −{money(invoice.refundedAmount)}
          </p>
          <p className="text-xs">
            “{invoice.refund.reason}” · {formatDateTime(invoice.refund.at)}
          </p>
          <p className="mt-1.5 flex justify-between border-t border-red-200 pt-1.5 font-semibold">
            <span>Net total</span>
            <span>{money(invoice.netTotal)}</span>
          </p>
          <p className="mt-1 text-xs text-red-800">Refunds are excluded from reported revenue.</p>
        </div>
      ) : null}

      {canRefund || canUnpay ? (
        <div className="flex flex-wrap gap-2">
          {canRefund ? (
            <button type="button" className="btn-danger" onClick={onRefund} disabled={pending !== null}>
              {invoice.refund ? `Refund more (${money(fromCents(remainingC))} left)` : 'Refund…'}
            </button>
          ) : null}
          {canUnpay && !confirming ? (
            <button type="button" className="btn-secondary" onClick={() => setConfirming(true)} disabled={pending !== null}>
              Mark unpaid
            </button>
          ) : null}
        </div>
      ) : null}

      {canUnpay && confirming ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm" role="alertdialog" aria-labelledby="unpay-title">
          <p id="unpay-title" className="font-semibold text-amber-900">
            Reverse this payment?
          </p>
          <p className="mt-1 text-xs text-amber-800">
            Use this only for a payment recorded by mistake. The bill goes back to Open, any Flame Points it earned are removed,
            and a closed order re-opens as served{invoice.tableNumber ? ` (${billWhere(invoice)} is occupied again)` : ''}.
          </p>
          <div className="mt-3 flex gap-2">
            <button type="button" className="btn-sm btn-secondary" onClick={() => setConfirming(false)} disabled={pending !== null}>
              Keep as paid
            </button>
            <button type="button" className="btn-sm btn-danger" onClick={unpay} disabled={pending !== null}>
              {pending === 'unpay' ? 'Reversing…' : 'Yes, mark unpaid'}
            </button>
          </div>
        </div>
      ) : null}

      {invoice.paymentStatus === 'paid' && !can.refund(role) ? (
        <p className="text-xs text-stone-500">Refunds and payment reversals are handled by a manager.</p>
      ) : null}
    </section>
  );
}

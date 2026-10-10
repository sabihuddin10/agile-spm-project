'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Order } from '@/types';
import { ORDER_STATUS, PAYMENT_STATUS, formatDateTime, money, titleCase } from '@/lib/format';
import { StatusPill } from '@/components/storefront/status-pill';

const PAGE = 8;

function itemsText(order: Order): string {
  return order.items.map((i) => (i.qty > 1 ? `${i.qty}× ${i.name}` : i.name)).join(', ');
}

/**
 * Past orders, newest first (US1.4): date, dishes, total, payment status and
 * refunds, with a receipt for paid or refunded orders.
 */
export function OrderHistory({
  orders,
  onReceipt,
  receiptLoadingId,
}: {
  orders: Order[];
  onReceipt: (order: Order) => void;
  receiptLoadingId: string | null;
}) {
  const [shown, setShown] = useState(PAGE);
  const sorted = orders.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  if (sorted.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-char-hairline px-4 py-8 text-center">
        <p className="text-sm font-medium text-bone">No past orders yet</p>
        <p className="mt-1 text-sm text-bone-dim">Finished and cancelled orders will appear here.</p>
        <Link href="/menu" className="btn-secondary mt-4">
          Browse the menu
        </Link>
      </div>
    );
  }

  return (
    <div>
      <ul className="divide-y divide-char-hairline overflow-hidden rounded-2xl border border-char-hairline">
        {sorted.slice(0, shown).map((o) => {
          const payment = PAYMENT_STATUS[o.paymentStatus];
          const refunded = o.refund?.amount ?? 0;
          const canReceipt = o.paymentStatus !== 'unpaid';
          return (
            <li key={o.id} className="bg-char-raised px-2.5 py-2 sm:px-4 sm:py-3.5">
              {/* Number and badges, date, dishes on the left; total, points and receipt on the right. */}
              <div className="flex items-start gap-2.5 sm:gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-semibold text-bone">#{o.number}</span>
                    {o.status === 'cancelled' ? <StatusPill tone={ORDER_STATUS.cancelled.tone}>Cancelled</StatusPill> : null}
                    <StatusPill tone={payment.tone}>
                      {payment.label}
                      {o.paymentMethod && o.paymentStatus !== 'unpaid' ? ` · ${o.paymentMethod}` : ''}
                    </StatusPill>
                  </div>
                  <p className="mt-1 text-xs text-bone-faint">
                    {formatDateTime(o.createdAt)} · {o.tableNumber ? `Table ${o.tableNumber}` : titleCase(o.fulfillment)}
                    {o.pointsUsed > 0 ? ` · ${o.pointsUsed} points used` : ''}
                  </p>
                  <p className="mt-1 text-sm text-bone-dim">{itemsText(o)}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <p className={`text-sm font-semibold ${o.status === 'cancelled' ? 'text-bone-faint line-through' : 'text-bone'}`}>
                    {money(o.total)}
                  </p>
                  {o.pointsEarned > 0 && o.paymentStatus === 'paid' ? (
                    <p className="text-xs text-ember-soft">+{o.pointsEarned} pts</p>
                  ) : null}
                  {canReceipt ? (
                    <button
                      type="button"
                      className="btn-sm btn-secondary"
                      onClick={() => onReceipt(o)}
                      disabled={receiptLoadingId === o.id}
                      aria-label={`Receipt for order ${o.number}`}
                    >
                      {receiptLoadingId === o.id ? 'Loading…' : 'Receipt'}
                    </button>
                  ) : null}
                </div>
              </div>

              {refunded > 0 ? (
                <p className="mt-1.5 text-xs text-red-300 sm:mt-2">
                  Refunded {money(refunded)}
                  {o.refund?.reason ? ` — ${o.refund.reason}` : ''}
                  {o.refund?.at ? ` · ${formatDateTime(o.refund.at)}` : ''}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
      {sorted.length > shown ? (
        <div className="mt-3 text-center">
          <button type="button" className="btn-ghost" onClick={() => setShown((n) => n + PAGE)}>
            Show more ({sorted.length - shown} older)
          </button>
        </div>
      ) : null}
    </div>
  );
}

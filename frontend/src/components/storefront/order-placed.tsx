'use client';

import Link from 'next/link';
import type { Order } from '@/types';
import { money } from '@/lib/format';

/** How the customer gets the order and how it gets paid, in plain words. */
export function fulfillmentText(order: Pick<Order, 'fulfillment' | 'tableNumber' | 'deliveryAddress'>): string {
  if (order.fulfillment === 'dine-in') return order.tableNumber ? `Dine in · Table ${order.tableNumber}` : 'Dine in';
  if (order.fulfillment === 'delivery') return order.deliveryAddress ? `Delivery to ${order.deliveryAddress}` : 'Delivery';
  return 'Pickup';
}

export function paymentText(order: Pick<Order, 'paymentStatus' | 'paymentMethod' | 'fulfillment'>): string {
  if (order.paymentStatus === 'refunded') return 'Refunded';
  if (order.paymentStatus === 'paid') return `Paid${order.paymentMethod ? ` by ${order.paymentMethod}` : ''}`;
  const when =
    order.fulfillment === 'dine-in' ? 'at the table' : order.fulfillment === 'delivery' ? 'on delivery' : 'on collection';
  return order.paymentMethod === 'cash' ? `Unpaid — cash ${when}` : `Unpaid — pay ${when}`;
}

/**
 * Order confirmation (US3.1): the server's order number, status, payment state
 * and final total, with a link to track it in My account.
 */
export function OrderPlaced({ order, onDone }: { order: Order; onDone: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center overflow-y-auto px-6 py-10 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-ember/15 text-ember-soft">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-7 w-7" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h2 className="mt-4 font-display text-2xl font-semibold tracking-tight text-bone">Order #{order.number} received</h2>
      <p className="mt-2 text-sm text-bone-dim">
        We&apos;ll let you know as soon as the team confirms it and the kitchen starts cooking.
      </p>

      <dl className="mt-6 w-full max-w-xs space-y-2 rounded-xl border border-char-hairline bg-char-deep p-4 text-left text-sm">
        <Item label="Status" value="Placed — waiting for staff to confirm" />
        <Item label="Order" value={fulfillmentText(order)} />
        <Item label="Payment" value={paymentText(order)} />
        {order.pointsUsed > 0 ? <Item label="Points used" value={`${order.pointsUsed} (−${money(order.discount)})`} /> : null}
        <div className="flex justify-between gap-3 border-t border-char-hairline pt-2 text-base font-semibold text-bone">
          <dt>Total</dt>
          <dd>{money(order.total)}</dd>
        </div>
        {order.pointsEarned > 0 ? (
          <div className="text-xs text-ember-soft">+{order.pointsEarned} Flame Points earned</div>
        ) : null}
      </dl>

      <div className="mt-6 flex w-full max-w-xs flex-col gap-2">
        <Link href="/account#orders" onClick={onDone} className="btn-secondary w-full !py-2.5 text-sm">
          Track it in My account
        </Link>
        <button type="button" className="btn-primary w-full !py-2.5 text-sm" onClick={onDone}>
          Done
        </button>
      </div>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="shrink-0 text-bone-dim">{label}</dt>
      <dd className="text-right text-bone">{value}</dd>
    </div>
  );
}

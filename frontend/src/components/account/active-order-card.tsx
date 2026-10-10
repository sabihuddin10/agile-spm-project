'use client';

import type { Order, OrderStatus } from '@/types';
import { ITEM_STATUS, ORDER_FLOW, ORDER_STATUS, formatTime, modifierText, money, timeAgo } from '@/lib/format';
import { StatusPill } from '@/components/storefront/status-pill';
import { fulfillmentText, paymentText } from '@/components/storefront/order-placed';

/** Lifecycle step labels in the customer's words, which differ by how the order is fulfilled. */
function stepLabel(status: OrderStatus, fulfillment: Order['fulfillment']): string {
  if (status === 'served') return fulfillment === 'pickup' ? 'Collected' : fulfillment === 'delivery' ? 'Delivered' : 'Served';
  if (status === 'closed') return 'Complete';
  return ORDER_STATUS[status].label;
}

const STEP_HINT: Partial<Record<OrderStatus, string>> = {
  placed: 'Waiting for the team to confirm your order.',
  confirmed: 'Confirmed — your order is in the kitchen queue.',
  preparing: 'The kitchen is cooking your order.',
  ready: 'Your order is ready.',
  served: 'Enjoy! Payment is still outstanding.',
};

/** Order lifecycle progress bar (ORDER_FLOW) for customer tracking (US3.3). */
export function OrderProgress({ order }: { order: Order }) {
  const current = ORDER_FLOW.indexOf(order.status);
  const label = stepLabel(order.status, order.fulfillment);
  return (
    <div
      className="grid grid-cols-6 gap-1"
      role="progressbar"
      aria-label={`Order #${order.number} progress`}
      aria-valuemin={1}
      aria-valuemax={ORDER_FLOW.length}
      aria-valuenow={current + 1}
      aria-valuetext={label}
    >
      {ORDER_FLOW.map((s, i) => (
        <div key={s} className="min-w-0" aria-hidden="true">
          <span
            className={`block h-1.5 rounded-full ${
              i < current ? 'bg-ember/70' : i === current ? 'bg-ember' : 'bg-char-hairline'
            }`}
          />
          <span
            className={`mt-1.5 block truncate text-2xs ${
              i === current ? 'font-semibold text-bone' : i < current ? 'text-bone-dim' : 'text-bone-faint'
            }`}
          >
            {stepLabel(s, order.fulfillment)}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * An order in progress (US3.3, US3.4 customer view): lifecycle progress, each
 * dish's kitchen status, where it is going, and cancel while still 'placed'.
 */
export function ActiveOrderCard({
  order,
  now,
  onCancel,
  cancelling = false,
  onReceipt,
  receiptLoading = false,
}: {
  order: Order;
  now: number;
  onCancel: (order: Order) => void;
  cancelling?: boolean;
  /** Offered once the order is paid (e.g. prepaid by card). */
  onReceipt?: (order: Order) => void;
  receiptLoading?: boolean;
}) {
  const status = ORDER_STATUS[order.status];
  const hint =
    order.status === 'served' && order.paymentStatus !== 'unpaid' ? 'Enjoy your meal!' : STEP_HINT[order.status];

  return (
    <article className="rounded-2xl border border-char-hairline bg-char-deep p-4 sm:p-5">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="font-display text-lg font-semibold tracking-tight text-bone">Order #{order.number}</h4>
          <p className="mt-0.5 text-xs text-bone-faint">
            Placed {formatTime(order.createdAt)} · {timeAgo(order.createdAt, now)}
          </p>
        </div>
        <StatusPill tone={status.tone}>{stepLabel(order.status, order.fulfillment)}</StatusPill>
      </header>

      <div className="mt-4">
        <OrderProgress order={order} />
        {hint ? <p className="mt-3 text-sm text-bone-dim">{hint}</p> : null}
      </div>

      <ul className="mt-4 divide-y divide-char-hairline border-y border-char-hairline">
        {order.items.map((i) => {
          const itemStatus = ITEM_STATUS[i.status];
          const options = modifierText(i.modifiers);
          return (
            <li key={i.id} className="flex items-start justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm text-bone">
                  {i.qty} × {i.name}
                </p>
                {options ? <p className="text-xs text-bone-faint">{options}</p> : null}
              </div>
              <StatusPill tone={itemStatus.tone}>{itemStatus.label}</StatusPill>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
        <p className="text-bone-dim">{fulfillmentText(order)}</p>
        <p className="text-bone-dim sm:text-right">{paymentText(order)}</p>
      </div>
      {order.notes ? <p className="mt-1 text-xs text-bone-faint">Note: “{order.notes}”</p> : null}

      <footer className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <p className="text-base font-semibold text-bone">{money(order.total)}</p>
          {onReceipt && order.paymentStatus !== 'unpaid' ? (
            <button
              type="button"
              className="rounded-pill border border-char-hairline px-3 py-1 text-xs font-medium text-bone-dim transition hover:border-ember/40 hover:text-bone disabled:opacity-50"
              onClick={() => onReceipt(order)}
              disabled={receiptLoading}
              aria-label={`Receipt for order ${order.number}`}
            >
              {receiptLoading ? 'Loading…' : 'Receipt'}
            </button>
          ) : null}
        </div>
        {order.status === 'placed' ? (
          <button
            type="button"
            className="btn-sm btn-ghost !text-red-300 hover:!text-red-200"
            onClick={() => onCancel(order)}
            disabled={cancelling}
          >
            {cancelling ? 'Cancelling…' : 'Cancel order'}
          </button>
        ) : (
          <span className="text-xs text-bone-faint">Can no longer be cancelled online</span>
        )}
      </footer>
    </article>
  );
}

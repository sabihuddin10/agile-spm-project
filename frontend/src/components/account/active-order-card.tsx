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
    <article className="rounded-2xl border border-char-hairline bg-char-deep p-3.5 sm:p-5">
      {/* Title and status in one wrapping row; time underneath. */}
      <header className="space-y-0.5">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <h4 className="font-display text-base font-semibold tracking-tight text-bone sm:text-lg">Order #{order.number}</h4>
          <StatusPill tone={status.tone}>{stepLabel(order.status, order.fulfillment)}</StatusPill>
        </div>
        <p className="text-xs text-bone-faint">
          Placed {formatTime(order.createdAt)} · {timeAgo(order.createdAt, now)}
        </p>
      </header>

      <div className="mt-3 sm:mt-4">
        <OrderProgress order={order} />
        {hint ? <p className="mt-2.5 text-sm text-bone-dim sm:mt-3">{hint}</p> : null}
      </div>

      <ul className="mt-3 divide-y divide-char-hairline border-y border-char-hairline sm:mt-4">
        {order.items.map((i) => {
          const itemStatus = ITEM_STATUS[i.status];
          const options = modifierText(i.modifiers);
          return (
            <li key={i.id} className="flex items-start gap-2.5 py-2 sm:gap-3 sm:py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-bone">
                  {i.qty} × {i.name}
                </p>
                {options ? <p className="text-xs text-bone-faint">{options}</p> : null}
              </div>
              <StatusPill tone={itemStatus.tone} className="shrink-0">
                {itemStatus.label}
              </StatusPill>
            </li>
          );
        })}
      </ul>

      <div className="mt-2.5 grid gap-1 text-sm sm:mt-3 sm:grid-cols-2">
        <p className="text-bone-dim">{fulfillmentText(order)}</p>
        <p className="text-bone-dim sm:text-right">{paymentText(order)}</p>
      </div>
      {order.notes ? <p className="mt-1 text-xs text-bone-faint">Note: “{order.notes}”</p> : null}

      {/* Total and receipt left, cancel (or why not) right — one row on phones. */}
      <footer className="mt-3 flex items-center justify-between gap-3 sm:mt-4">
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <p className="text-base font-semibold text-bone">{money(order.total)}</p>
          {onReceipt && order.paymentStatus !== 'unpaid' ? (
            <button
              type="button"
              className="btn-sm btn-secondary"
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
            className="btn-sm btn-ghost shrink-0 !text-red-300 hover:!text-red-200"
            onClick={() => onCancel(order)}
            disabled={cancelling}
          >
            {cancelling ? 'Cancelling…' : 'Cancel order'}
          </button>
        ) : (
          <span className="min-w-0 text-right text-xs text-bone-faint">Can no longer be cancelled online</span>
        )}
      </footer>
    </article>
  );
}

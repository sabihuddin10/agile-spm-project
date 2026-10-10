'use client';

import { memo, useState } from 'react';
import Link from 'next/link';
import type { MenuItem, Order, Role, Table } from '@/types';
import { orderApi } from '@/lib/api';
import { can, canAccess } from '@/lib/permissions';
import {
  ITEM_STATUS,
  ORDER_STATUS,
  PAYMENT_STATUS,
  TABLE_STATUS,
  errorMessage,
  formatTime,
  modifierText,
  money,
  timeAgo,
  titleCase,
} from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { AllergyBanner, orderAllergyFlags } from './allergy-banner';
import { OrderProgress } from './order-progress';
import { ACTIVE_ORDER_STATUSES, lineTotal } from './labels';

/**
 * One live order on the floor view. Shows lifecycle status + progress,
 * per-item status with "Serve" on ready dishes and "Mark served", the table or
 * pickup/delivery details with table assignment, the guest's allergies,
 * dietary notes and order notes, and the confirm / edit / cancel actions for
 * placed orders. Memoised: the floor view polls every few seconds and only
 * cards whose order actually changed should re-render.
 */
export const OrderCard = memo(function OrderCard({
  order,
  role,
  tables,
  menuById,
  now,
  onChanged,
  onEditItems,
}: {
  order: Order;
  role: Role | undefined;
  tables: Table[];
  menuById: Map<string, MenuItem>;
  now: number;
  onChanged: (order: Order) => void;
  onEditItems: (order: Order) => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const floor = can.confirmOrders(role);
  const canServe = can.serveOrders(role);
  const canEdit = can.placeStaffOrders(role);
  // Cancelling a paid order refunds it, so only a manager/admin may do that.
  const canCancel = floor && (order.paymentStatus !== 'paid' || can.cancelPaidOrders(role));
  const active = ACTIVE_ORDER_STATUSES.includes(order.status);
  const status = ORDER_STATUS[order.status];
  const payment = PAYMENT_STATUS[order.paymentStatus];
  const flags = orderAllergyFlags(order, menuById);
  const flaggedDishes = order.items.filter((i) => flags[i.id]).map((i) => i.name);
  const readyCount = order.items.filter((i) => i.status === 'ready').length;
  const actionsDisabled = Boolean(busy);

  async function run(key: string, action: () => Promise<{ order: Order }>, success: (o: Order) => string) {
    setBusy(key);
    try {
      const { order: next } = await action();
      toast(success(next), 'success');
      setConfirmCancel(false);
      onChanged(next);
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(null);
    }
  }

  const placement =
    order.type === 'online' ? (
      <Badge tone="brand">{order.fulfillment === 'delivery' ? 'Delivery' : 'Pickup'}</Badge>
    ) : order.tableNumber ? (
      <Badge tone="blue">Table {order.tableNumber}</Badge>
    ) : canEdit && active ? (
      <select
        className="input !w-48 !py-1.5 !pl-2 !pr-8 text-sm"
        aria-label={`Assign a table to order #${order.number}`}
        value=""
        disabled={Boolean(busy)}
        onChange={(e) => {
          const t = tables.find((x) => x.id === e.target.value);
          if (!t) return;
          run(
            'table',
            () => orderApi.assignTable(order.id, t.id),
            (o) => `Order #${o.number} assigned to Table ${t.number}.`,
          );
        }}
      >
        <option value="">{busy === 'table' ? 'Assigning…' : 'Assign table…'}</option>
        {tables.map((t) => (
          <option key={t.id} value={t.id}>
            Table {t.number} · {t.seats} seats · {t.zone} · {TABLE_STATUS[t.status].label}
          </option>
        ))}
      </select>
    ) : (
      <Badge tone="amber">No table</Badge>
    );

  return (
    <article
      id={`order-${order.number}`}
      className={`card flex scroll-mt-6 flex-col gap-4 !p-4 target:ring-2 target:ring-brand-500 sm:!p-5 ${
        order.status === 'ready' ? 'border-emerald-300 ring-1 ring-emerald-200' : order.status === 'placed' ? 'border-amber-200' : ''
      }`}
      aria-label={`Order #${order.number}`}
    >
      {/* Header */}
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-base font-bold text-stone-900">#{order.number}</span>
            {placement}
            {order.priority === 'rush' ? <Badge tone="red">Rush</Badge> : null}
            {order.source === 'customer' ? <Badge tone="stone">Self-order</Badge> : null}
          </div>
          <p className="text-xs text-stone-500">
            Placed {formatTime(order.createdAt)} · {timeAgo(order.createdAt, now)} · Waiter:{' '}
            <span className="font-medium text-stone-700">{order.waiterName ?? 'Unassigned'}</span>
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge tone={status.tone}>{status.label}</Badge>
          <Badge tone={payment.tone}>
            {payment.label}
            {order.paymentMethod && order.paymentStatus !== 'unpaid' ? ` · ${titleCase(order.paymentMethod)}` : ''}
          </Badge>
        </div>
      </header>

      <OrderProgress status={order.status} />

      {order.type === 'online' && order.fulfillment === 'delivery' ? (
        <p className="text-sm text-stone-600">
          <span className="font-medium text-stone-800">Deliver to:</span> {order.deliveryAddress || '—'}
        </p>
      ) : null}

      {/* Guest + notes (US1.5) */}
      {order.customer ? (
        <div className="space-y-1.5">
          <p className="text-sm">
            <span className="text-stone-500">Guest:</span>{' '}
            <span className="font-medium text-stone-800">{order.customer.name}</span>
          </p>
          <AllergyBanner
            allergies={order.customer.preferences.allergies}
            dietary={order.customer.preferences.dietary}
            flaggedDishes={flaggedDishes}
          />
        </div>
      ) : null}
      {order.notes ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <span className="font-semibold">Note:</span> {order.notes}
        </p>
      ) : null}

      {/* Items (US3.4) */}
      <div>
        {readyCount > 0 && order.status !== 'ready' ? (
          <p className="mb-1.5 text-xs font-semibold text-emerald-700">
            {readyCount} dish{readyCount === 1 ? '' : 'es'} ready for pickup at the pass
          </p>
        ) : null}
        <ul className="divide-y divide-stone-100 overflow-hidden rounded-lg border border-stone-200">
          {order.items.map((item) => {
            const ready = item.status === 'ready';
            const itemStatus = ITEM_STATUS[item.status];
            return (
              <li
                key={item.id}
                className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2 ${ready ? 'bg-emerald-50' : ''}`}
              >
                <div className="min-w-0 flex-1 basis-36">
                  <p className={`text-sm ${item.status === 'served' ? 'text-stone-500 line-through' : 'text-stone-800'}`}>
                    <span className="font-semibold">{item.qty}×</span> {item.name}
                  </p>
                  {item.modifiers.length ? <p className="text-xs text-stone-500">{modifierText(item.modifiers)}</p> : null}
                  {flags[item.id] ? (
                    <p className="text-xs font-semibold text-red-600">Contains {flags[item.id].join(', ')}</p>
                  ) : null}
                  {ready ? (
                    <p className="text-xs font-semibold text-emerald-700">
                      Ready for pickup{item.readyAt ? ` · ${timeAgo(item.readyAt, now)}` : ''}
                    </p>
                  ) : null}
                </div>
                <Badge tone={itemStatus.tone}>{itemStatus.label}</Badge>
                <span className="w-16 text-right text-sm tabular-nums text-stone-600">{money(lineTotal(item.unitPrice, item.qty))}</span>
                {ready && canServe ? (
                  <button
                    type="button"
                    className="btn-sm btn-primary"
                    disabled={Boolean(busy)}
                    onClick={() =>
                      run(
                        `serve:${item.id}`,
                        () => orderApi.setItemStatus(order.id, item.id, 'served'),
                        () => `${item.qty}× ${item.name} served.`,
                      )
                    }
                  >
                    {busy === `serve:${item.id}` ? 'Serving…' : 'Serve'}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-3">
        <p className="text-sm">
          <span className="text-stone-500">Total</span>{' '}
          <span className="font-semibold tabular-nums text-stone-900">{money(order.total)}</span>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {order.status === 'placed' && canEdit && order.paymentStatus === 'unpaid' ? (
            <button type="button" className="btn-sm btn-secondary" disabled={actionsDisabled} onClick={() => onEditItems(order)}>
              Edit items
            </button>
          ) : null}
          {order.status === 'placed' && floor ? (
            <button
              type="button"
              className="btn-sm btn-primary"
              disabled={actionsDisabled}
              onClick={() =>
                run('confirm', () => orderApi.setStatus(order.id, 'confirmed'), (o) => `Order #${o.number} confirmed and sent to the kitchen.`)
              }
            >
              {busy === 'confirm' ? 'Confirming…' : 'Confirm'}
            </button>
          ) : null}
          {order.status === 'ready' && canServe ? (
            <button
              type="button"
              className="btn-sm btn-primary"
              disabled={actionsDisabled}
              onClick={() => run('served', () => orderApi.setStatus(order.id, 'served'), (o) => `Order #${o.number} served.`)}
            >
              {busy === 'served' ? 'Saving…' : 'Mark served'}
            </button>
          ) : null}
          {order.status === 'served' && order.paymentStatus === 'unpaid' ? (
            canAccess(role, 'billing') ? (
              <Link href={`/staff/billing?bill=${encodeURIComponent(order.id)}`} className="btn-sm btn-secondary">
                Take payment
              </Link>
            ) : (
              <span className="text-xs font-medium text-amber-700">Awaiting payment</span>
            )
          ) : null}
          {active && canCancel && !confirmCancel ? (
            <button
              type="button"
              className="btn-sm btn-ghost text-red-700 hover:bg-red-50"
              disabled={actionsDisabled}
              onClick={() => setConfirmCancel(true)}
            >
              Cancel order
            </button>
          ) : null}
        </div>
      </div>

      {order.status === 'placed' && order.paymentStatus !== 'unpaid' ? (
        <p className="-mt-2 text-xs text-stone-500">Prepaid online — {canCancel ? 'cancel to change.' : 'ask a manager to cancel.'}</p>
      ) : null}

      {confirmCancel ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
          <p className="text-sm text-red-800">
            Cancel order #{order.number}?
            {order.paymentStatus === 'paid' ? ' The payment will be refunded.' : ''}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-sm btn-ghost"
              disabled={actionsDisabled}
              onClick={() => setConfirmCancel(false)}
            >
              Keep order
            </button>
            <button
              type="button"
              className="btn-sm btn-danger"
              disabled={actionsDisabled}
              onClick={() => run('cancel', () => orderApi.setStatus(order.id, 'cancelled'), (o) => `Order #${o.number} cancelled.`)}
            >
              {busy === 'cancel' ? 'Cancelling…' : 'Yes, cancel'}
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
});

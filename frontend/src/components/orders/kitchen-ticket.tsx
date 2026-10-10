'use client';

import { useState } from 'react';
import type { MenuItem, Order, Role } from '@/types';
import { orderApi } from '@/lib/api';
import { can } from '@/lib/permissions';
import { ITEM_STATUS, ORDER_STATUS, errorMessage, formatMinutes, formatTime, minutesSince } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { ArrowDownIcon, ArrowUpIcon } from '@/components/ui/icons';
import { useToast } from '@/components/ui/toast';
import { AllergyBanner, orderAllergyFlags } from './allergy-banner';

/** Has a kitchen ticket been waiting longer than the configured threshold? (US4.5) */
export function isDelayed(order: Order, delayMinutes: number, now: number): boolean {
  const since = order.confirmedAt ?? order.createdAt;
  return now - new Date(since).getTime() > delayMinutes * 60000;
}

/**
 * A KDS ticket: queue position, order number, table or takeaway, waiter and
 * time since confirmation; "Delayed" / RUSH flags; per-dish Start → Ready with
 * prominent modifiers, notes and allergy alert; order-level "Start all" /
 * "All ready"; and move up / move down / Rush queue controls.
 */
export function KitchenTicket({
  order,
  position,
  delayMinutes,
  now,
  role,
  canMoveUp,
  canMoveDown,
  menuById,
  onChanged,
}: {
  order: Order;
  position: number;
  delayMinutes: number;
  now: number;
  role: Role | undefined;
  canMoveUp: boolean;
  canMoveDown: boolean;
  menuById: Map<string, MenuItem>;
  onChanged: () => Promise<unknown> | void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const cook = can.cookOrders(role);
  const reprioritize = can.reprioritizeKitchen(role);
  const rush = order.priority === 'rush';
  const delayed = isDelayed(order, delayMinutes, now);
  const elapsed = minutesSince(order.confirmedAt ?? order.createdAt, now);
  const flags = orderAllergyFlags(order, menuById);
  const flaggedDishes = order.items.filter((i) => flags[i.id]).map((i) => i.name);
  const hasQueued = order.items.some((i) => i.status === 'queued');
  const hasOpen = order.items.some((i) => i.status === 'queued' || i.status === 'preparing');
  const where =
    order.type === 'dine-in'
      ? order.tableNumber
        ? `Table ${order.tableNumber}`
        : 'Dine-in · no table'
      : `Takeaway · ${order.fulfillment === 'delivery' ? 'Delivery' : 'Pickup'}`;

  async function run(key: string, action: () => Promise<unknown>, success: string) {
    setBusy(key);
    try {
      await action();
      toast(success, 'success');
      await onChanged();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <article
      className={`card flex flex-col gap-3 !p-3.5 sm:!p-4 ${
        delayed ? '!border-2 !border-red-500 bg-red-50/40' : rush ? '!border-2 !border-amber-400' : ''
      }`}
      aria-label={`Order #${order.number}, queue position ${position}${delayed ? ', delayed' : ''}${rush ? ', rush' : ''}`}
    >
      {/* Header */}
      <header className="flex items-start gap-2.5 sm:gap-3">
        <span
          className={`flex h-8 w-8 shrink-0 sm:h-9 sm:w-9 items-center justify-center rounded-full text-sm font-bold text-white ${
            delayed ? 'bg-red-600' : 'bg-stone-900'
          }`}
        >
          <span className="sr-only">Position </span>
          {position}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-base font-bold leading-none text-stone-900 sm:text-lg">#{order.number}</span>
            {rush ? <span className="badge bg-red-600 uppercase tracking-wide text-white">Rush</span> : null}
            {delayed ? <Badge tone="red">Delayed</Badge> : null}
            <Badge tone={ORDER_STATUS[order.status].tone}>{ORDER_STATUS[order.status].label}</Badge>
          </div>
          <p className="mt-1 text-sm font-semibold text-stone-700">{where}</p>
          <p className="text-xs text-stone-500">Waiter: {order.waiterName ?? '—'}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className={`text-base font-bold tabular-nums leading-none sm:text-lg ${delayed ? 'text-red-600' : 'text-stone-800'}`}>
            {formatMinutes(elapsed)}
          </p>
          <p className="mt-1 text-xs text-stone-500">since {formatTime(order.confirmedAt ?? order.createdAt)}</p>
        </div>
      </header>

      {order.customer ? (
        <AllergyBanner
          allergies={order.customer.preferences.allergies}
          dietary={order.customer.preferences.dietary}
          flaggedDishes={flaggedDishes}
          prominent
        />
      ) : null}
      {order.notes ? (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
          <span className="font-bold uppercase tracking-wide">Note:</span> {order.notes}
        </p>
      ) : null}

      {/* Dishes */}
      <ul className="space-y-1.5 sm:space-y-2">
        {order.items.map((item) => {
          const s = ITEM_STATUS[item.status];
          return (
            <li
              key={item.id}
              className={`rounded-lg border px-2.5 py-2 sm:px-3 sm:py-2.5 ${
                item.status === 'ready'
                  ? 'border-emerald-200 bg-emerald-50'
                  : item.status === 'preparing'
                    ? 'border-amber-200 bg-amber-50/60'
                    : item.status === 'served'
                      ? 'border-stone-200 bg-stone-50 opacity-60'
                      : 'border-stone-200 bg-white'
              }`}
            >
              <div className="flex items-start gap-2.5 sm:gap-3">
                <span className="text-base font-bold tabular-nums leading-tight text-stone-900 sm:text-lg">{item.qty}×</span>
                <div className="min-w-0 flex-1">
                  <p className={`font-semibold leading-tight text-stone-900 ${item.status === 'served' ? 'line-through' : ''}`}>
                    {item.name}
                  </p>
                  {item.modifiers.length ? (
                    <ul className="mt-1 space-y-0.5">
                      {item.modifiers.map((m) => (
                        <li key={`${m.group}:${m.label}`} className="text-sm font-semibold text-brand-700">
                          {m.group}: {m.label}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {flags[item.id] ? (
                    <p className="mt-1 text-xs font-bold uppercase text-red-600">Contains {flags[item.id].join(', ')}</p>
                  ) : null}
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 sm:mt-1.5 sm:gap-2">
                    <Badge tone={s.tone}>{s.label}</Badge>
                    {item.preparedByName && item.status !== 'queued' ? (
                      <span className="text-xs text-stone-500">{item.preparedByName}</span>
                    ) : null}
                  </div>
                </div>
                {cook && item.status === 'queued' ? (
                  <button
                    type="button"
                    className="btn-sm btn-secondary shrink-0"
                    disabled={Boolean(busy)}
                    onClick={() =>
                      run(`item:${item.id}`, () => orderApi.setItemStatus(order.id, item.id, 'preparing'), `${item.name} started.`)
                    }
                  >
                    {busy === `item:${item.id}` ? 'Starting…' : 'Start'}
                  </button>
                ) : cook && item.status === 'preparing' ? (
                  <button
                    type="button"
                    className="btn-sm btn-success shrink-0"
                    disabled={Boolean(busy)}
                    onClick={() =>
                      run(`item:${item.id}`, () => orderApi.setItemStatus(order.id, item.id, 'ready'), `${item.name} is ready.`)
                    }
                  >
                    {busy === `item:${item.id}` ? 'Saving…' : 'Ready'}
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      {/* Order controls */}
      {(cook && hasOpen) || reprioritize ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-stone-100 pt-3">
          {cook && order.status === 'confirmed' && hasQueued ? (
            <button
              type="button"
              className="btn-sm btn-secondary"
              disabled={Boolean(busy)}
              onClick={() => run('start', () => orderApi.setStatus(order.id, 'preparing'), `Order #${order.number} started.`)}
            >
              {busy === 'start' ? 'Starting…' : 'Start all'}
            </button>
          ) : null}
          {cook && hasOpen ? (
            <button
              type="button"
              className="btn-sm btn-success"
              disabled={Boolean(busy)}
              onClick={() =>
                run('ready', () => orderApi.setStatus(order.id, 'ready'), `Order #${order.number} is ready — floor staff notified.`)
              }
            >
              {busy === 'ready' ? 'Saving…' : 'All ready'}
            </button>
          ) : null}
          {reprioritize ? (
            <div className="ml-auto flex items-center gap-1.5" role="group" aria-label={`Queue controls for order #${order.number}`}>
              <button
                type="button"
                className="btn-sm btn-secondary !px-2.5"
                disabled={Boolean(busy) || !canMoveUp}
                onClick={() => run('up', () => orderApi.kitchenAction(order.id, 'up'), `Order #${order.number} moved up.`)}
                aria-label={`Move order #${order.number} up the queue`}
                title="Move up"
              >
                <ArrowUpIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="btn-sm btn-secondary !px-2.5"
                disabled={Boolean(busy) || !canMoveDown}
                onClick={() => run('down', () => orderApi.kitchenAction(order.id, 'down'), `Order #${order.number} moved down.`)}
                aria-label={`Move order #${order.number} down the queue`}
                title="Move down"
              >
                <ArrowDownIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-pressed={rush}
                className={rush ? 'btn-sm btn-danger' : 'btn-sm btn-secondary'}
                disabled={Boolean(busy)}
                onClick={() =>
                  run(
                    'rush',
                    () => orderApi.kitchenAction(order.id, rush ? 'normal' : 'rush'),
                    rush ? `Order #${order.number} back to normal priority.` : `Order #${order.number} marked as rush.`,
                  )
                }
              >
                {busy === 'rush' ? 'Saving…' : rush ? 'Rush on' : 'Rush'}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

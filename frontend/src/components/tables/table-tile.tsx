'use client';

import Link from 'next/link';
import type { Table, TableStatus } from '@/types';
import { Badge } from '@/components/ui/badge';
import { ORDER_STATUS, TABLE_STATUS, money } from '@/lib/format';
import { tileClass } from './status-style';

/** Order in which status buttons appear; 'reserved' is normally set by bookings. */
const STATUS_BUTTONS: TableStatus[] = ['free', 'occupied', 'cleaning', 'reserved'];

function LockIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/**
 * One table on the live floor plan: status, seats, waiter, active orders
 * (each linking to its card on the orders page) and today's next booking, with
 * status / hold / take-over controls and layout edits for managers.
 */
export function TableTile({
  table,
  currentUserId,
  canEditLayout,
  busy,
  onStatus,
  onToggleHold,
  onTake,
  onEdit,
  onRemove,
}: {
  table: Table;
  currentUserId: string | null;
  canEditLayout: boolean;
  busy: boolean;
  onStatus: (status: TableStatus) => void;
  onToggleHold: () => void;
  onTake: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const status = TABLE_STATUS[table.status];
  const orders = table.activeOrders ?? [];
  const booking = table.nextReservation ?? null;
  const mine = Boolean(currentUserId && table.waiterId === currentUserId);

  return (
    <article
      className={`flex flex-col rounded-xl border border-l-4 p-4 shadow-sm ${tileClass(table.status)}`}
      aria-label={`Table ${table.number}, ${status.label}`}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white text-lg font-bold text-stone-800 shadow-sm ring-1 ring-black/5">
            {table.number}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-stone-800">{table.seats} seats</p>
            <p className="truncate text-xs text-stone-500">
              {table.waiterName ? (
                <>
                  Waiter: <span className="font-medium text-stone-700">{mine ? 'You' : table.waiterName}</span>
                </>
              ) : (
                'No waiter assigned'
              )}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge tone={status.tone}>{status.label}</Badge>
          {table.held ? (
            <Badge tone="brand">
              <LockIcon />
              Held
            </Badge>
          ) : null}
        </div>
      </header>

      <div className="mt-3 space-y-1">
        {orders.length > 0 ? (
          orders.map((o) => (
            <Link
              key={o.id}
              href={`/staff/orders#order-${o.number}`}
              className="flex min-h-[36px] items-center justify-between gap-2 rounded-md bg-white/80 px-2 py-1.5 text-xs ring-1 ring-black/5 transition hover:bg-white hover:ring-brand-300"
            >
              <span className="truncate">
                <span className="font-semibold text-stone-800">#{o.number}</span>
                <span className="text-stone-500"> · {ORDER_STATUS[o.status].label}</span>
              </span>
              <span className="font-medium tabular-nums text-stone-700">{money(o.total)}</span>
            </Link>
          ))
        ) : (
          <p className="text-xs text-stone-500">No active orders</p>
        )}
      </div>

      {booking ? (
        <div className="mt-2 rounded-md border border-blue-200 bg-white/80 px-2 py-1.5 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-blue-700">Next booking today</span>
            {booking.late ? <Badge tone="red">Late</Badge> : null}
          </div>
          <p className="mt-0.5 truncate text-stone-700">
            <span className="font-semibold tabular-nums">{booking.time}</span> · {booking.customerName} ·{' '}
            {booking.partySize} {booking.partySize === 1 ? 'guest' : 'guests'}
          </p>
        </div>
      ) : null}

      <div className="mt-auto space-y-2 pt-3">
        <div className="grid grid-cols-4 gap-1.5" role="group" aria-label={`Set status of table ${table.number}`}>
          {STATUS_BUTTONS.map((s) => {
            const active = table.status === s;
            return (
              <button
                key={s}
                type="button"
                disabled={busy || active}
                aria-pressed={active}
                onClick={() => onStatus(s)}
                className={`min-h-[40px] rounded-md px-1 py-1 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed ${
                  active
                    ? 'bg-stone-800 text-white'
                    : 'bg-white/80 text-stone-600 ring-1 ring-stone-200 hover:bg-white hover:text-stone-900 disabled:opacity-60'
                }`}
              >
                {TABLE_STATUS[s].label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            className={table.held ? 'btn-sm btn-primary' : 'btn-sm btn-secondary'}
            disabled={busy}
            aria-pressed={table.held}
            onClick={onToggleHold}
          >
            <LockIcon />
            {table.held ? 'Release hold' : 'Hold'}
          </button>
          {!mine ? (
            <button type="button" className="btn-sm btn-secondary" disabled={busy} onClick={onTake}>
              Take this table
            </button>
          ) : null}
          {canEditLayout ? (
            <span className="ml-auto flex gap-1">
              <button
                type="button"
                className="btn-sm btn-ghost"
                disabled={busy}
                onClick={onEdit}
                aria-label={`Edit table ${table.number}`}
              >
                Edit
              </button>
              <button
                type="button"
                className="btn-sm btn-ghost text-red-700 hover:bg-red-50"
                disabled={busy}
                onClick={onRemove}
                aria-label={`Remove table ${table.number}`}
              >
                Remove
              </button>
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}

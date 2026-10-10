'use client';

import type { Reservation, Table } from '@/types';
import { Badge } from '@/components/ui/badge';
import { CheckIcon } from '@/components/ui/icons';
import { RESERVATION_STATUS, formatDateTime } from '@/lib/format';

/**
 * One booking in the reservation book with its staff actions: confirm, assign
 * a table, seat, cancel and no-show.
 */
export function ReservationCard({
  reservation: r,
  tables,
  busy,
  onConfirm,
  onAssign,
  onSeat,
  onCancel,
  onNoShow,
}: {
  reservation: Reservation;
  tables: Table[];
  busy: boolean;
  onConfirm: () => void;
  onAssign: (tableId: string | null) => void;
  onSeat: () => void;
  onCancel: () => void;
  onNoShow: () => void;
}) {
  const status = RESERVATION_STATUS[r.status];
  const noShowHint = r.late ? 'Mark as no-show and release the table' : 'Available after the grace period';
  const open = r.status === 'requested' || r.status === 'confirmed';
  const choices = tables
    .filter((t) => t.seats >= r.partySize || t.id === r.tableId)
    .sort((a, b) => a.seats - b.seats || a.number - b.number);

  return (
    <li className={`card flex flex-col gap-4 p-4 md:flex-row md:items-start ${r.late ? 'border-red-200' : ''}`}>
      <div className="flex shrink-0 items-baseline gap-3 md:w-20 md:flex-col md:gap-0.5">
        <p className="text-xl font-bold tabular-nums text-stone-900">{r.time}</p>
        <p className="text-sm text-stone-500">
          {r.partySize} {r.partySize === 1 ? 'guest' : 'guests'}
        </p>
      </div>

      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="mr-1 font-semibold text-stone-900">{r.customerName}</p>
          <Badge tone={status.tone}>{status.label}</Badge>
          {r.late ? <Badge tone="red">Late — past grace period</Badge> : null}
          {r.hasAccount ? <Badge tone="stone">Has account</Badge> : null}
        </div>
        <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-stone-600">
          <a href={`mailto:${r.email}`} className="truncate hover:text-brand-700 hover:underline">
            {r.email}
          </a>
          {r.phone ? (
            <a href={`tel:${r.phone.replace(/\s+/g, '')}`} className="hover:text-brand-700 hover:underline">
              {r.phone}
            </a>
          ) : null}
        </p>
        {r.specialRequests ? (
          <p className="rounded-lg bg-amber-50 px-3 py-1.5 text-sm text-amber-900">
            <span className="font-medium">Request:</span> {r.specialRequests}
          </p>
        ) : null}
        <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-stone-500">
          <span>
            Table:{' '}
            <span className="font-medium text-stone-700">{r.tableNumber ? `Table ${r.tableNumber}` : 'Not assigned'}</span>
          </span>
          {r.notifiedAt ? (
            <span className="inline-flex items-center gap-1 text-emerald-700">
              <CheckIcon className="h-3.5 w-3.5" />
              Confirmation sent {formatDateTime(r.notifiedAt)}
            </span>
          ) : null}
          {r.seatedAt ? <span>Seated {formatDateTime(r.seatedAt)}</span> : null}
          {r.cancelledAt ? <span>Cancelled {formatDateTime(r.cancelledAt)}</span> : null}
        </p>
      </div>

      {open ? (
        <div className="flex shrink-0 flex-col gap-2 md:w-64">
          <div>
            <label className="sr-only" htmlFor={`table-${r.id}`}>
              Assign table for {r.customerName}
            </label>
            <select
              id={`table-${r.id}`}
              className="input !py-1.5"
              value={r.tableId ?? ''}
              disabled={busy}
              onChange={(e) => onAssign(e.target.value || null)}
            >
              <option value="">{r.tableId ? 'Unassign table' : 'Assign table…'}</option>
              {choices.map((t) => (
                <option key={t.id} value={t.id}>
                  Table {t.number} · {t.seats} seats · {t.zone}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs leading-snug text-stone-500">
              {choices.length === 0
                ? `No table seats ${r.partySize}.`
                : 'Once confirmed, the table shows Reserved on the floor plan from an hour before the booking.'}
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {r.status === 'requested' ? (
              <button type="button" className="btn-sm btn-primary" disabled={busy} onClick={onConfirm}>
                Confirm
              </button>
            ) : null}
            {r.status === 'confirmed' ? (
              <button type="button" className="btn-sm btn-primary" disabled={busy} onClick={onSeat}>
                Seat party
              </button>
            ) : null}
            {r.status === 'confirmed' ? (
              <span title={noShowHint}>
                <button
                  type="button"
                  className="btn-sm btn-secondary"
                  title={noShowHint}
                  aria-describedby={!r.late ? `noshow-hint-${r.id}` : undefined}
                  disabled={busy || !r.late}
                  onClick={onNoShow}
                >
                  No-show
                </button>
              </span>
            ) : null}
            <button
              type="button"
              className="btn-sm btn-ghost text-red-700 hover:bg-red-50"
              disabled={busy}
              onClick={onCancel}
            >
              Cancel
            </button>
          </div>
          {r.status === 'confirmed' && !r.late ? (
            <p id={`noshow-hint-${r.id}`} className="text-xs text-stone-500">
              No-show becomes available after the grace period.
            </p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

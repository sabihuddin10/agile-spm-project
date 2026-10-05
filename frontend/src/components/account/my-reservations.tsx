'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { reservationApi } from '@/lib/api';
import type { Reservation } from '@/types';
import { RESERVATION_STATUS, errorMessage, formatDate } from '@/lib/format';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/toast';
import { StatusPill } from '@/components/storefront/status-pill';

const CANCELLABLE: Reservation['status'][] = ['requested', 'confirmed'];

/**
 * The customer's bookings (US7.2, US7.4): status, assigned table, and cancel
 * while a booking is still requested or confirmed.
 */
export function MyReservations() {
  const toast = useToast();
  const [items, setItems] = useState<Reservation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await reservationApi.mine();
      setItems(res.reservations);
      setError(null);
    } catch (err) {
      setError(errorMessage(err, 'Could not load your bookings.'));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function cancel(r: Reservation) {
    if (!window.confirm(`Cancel your booking for ${r.partySize} on ${formatDate(r.date)} at ${r.time}?`)) return;
    setCancellingId(r.id);
    try {
      const { reservation } = await reservationApi.cancel(r.id);
      setItems((list) => (list ?? []).map((x) => (x.id === reservation.id ? reservation : x)));
      toast('Booking cancelled.', 'success');
    } catch (err) {
      toast(errorMessage(err, 'Could not cancel the booking.'), 'error');
      load();
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-xl font-semibold tracking-tight text-bone">My bookings</h3>
        <Link href="/book" className="text-sm text-ember-soft underline-offset-2 hover:underline">
          Book a table
        </Link>
      </div>

      {!items ? (
        error ? (
          <p className="mt-4 text-sm text-red-300">
            {error}{' '}
            <button type="button" className="underline underline-offset-2" onClick={load}>
              Try again
            </button>
          </p>
        ) : (
          <Spinner label="Loading bookings…" />
        )
      ) : items.length === 0 ? (
        <p className="mt-4 text-sm text-bone-dim">
          No bookings yet.{' '}
          <Link className="text-ember-soft underline-offset-2 hover:underline" href="/book">
            Reserve a table
          </Link>
          .
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((r) => {
            const status = RESERVATION_STATUS[r.status];
            return (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-char-hairline bg-char-deep px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-bone">
                    {formatDate(r.date)} at {r.time}
                  </p>
                  <p className="mt-0.5 text-xs text-bone-dim">
                    {r.partySize} {r.partySize === 1 ? 'guest' : 'guests'}
                    {r.tableNumber ? ` · Table ${r.tableNumber}` : r.status === 'requested' ? ' · Table assigned on confirmation' : ''}
                  </p>
                  {r.specialRequests ? <p className="mt-0.5 text-xs text-bone-faint">“{r.specialRequests}”</p> : null}
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill tone={status.tone}>{status.label}</StatusPill>
                  {CANCELLABLE.includes(r.status) ? (
                    <button
                      type="button"
                      className="btn-ghost !px-2.5 !py-1 text-xs !text-red-300 hover:!text-red-200"
                      onClick={() => cancel(r)}
                      disabled={cancellingId === r.id}
                    >
                      {cancellingId === r.id ? 'Cancelling…' : 'Cancel'}
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

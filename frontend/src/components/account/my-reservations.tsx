'use client';

import { useCallback, useEffect, useState } from 'react';
import { reservationApi } from '@/lib/api';
import type { Reservation } from '@/types';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/toast';

const STATUS_CHIP: Record<string, string> = {
  pending: 'border-ember/30 bg-ember/10 text-ember-soft',
  confirmed: 'border-bone/30 bg-bone/10 text-bone',
  seated: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
  cancelled: 'border-red-400/30 bg-red-400/10 text-red-300',
  no_show: 'border-char-hairline bg-char-deep text-bone-faint',
};

export function MyReservations() {
  const toast = useToast();
  const [items, setItems] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await reservationApi.mine();
      setItems(res.reservations);
    } catch {
      toast('Failed to load bookings.', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function cancel(r: Reservation) {
    try {
      await reservationApi.remove(r.id);
      toast('Booking cancelled.', 'success');
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Cancel failed.', 'error');
    }
  }

  if (loading) {
    return (
      <Card>
        <Spinner label="Loading bookings…" />
      </Card>
    );
  }

  return (
    <Card>
      <h3 className="font-display text-xl font-semibold tracking-tight text-bone">
        My bookings
      </h3>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-bone-dim">
          No bookings yet.{' '}
          <a className="text-ember-soft underline" href="/book">
            Book a table
          </a>
          .
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between rounded-xl border border-char-hairline bg-char-deep px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-bone">
                  {r.partySize} {r.partySize === 1 ? 'guest' : 'guests'}, {r.date} at {r.time}
                </p>
                {r.specialRequests ? (
                  <p className="mt-0.5 text-xs text-bone-faint">“{r.specialRequests}”</p>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-xs capitalize ${STATUS_CHIP[r.status] ?? STATUS_CHIP.no_show}`}
                >
                  {r.status.replace('_', ' ')}
                </span>
                {r.status !== 'cancelled' && r.status !== 'seated' && r.status !== 'no_show' ? (
                  <button
                    className="btn-ghost !px-2 !py-1 text-xs text-red-400"
                    onClick={() => cancel(r)}
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
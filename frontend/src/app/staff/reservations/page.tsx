'use client';

import { useCallback, useEffect, useState } from 'react';
import { StaffLayout } from '@/components/layout/staff-layout';
import { reservationApi, tableApi } from '@/lib/api';
import type { Reservation, Table } from '@/types';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { Spinner } from '@/components/ui/spinner';

const STATUS_TONE: Record<string, 'amber' | 'blue' | 'emerald' | 'red' | 'stone'> = {
  pending: 'amber',
  confirmed: 'blue',
  seated: 'emerald',
  cancelled: 'red',
  no_show: 'stone',
};

export default function ReservationsPage() {
  const toast = useToast();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async () => {
      try {
        const [r, t] = await Promise.all([
          reservationApi.list(statusFilter ? { status: statusFilter } : undefined),
          tableApi.list(),
        ]);
        setReservations(r.reservations);
        setTables(t.tables);
      } catch {
        toast('Failed to load reservations.', 'error');
      } finally {
        setLoading(false);
      }
    },
    [toast, statusFilter],
  );

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  async function setStatus(r: Reservation, status: Reservation['status'], tableId?: string | null) {
    try {
      await reservationApi.update(r.id, {
        status,
        ...(status === 'seated' && tableId !== undefined ? { tableId } : {}),
      });
      toast(`Reservation → ${status}`, 'success');
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Update failed.', 'error');
    }
  }

  return (
    <StaffLayout>
      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-2xl font-bold">Reservations</h1>
        <Badge tone="blue">Sprint 7 · Live</Badge>
        <div className="ml-auto flex gap-1.5">
          {['', 'pending', 'confirmed', 'seated', 'cancelled', 'no_show'].map((s) => (
            <button
              key={s || 'all'}
              onClick={() => setStatusFilter(s)}
              className={`rounded px-2.5 py-1 text-xs font-medium ${
                statusFilter === s ? 'bg-brand-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <Spinner label="Loading reservations…" />
      ) : reservations.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-sm text-stone-500">No reservations match this filter.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {reservations.map((r) => (
            <div key={r.id} className="card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold">{r.customerName}</p>
                  <p className="text-xs text-stone-500">
                    {r.date} · {r.time} · {r.partySize} {r.partySize === 1 ? 'guest' : 'guests'}
                  </p>
                </div>
                <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
              </div>

              {r.specialRequests ? (
                <p className="mt-3 rounded-lg bg-stone-50 px-3 py-2 text-xs text-stone-500">
                  “{r.specialRequests}”
                </p>
              ) : null}

              <div className="mt-3 text-xs text-stone-500">
                {r.email}
                {r.phone ? ` · ${r.phone}` : ''}
              </div>

              <div className="mt-4 flex items-center justify-between gap-2">
                {r.status === 'pending' || r.status === 'confirmed' ? (
                  <select
                    className="input !py-1.5 text-xs"
                    value={r.tableId ?? ''}
                    onChange={(e) => setStatus(r, r.status === 'pending' ? 'confirmed' : r.status, e.target.value || null)}
                  >
                    <option value="">No table</option>
                    {tables
                      .filter((t) => t.status === 'free' || t.id === r.tableId)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          Table {t.number} ({t.seats})
                        </option>
                      ))}
                  </select>
                ) : (
                  <span className="text-xs text-stone-400">
                    {r.tableId ? `Table ${tables.find((t) => t.id === r.tableId)?.number ?? '—'}` : 'No table'}
                  </span>
                )}

                <div className="flex gap-1.5">
                  {r.status === 'pending' ? (
                    <button className="btn-primary !py-1 text-xs" onClick={() => setStatus(r, 'confirmed', r.tableId)}>
                      Confirm
                    </button>
                  ) : null}
                  {r.status === 'confirmed' ? (
                    <button className="btn-secondary !py-1 text-xs" onClick={() => setStatus(r, 'seated', r.tableId)}>
                      Seat
                    </button>
                  ) : null}
                  {r.status !== 'cancelled' && r.status !== 'no_show' ? (
                    <button className="btn-ghost !py-1 text-xs text-red-600" onClick={() => setStatus(r, 'cancelled')}>
                      Cancel
                    </button>
                  ) : null}
                  {r.status === 'confirmed' ? (
                    <button className="btn-ghost !py-1 text-xs" onClick={() => setStatus(r, 'no_show')}>
                      No-show
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </StaffLayout>
  );
}
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Reservation, ReservationStatus, Table } from '@/types';
import { reservationApi, tableApi } from '@/lib/api';
import { RESERVATION_STATUS, addDaysISO, errorMessage, formatDate, localDateISO } from '@/lib/format';
import { usePolling } from '@/hooks/use-polling';
import { StaffLayout } from '@/components/layout/staff-layout';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { Modal } from '@/components/ui/modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { handleTabListKeyDown } from '@/components/billing/tab-keys';
import { useToast } from '@/components/ui/toast';
import { ReservationCard } from '@/components/reservations/reservation-card';
import { NewBookingForm } from '@/components/reservations/new-booking-form';

type Scope = 'upcoming' | 'past' | 'all';

const SCOPES: { value: Scope; label: string }[] = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'past', label: 'Past' },
  { value: 'all', label: 'All' },
];

const SCOPE_VALUES = SCOPES.map((s) => s.value);

const STATUSES = Object.keys(RESERVATION_STATUS) as ReservationStatus[];

const EMPTY_HINT: Record<Scope, string> = {
  upcoming: 'No bookings from today onward. New requests from the website appear here automatically.',
  past: 'No past bookings yet.',
  all: 'No bookings yet.',
};

function dateHeading(date: string): string {
  const relative =
    date === localDateISO() ? 'Today' : date === addDaysISO(1) ? 'Tomorrow' : date === addDaysISO(-1) ? 'Yesterday' : '';
  return relative ? `${relative} · ${formatDate(date)}` : formatDate(date);
}

/** Reservation book: confirm requests, assign tables, seat, cancel and mark no-shows. */
export default function ReservationsPage() {
  return (
    <StaffLayout section="reservations">
      <ReservationBook />
    </StaffLayout>
  );
}

function ReservationBook() {
  const toast = useToast();
  const [scope, setScope] = useState<Scope>('upcoming');
  const [statusFilter, setStatusFilter] = useState<ReservationStatus | ''>('');
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [pending, setPending] = useState<{ kind: 'cancel' | 'no_show'; reservation: Reservation } | null>(null);
  const request = useRef(0);

  const load = useCallback(async () => {
    const id = ++request.current;
    try {
      const res = await reservationApi.list({ scope });
      if (id === request.current) setReservations(res.reservations);
    } catch (err) {
      if (id === request.current) return err;
    } finally {
      if (id === request.current) setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    setLoading(true);
    load().then((err) => {
      if (err) toast(errorMessage(err, 'Failed to load reservations.'), 'error');
    });
  }, [load, toast]);

  useEffect(() => {
    tableApi
      .list()
      .then((res) => setTables(res.tables))
      .catch((err) => toast(errorMessage(err, 'Failed to load tables.'), 'error'));
  }, [toast]);

  usePolling(load, 10000);

  const counts = useMemo(() => {
    const out = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<ReservationStatus, number>;
    for (const r of reservations) out[r.status] += 1;
    return out;
  }, [reservations]);

  const groups = useMemo(() => {
    const byDate = new Map<string, Reservation[]>();
    for (const r of reservations) {
      if (statusFilter && r.status !== statusFilter) continue;
      byDate.set(r.date, [...(byDate.get(r.date) ?? []), r]);
    }
    return Array.from(byDate.entries());
  }, [reservations, statusFilter]);

  async function run(r: Reservation, action: () => Promise<unknown>, success: string) {
    setBusyId(r.id);
    try {
      await action();
      toast(success, 'success');
      await load();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusyId(null);
    }
  }

  const released = (r: Reservation) => (r.tableNumber ? ` — table ${r.tableNumber} released` : '');

  const confirm = (r: Reservation) =>
    run(r, () => reservationApi.update(r.id, { status: 'confirmed' }), 'Confirmed — guest notified');

  function assign(r: Reservation, tableId: string | null) {
    const table = tables.find((t) => t.id === tableId);
    run(
      r,
      () => reservationApi.update(r.id, { tableId }),
      table ? `Table ${table.number} assigned to ${r.customerName}.` : `Table unassigned from ${r.customerName}.`,
    );
  }

  const seat = (r: Reservation) =>
    run(
      r,
      () => reservationApi.update(r.id, { status: 'seated' }),
      r.tableNumber ? `${r.customerName} seated at table ${r.tableNumber}.` : `${r.customerName} seated.`,
    );

  async function confirmPending() {
    if (!pending) return;
    const r = pending.reservation;
    if (pending.kind === 'cancel') {
      await run(r, () => reservationApi.cancel(r.id), `Booking cancelled${released(r)}.`);
    } else {
      await run(r, () => reservationApi.update(r.id, { status: 'no_show' }), `Marked as no-show${released(r)}.`);
    }
    setPending(null);
  }

  const chip = (active: boolean) =>
    `inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
      active
        ? 'border-brand-600 bg-brand-600 text-white'
        : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:text-stone-900'
    }`;

  return (
    <>
      <PageHeader
        title="Reservations"
        subtitle="Confirm requests, assign tables and check guests in."
        action={
          <button type="button" className="btn-primary" onClick={() => setCreating(true)}>
            + New booking
          </button>
        }
      />

      <div className="mb-4 space-y-3">
        <div
          className="inline-flex rounded-lg border border-stone-200 bg-white p-1 shadow-sm"
          role="tablist"
          aria-label="Booking period"
          onKeyDown={(e) => handleTabListKeyDown(e, SCOPE_VALUES, scope, setScope)}
        >
          {SCOPES.map((s) => (
            <button
              key={s.value}
              id={`booking-tab-${s.value}`}
              type="button"
              role="tab"
              aria-selected={scope === s.value}
              aria-controls="booking-panel"
              tabIndex={scope === s.value ? 0 : -1}
              onClick={() => setScope(s.value)}
              className={`min-h-[36px] rounded-md px-4 py-1.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 ${
                scope === s.value ? 'bg-brand-600 text-white' : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
          <button type="button" className={chip(statusFilter === '')} aria-pressed={statusFilter === ''} onClick={() => setStatusFilter('')}>
            All <span className="tabular-nums opacity-75">{reservations.length}</span>
          </button>
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              className={chip(statusFilter === s)}
              aria-pressed={statusFilter === s}
              onClick={() => setStatusFilter(statusFilter === s ? '' : s)}
            >
              {RESERVATION_STATUS[s].label} <span className="tabular-nums opacity-75">{counts[s]}</span>
            </button>
          ))}
        </div>
      </div>

      <div id="booking-panel" role="tabpanel" aria-labelledby={`booking-tab-${scope}`}>
        {loading ? (
          <Card>
            <Spinner label="Loading reservations…" />
          </Card>
        ) : groups.length === 0 ? (
          <Card>
            <EmptyState
              title={statusFilter ? `No ${RESERVATION_STATUS[statusFilter].label.toLowerCase()} bookings` : 'No bookings'}
              hint={statusFilter ? 'Try another status filter.' : EMPTY_HINT[scope]}
            />
          </Card>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            {groups.map(([date, list]) => (
              <section key={date} aria-labelledby={`day-${date}`}>
                <h2 id={`day-${date}`} className="mb-2 flex items-baseline gap-2 text-sm font-semibold text-stone-800">
                  {dateHeading(date)}
                  <span className="text-xs font-normal text-stone-500">
                    {list.length} {list.length === 1 ? 'booking' : 'bookings'} · {list.reduce((n, r) => n + r.partySize, 0)} guests
                  </span>
                </h2>
                <ul className="space-y-2">
                  {list.map((r) => (
                    <ReservationCard
                      key={r.id}
                      reservation={r}
                      tables={tables}
                      busy={busyId === r.id}
                      onConfirm={() => confirm(r)}
                      onAssign={(tableId) => assign(r, tableId)}
                      onSeat={() => seat(r)}
                      onCancel={() => setPending({ kind: 'cancel', reservation: r })}
                      onNoShow={() => setPending({ kind: 'no_show', reservation: r })}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>

      {pending ? (
        <ConfirmDialog
          title={pending.kind === 'cancel' ? 'Cancel this booking?' : 'Mark as no-show?'}
          confirmLabel={pending.kind === 'cancel' ? 'Yes, cancel booking' : 'Mark no-show'}
          busy={busyId === pending.reservation.id}
          onConfirm={confirmPending}
          onCancel={() => setPending(null)}
        >
          <p>
            {pending.kind === 'cancel'
              ? `${pending.reservation.customerName}'s booking for ${pending.reservation.partySize} at ${pending.reservation.time} on ${formatDate(pending.reservation.date)} will be cancelled.`
              : `${pending.reservation.customerName} didn't arrive for ${pending.reservation.time} on ${formatDate(pending.reservation.date)}.`}
            {pending.reservation.tableNumber ? ` Table ${pending.reservation.tableNumber} will be released.` : ''}
          </p>
        </ConfirmDialog>
      ) : null}

      {creating ? (
        <Modal title="New booking" onClose={() => setCreating(false)} wide>
          <NewBookingForm
            onCancel={() => setCreating(false)}
            onCreated={() => {
              setCreating(false);
              if (scope !== 'past') load();
            }}
          />
        </Modal>
      ) : null}
    </>
  );
}

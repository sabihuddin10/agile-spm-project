'use client';

import { useEffect, useState } from 'react';
import type { Reservation } from '@/types';
import { ApiError, reservationApi, type BookingConflict } from '@/lib/api';
import { addDaysISO, errorMessage, formatDate, localDateISO } from '@/lib/format';
import { useToast } from '@/components/ui/toast';
import { SlotGrid } from './slot-grid';
import { useAvailability } from './use-availability';

const PARTY_SIZES = Array.from({ length: 12 }, (_, i) => i + 1);

function dayLabel(date: string): string {
  if (date === localDateISO()) return 'Today';
  if (date === addDaysISO(1)) return 'Tomorrow';
  return formatDate(date);
}

/**
 * Staff-entered booking, e.g. taken over the phone (US7.1 / US7.2). Uses the
 * same live availability as the public form and can confirm straight away.
 */
export function NewBookingForm({
  onCreated,
  onCancel,
}: {
  onCreated: (reservation: Reservation) => void;
  onCancel: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({
    customerName: '',
    email: '',
    phone: '',
    partySize: 2,
    date: localDateISO(),
    time: '',
    specialRequests: '',
  });
  const [confirmNow, setConfirmNow] = useState(true);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState<BookingConflict | null>(null);
  const [saving, setSaving] = useState(false);
  const availability = useAvailability(form.date, form.partySize);
  const { slots, ready } = availability;

  useEffect(() => {
    if (ready && form.time && !slots.some((s) => s.time === form.time && s.available)) {
      setForm((f) => ({ ...f, time: '' }));
    }
  }, [ready, slots, form.time]);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setError('');
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const missing = [
      !form.customerName.trim() && 'name',
      !form.email.trim() && 'email',
      !form.date && 'date',
      !form.time && 'time',
    ].filter(Boolean);
    if (missing.length) {
      setError(`Please add the guest's ${missing.join(', ')}.`);
      return;
    }
    setSaving(true);
    setConflict(null);
    try {
      let { reservation } = await reservationApi.create({
        customerName: form.customerName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        partySize: form.partySize,
        date: form.date,
        time: form.time,
        specialRequests: form.specialRequests.trim() || undefined,
      });
      if (confirmNow) {
        try {
          ({ reservation } = await reservationApi.update(reservation.id, { status: 'confirmed' }));
          toast(`Booked and confirmed for ${reservation.customerName} — guest notified.`, 'success');
        } catch (err) {
          toast(`Booking saved as Requested, but confirming failed: ${errorMessage(err)}`, 'error');
        }
      } else {
        toast(`Booking requested for ${reservation.customerName}.`, 'success');
      }
      onCreated(reservation);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && Array.isArray((err.data as BookingConflict)?.alternatives)) {
        setConflict(err.data as BookingConflict);
        availability.reload();
      } else {
        toast(errorMessage(err), 'error');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="nb-name">
            Guest name
          </label>
          <input id="nb-name" className="input" value={form.customerName} onChange={(e) => set('customerName', e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="nb-email">
            Email
          </label>
          <input id="nb-email" className="input" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="nb-phone">
            Phone
          </label>
          <input id="nb-phone" className="input" type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="nb-party">
            Party size
          </label>
          <select
            id="nb-party"
            className="input"
            value={form.partySize}
            onChange={(e) => set('partySize', Number(e.target.value))}
          >
            {PARTY_SIZES.map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? 'guest' : 'guests'}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="nb-date">
            Date
          </label>
          <input
            id="nb-date"
            className="input"
            type="date"
            min={localDateISO()}
            value={form.date}
            onChange={(e) => set('date', e.target.value)}
          />
        </div>
      </div>

      <fieldset>
        <legend className="label">Time</legend>
        <SlotGrid
          date={form.date}
          slots={slots}
          value={form.time}
          loading={availability.loading}
          error={availability.error}
          onChange={(time) => {
            set('time', time);
            setConflict(null);
          }}
        />
      </fieldset>

      {conflict ? (
        <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-medium">{conflict.error}</p>
          {conflict.alternatives.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {conflict.alternatives.map((alt) => (
                <button
                  key={`${alt.date}-${alt.time}`}
                  type="button"
                  className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-medium hover:border-brand-400"
                  onClick={() => {
                    setConflict(null);
                    if (alt.date === form.date) availability.reload();
                    setForm((f) => ({ ...f, date: alt.date, time: alt.time }));
                  }}
                >
                  {dayLabel(alt.date)} · {alt.time}
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-xs">No nearby slots are open.</p>
          )}
        </div>
      ) : null}

      <div>
        <label className="label" htmlFor="nb-requests">
          Special requests
        </label>
        <textarea
          id="nb-requests"
          className="input min-h-[56px]"
          maxLength={500}
          value={form.specialRequests}
          onChange={(e) => set('specialRequests', e.target.value)}
        />
      </div>

      <label className="flex items-start gap-2 text-sm text-stone-700">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
          checked={confirmNow}
          onChange={(e) => setConfirmNow(e.target.checked)}
        />
        <span>
          Confirm now <span className="text-stone-500">— sends the guest a confirmation email</span>
        </span>
      </label>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Create booking'}
        </button>
      </div>
    </form>
  );
}

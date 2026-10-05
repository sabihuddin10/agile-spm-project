'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ApiError, reservationApi, type BookingConflict } from '@/lib/api';
import type { AlternativeSlot, Reservation } from '@/types';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/components/ui/toast';
import { Card } from '@/components/ui/card';
import { SlotGrid } from '@/components/reservations/slot-grid';
import { useAvailability } from '@/components/reservations/use-availability';
import { addDaysISO, errorMessage, formatDate, localDateISO } from '@/lib/format';

const MAX_PARTY = 12;
const PARTY_SIZES = Array.from({ length: MAX_PARTY }, (_, i) => i + 1);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FormState {
  customerName: string;
  email: string;
  phone: string;
  partySize: number;
  date: string;
  time: string;
  specialRequests: string;
}

type Field = 'customerName' | 'email' | 'date' | 'time';

const EMPTY: FormState = {
  customerName: '',
  email: '',
  phone: '',
  partySize: 2,
  date: '',
  time: '',
  specialRequests: '',
};

function isConflict(data: unknown): data is BookingConflict {
  return Boolean(data && typeof data === 'object' && Array.isArray((data as BookingConflict).alternatives));
}

function dayLabel(date: string): string {
  if (date === localDateISO()) return 'Today';
  if (date === addDaysISO(1)) return 'Tomorrow';
  return formatDate(date);
}

function validate(form: FormState, today: string): Partial<Record<Field, string>> {
  const errors: Partial<Record<Field, string>> = {};
  if (!form.customerName.trim()) errors.customerName = 'Please enter your name.';
  if (!form.email.trim()) errors.email = 'Please enter your email so we can confirm.';
  else if (!EMAIL_RE.test(form.email.trim())) errors.email = 'That email address doesn’t look right.';
  if (!form.date) errors.date = 'Please choose a date.';
  else if (today && form.date < today) errors.date = 'Please choose today or a later date.';
  if (!form.time) errors.time = form.date ? 'Please pick a time.' : 'Choose a date first, then pick a time.';
  return errors;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1 text-xs text-red-300">
      {message}
    </p>
  );
}

/**
 * Public table booking (US7.1): pick party size and date, choose from live
 * time-slot availability, and request the booking. Fully booked requests show
 * the server's nearest alternative slots.
 */
export function BookingForm() {
  const toast = useToast();
  const { user } = useAuth();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [conflict, setConflict] = useState<BookingConflict | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<Reservation | null>(null);
  const [today, setToday] = useState('');

  const availability = useAvailability(form.date, form.partySize);
  const { slots, ready } = availability;

  // Computed after mount so the server-rendered markup never disagrees about "today".
  useEffect(() => setToday(localDateISO()), []);

  // Signed-in guests get their details filled in; they can still edit them.
  useEffect(() => {
    if (!user) return;
    setForm((f) => ({
      ...f,
      customerName: f.customerName || user.name,
      email: f.email || user.email,
    }));
  }, [user]);

  // Drop a chosen time that is no longer bookable for this date / party size.
  useEffect(() => {
    if (!ready || !form.time) return;
    if (!slots.some((s) => s.time === form.time && s.available)) {
      setForm((f) => ({ ...f, time: '' }));
    }
  }, [ready, slots, form.time]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    if (key in errors) setErrors((e) => ({ ...e, [key]: undefined }));
    if (key === 'date' || key === 'partySize') setErrors((e) => ({ ...e, time: undefined }));
  }

  function pickAlternative(alt: AlternativeSlot) {
    setConflict(null);
    setErrors((e) => ({ ...e, date: undefined, time: undefined }));
    if (alt.date === form.date) availability.reload();
    setForm((f) => ({ ...f, date: alt.date, time: alt.time }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const found = validate(form, today);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    setConflict(null);
    try {
      const { reservation } = await reservationApi.create({
        customerName: form.customerName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        partySize: form.partySize,
        date: form.date,
        time: form.time,
        specialRequests: form.specialRequests.trim() || undefined,
      });
      setDone(reservation);
      toast('Booking requested — we’ll confirm by email.', 'success');
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && isConflict(err.data)) {
        setConflict(err.data);
        availability.reload();
      } else {
        toast(errorMessage(err, 'Booking failed. Please try again.'), 'error');
      }
    } finally {
      setSubmitting(false);
    }
  }

  function startAgain() {
    setDone(null);
    setConflict(null);
    setErrors({});
    setForm((f) => ({ ...EMPTY, customerName: f.customerName, email: f.email, phone: f.phone }));
  }

  if (done) {
    const inAccount = user?.role === 'customer';
    return (
      <Card className="w-full max-w-xl p-6 text-center sm:p-8">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-ember/15 text-ember-soft">
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="font-display mt-3 text-2xl font-semibold tracking-tight text-bone">Booking requested</h2>
        <p className="mt-2 text-sm text-bone-dim">
          Status: <span className="chip chip-diet align-middle">Requested</span>
        </p>
        <p className="mx-auto mt-3 max-w-sm text-sm text-bone-dim">
          We&apos;ll confirm by email to <span className="text-bone">{done.email}</span>
          {inAccount ? ' and in your account' : ''} once the team has checked the book.
        </p>

        <dl className="mx-auto mt-6 grid max-w-sm grid-cols-2 gap-x-4 gap-y-2 rounded-xl border border-char-hairline bg-char-deep p-4 text-left text-sm">
          <dt className="text-bone-faint">Reference</dt>
          <dd className="text-right font-mono text-bone">{done.id}</dd>
          <dt className="text-bone-faint">Name</dt>
          <dd className="truncate text-right text-bone">{done.customerName}</dd>
          <dt className="text-bone-faint">When</dt>
          <dd className="text-right text-bone">
            {dayLabel(done.date)} · {done.time}
          </dd>
          <dt className="text-bone-faint">Party</dt>
          <dd className="text-right text-bone">
            {done.partySize} {done.partySize === 1 ? 'guest' : 'guests'}
          </dd>
        </dl>

        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <button type="button" className="btn-primary" onClick={startAgain}>
            Make another booking
          </button>
          {inAccount ? (
            <Link href="/account" className="btn-secondary">
              View my bookings
            </Link>
          ) : null}
        </div>
      </Card>
    );
  }

  const summary =
    form.date && form.time
      ? `Table for ${form.partySize} · ${dayLabel(form.date)} · ${form.time}`
      : null;

  return (
    <Card className="w-full max-w-xl p-5 sm:p-6">
      <h2 className="font-display text-2xl font-semibold tracking-tight text-bone">Book a table</h2>
      <p className="mt-1 text-sm text-bone-dim">
        {user ? `Booking as ${user.name} — you can change the details below.` : 'No account needed, just your details.'}
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="bk-name">
              Full name
            </label>
            <input
              id="bk-name"
              className="input"
              autoComplete="name"
              value={form.customerName}
              aria-invalid={Boolean(errors.customerName)}
              aria-describedby={errors.customerName ? 'bk-name-err' : undefined}
              onChange={(e) => set('customerName', e.target.value)}
            />
            <FieldError id="bk-name-err" message={errors.customerName} />
          </div>
          <div>
            <label className="label" htmlFor="bk-email">
              Email
            </label>
            <input
              id="bk-email"
              className="input"
              type="email"
              autoComplete="email"
              value={form.email}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'bk-email-err' : undefined}
              onChange={(e) => set('email', e.target.value)}
            />
            <FieldError id="bk-email-err" message={errors.email} />
          </div>
          <div>
            <label className="label" htmlFor="bk-phone">
              Phone <span className="text-bone-faint">(optional)</span>
            </label>
            <input
              id="bk-phone"
              className="input"
              type="tel"
              autoComplete="tel"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="bk-party">
              Party size
            </label>
            <select
              id="bk-party"
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
            <p className="mt-1 text-xs text-bone-faint">More than {MAX_PARTY}? Please give us a call.</p>
          </div>
          <div>
            <label className="label" htmlFor="bk-date">
              Date
            </label>
            <input
              id="bk-date"
              className="input [color-scheme:dark]"
              type="date"
              min={today || undefined}
              value={form.date}
              aria-invalid={Boolean(errors.date)}
              aria-describedby={errors.date ? 'bk-date-err' : undefined}
              onChange={(e) => set('date', e.target.value)}
            />
            <FieldError id="bk-date-err" message={errors.date} />
          </div>
        </div>

        <fieldset>
          <legend className="label">Time</legend>
          <SlotGrid
            variant="storefront"
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
          <FieldError id="bk-time-err" message={errors.time} />
        </fieldset>

        {conflict ? (
          <div role="alert" className="rounded-xl border border-ember/40 bg-ember/10 p-4">
            <p className="text-sm font-medium text-bone">{conflict.error}</p>
            {conflict.alternatives.length > 0 ? (
              <>
                <p className="mt-1 text-xs text-bone-dim">These nearby times are open — tap one to choose it:</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {conflict.alternatives.map((alt) => (
                    <button
                      key={`${alt.date}-${alt.time}`}
                      type="button"
                      className="chip chip-diet !px-3 !py-1 transition hover:border-ember hover:bg-ember/20"
                      onClick={() => pickAlternative(alt)}
                    >
                      {dayLabel(alt.date)} · {alt.time}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="mt-1 text-xs text-bone-dim">
                No nearby times are open — try another day, or call us and we&apos;ll do our best.
              </p>
            )}
          </div>
        ) : null}

        <div>
          <label className="label" htmlFor="bk-requests">
            Special requests <span className="text-bone-faint">(optional)</span>
          </label>
          <textarea
            id="bk-requests"
            className="input min-h-[64px]"
            maxLength={500}
            value={form.specialRequests}
            onChange={(e) => set('specialRequests', e.target.value)}
            placeholder="Birthdays, window seat, allergies…"
          />
        </div>

        <div className="space-y-2">
          {summary ? <p className="text-center text-sm text-bone-dim">{summary}</p> : null}
          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting ? 'Requesting…' : 'Request booking'}
          </button>
        </div>
      </form>
    </Card>
  );
}

'use client';

import { useEffect, useState } from 'react';
import type { Reservation } from '@/types';
import { ApiError, reservationApi, type BookingConflict } from '@/lib/api';
import { addDaysISO, errorMessage, formatDate, localDateISO } from '@/lib/format';
import { useToast } from '@/components/ui/toast';
import { FieldError, SubmitHint, describedBy } from '@/components/forms/field-error';
import { TONES } from '@/components/forms/tone';
import {
  normalizeName, validateEmail, validateMaxLength, validateName, formatPhoneInput, validatePhone,
  EMAIL_MAX, NAME_MAX, PHONE_MAX,
} from '@/lib/validation/fields';
import { useFormValidation, type Rules } from '@/lib/validation/use-form-validation';
import { SlotGrid } from './slot-grid';
import { useAvailability } from './use-availability';

const PARTY_SIZES = Array.from({ length: 12 }, (_, i) => i + 1);
const REQUESTS_MAX = 500;
const ERR = TONES.light.inputError;

interface FormState {
  customerName: string;
  email: string;
  phone: string;
  partySize: number;
  date: string;
  time: string;
  specialRequests: string;
}

/** Mirrors the server's checks for POST /api/reservations (server/src/routes/reservations.js). */
const RULES: Rules<FormState> = {
  customerName: (v) => validateName(v, { missing: "Please add the guest's name." }),
  email: (v) => validateEmail(v, { missing: "Please add the guest's email." }),
  phone: (v) => validatePhone(v),
  date: (v) => (v ? undefined : 'Please choose a date.'),
  time: (v, f) => (v ? undefined : f.date ? 'Please pick a time.' : 'Choose a date first, then pick a time.'),
  specialRequests: (v) => validateMaxLength(v, REQUESTS_MAX, 'Special requests'),
};

const LABELS = {
  customerName: 'Guest name',
  email: 'Email',
  phone: 'Phone',
  date: 'Date',
  time: 'Time',
  specialRequests: 'Special requests',
};

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
  const [form, setForm] = useState<FormState>({
    customerName: '',
    email: '',
    phone: '',
    partySize: 2,
    date: localDateISO(),
    time: '',
    specialRequests: '',
  });
  const [confirmNow, setConfirmNow] = useState(true);
  const [conflict, setConflict] = useState<BookingConflict | null>(null);
  const [saving, setSaving] = useState(false);
  const availability = useAvailability(form.date, form.partySize);
  const { slots, ready } = availability;
  const v = useFormValidation(form, RULES, { labels: LABELS });
  const errors = v.errors;

  useEffect(() => {
    if (ready && form.time && !slots.some((s) => s.time === form.time && s.available)) {
      setForm((f) => ({ ...f, time: '' }));
    }
  }, [ready, slots, form.time]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    // Picking a date or a slot is a complete choice, so check it straight away.
    if (key === 'date' || key === 'time') v.blur(key);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!v.touchAll()) return;
    setSaving(true);
    setConflict(null);
    try {
      let { reservation } = await reservationApi.create({
        customerName: normalizeName(form.customerName),
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
    <form onSubmit={submit} noValidate className="space-y-3 sm:space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="nb-name">
            Guest name
          </label>
          <input
            id="nb-name"
            className={`input ${errors.customerName ? ERR : ''}`}
            maxLength={NAME_MAX + 20}
            autoComplete="off"
            placeholder="e.g. Sara Khan"
            value={form.customerName}
            aria-invalid={Boolean(errors.customerName) || undefined}
            aria-describedby={describedBy(errors.customerName && 'nb-name-err')}
            onChange={(e) => set('customerName', e.target.value)}
            onBlur={() => v.blur('customerName')}
          />
          <FieldError id="nb-name-err" message={errors.customerName} />
        </div>
        <div>
          <label className="label" htmlFor="nb-email">
            Email
          </label>
          <input
            id="nb-email"
            className={`input ${errors.email ? ERR : ''}`}
            type="email"
            inputMode="email"
            maxLength={EMAIL_MAX}
            placeholder="name@example.com"
            value={form.email}
            aria-invalid={Boolean(errors.email) || undefined}
            aria-describedby={describedBy(errors.email && 'nb-email-err')}
            onChange={(e) => set('email', e.target.value)}
            onBlur={() => v.blur('email')}
          />
          <FieldError id="nb-email-err" message={errors.email} />
        </div>
        <div>
          <label className="label" htmlFor="nb-phone">
            Phone <span className="font-normal text-stone-500">(optional)</span>
          </label>
          <input
            id="nb-phone"
            className={`input ${errors.phone ? ERR : ''}`}
            type="tel"
            inputMode="numeric"
            maxLength={PHONE_MAX}
            placeholder="+92 300 1234567"
            value={form.phone}
            aria-invalid={Boolean(errors.phone) || undefined}
            aria-describedby={describedBy(errors.phone && 'nb-phone-err')}
            onChange={(e) => set('phone', formatPhoneInput(e.target.value))}
            onBlur={() => v.blur('phone')}
          />
          <FieldError id="nb-phone-err" message={errors.phone} />
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
            className={`input ${errors.date ? ERR : ''}`}
            type="date"
            min={localDateISO()}
            value={form.date}
            aria-invalid={Boolean(errors.date) || undefined}
            aria-describedby={describedBy(errors.date && 'nb-date-err')}
            onChange={(e) => set('date', e.target.value)}
          />
          <FieldError id="nb-date-err" message={errors.date} />
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
        <FieldError id="nb-time-err" message={errors.time} />
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
          Special requests <span className="font-normal text-stone-500">(optional)</span>
        </label>
        <textarea
          id="nb-requests"
          className={`input min-h-[56px] ${errors.specialRequests ? ERR : ''}`}
          maxLength={REQUESTS_MAX}
          placeholder="e.g. birthday cake, high chair, window seat"
          value={form.specialRequests}
          aria-invalid={Boolean(errors.specialRequests) || undefined}
          aria-describedby={describedBy('nb-requests-count', errors.specialRequests && 'nb-requests-err')}
          onChange={(e) => set('specialRequests', e.target.value)}
          onBlur={() => v.blur('specialRequests')}
        />
        <p id="nb-requests-count" className="mt-1 text-right text-xs text-stone-500">
          {form.specialRequests.length}/{REQUESTS_MAX}
        </p>
        <FieldError id="nb-requests-err" message={errors.specialRequests} />
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

      <div className="space-y-2 pt-1">
        <SubmitHint id="nb-submit-hint" fields={v.invalidLabels} className="text-right" />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={saving || !v.isValid}
            aria-disabled={saving || !v.isValid}
            aria-describedby={v.isValid ? undefined : 'nb-submit-hint'}
          >
            {saving ? 'Saving…' : 'Create booking'}
          </button>
        </div>
      </div>
    </form>
  );
}

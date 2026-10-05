'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Settings } from '@/types';
import { settingsApi } from '@/lib/api';
import { can } from '@/lib/permissions';
import { errorMessage, money } from '@/lib/format';
import { useAuth } from '@/context/auth-context';
import { Card, CardHeader } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/toast';

interface FormState {
  restaurantName: string;
  address: string;
  taxPercent: string;
  servicePercent: string;
  pointValue: string;
  kitchenDelayMinutes: string;
  reservationDurationMinutes: string;
  reservationGraceMinutes: string;
  openingHour: string;
  closingHour: string;
}

type FieldKey = keyof FormState;
type Errors = Partial<Record<FieldKey, string>>;

/** How each server setting maps onto the form, for humanising server validation messages. */
const SERVER_FIELDS: Record<keyof Settings, { field: FieldKey; label: string; unit?: 'percent' | 'money' | 'minutes' | 'hour' }> = {
  restaurantName: { field: 'restaurantName', label: 'Restaurant name' },
  address: { field: 'address', label: 'Address' },
  taxRate: { field: 'taxPercent', label: 'Tax rate', unit: 'percent' },
  serviceChargeRate: { field: 'servicePercent', label: 'Service charge', unit: 'percent' },
  pointValue: { field: 'pointValue', label: 'Flame Point value', unit: 'money' },
  kitchenDelayMinutes: { field: 'kitchenDelayMinutes', label: 'Kitchen delay threshold', unit: 'minutes' },
  reservationDurationMinutes: { field: 'reservationDurationMinutes', label: 'Reservation duration', unit: 'minutes' },
  reservationGraceMinutes: { field: 'reservationGraceMinutes', label: 'Grace period', unit: 'minutes' },
  openingHour: { field: 'openingHour', label: 'Opening hour', unit: 'hour' },
  closingHour: { field: 'closingHour', label: 'Closing hour', unit: 'hour' },
};

const NUMERIC_FIELDS: FieldKey[] = [
  'taxPercent',
  'servicePercent',
  'pointValue',
  'kitchenDelayMinutes',
  'reservationDurationMinutes',
  'reservationGraceMinutes',
  'openingHour',
  'closingHour',
];

const round = (n: number, dp: number) => Math.round(n * 10 ** dp) / 10 ** dp;
const hourLabel = (h: number) => (h === 24 ? '24:00 (midnight)' : `${String(h).padStart(2, '0')}:00`);

function toForm(s: Settings): FormState {
  return {
    restaurantName: s.restaurantName,
    address: s.address,
    taxPercent: String(round(s.taxRate * 100, 2)),
    servicePercent: String(round(s.serviceChargeRate * 100, 2)),
    pointValue: String(s.pointValue),
    kitchenDelayMinutes: String(s.kitchenDelayMinutes),
    reservationDurationMinutes: String(s.reservationDurationMinutes),
    reservationGraceMinutes: String(s.reservationGraceMinutes),
    openingHour: String(s.openingHour),
    closingHour: String(s.closingHour),
  };
}

function toPayload(f: FormState): Partial<Settings> {
  return {
    restaurantName: f.restaurantName.trim(),
    address: f.address.trim(),
    taxRate: round(Number(f.taxPercent) / 100, 6),
    serviceChargeRate: round(Number(f.servicePercent) / 100, 6),
    pointValue: Number(f.pointValue),
    kitchenDelayMinutes: Number(f.kitchenDelayMinutes),
    reservationDurationMinutes: Number(f.reservationDurationMinutes),
    reservationGraceMinutes: Number(f.reservationGraceMinutes),
    openingHour: Number(f.openingHour),
    closingHour: Number(f.closingHour),
  };
}

/** Turn "taxRate must be between 0 and 0.5." into a field error with friendly units. */
function mapServerError(message: string): { field: FieldKey | null; message: string } {
  const range = /^(\w+) must be between ([\d.]+) and ([\d.]+)\.$/.exec(message);
  if (range && Object.prototype.hasOwnProperty.call(SERVER_FIELDS, range[1])) {
    const meta = SERVER_FIELDS[range[1] as keyof Settings];
    const fmt = (v: string) => {
      const n = Number(v);
      if (meta.unit === 'percent') return `${round(n * 100, 2)}%`;
      if (meta.unit === 'money') return money(n);
      if (meta.unit === 'minutes') return `${n} min`;
      if (meta.unit === 'hour') return hourLabel(n);
      return v;
    };
    return { field: meta.field, message: `${meta.label} must be between ${fmt(range[2])} and ${fmt(range[3])}.` };
  }
  const empty = /^(\w+) cannot be empty\.$/.exec(message);
  if (empty && Object.prototype.hasOwnProperty.call(SERVER_FIELDS, empty[1])) {
    const meta = SERVER_FIELDS[empty[1] as keyof Settings];
    return { field: meta.field, message: `${meta.label} cannot be empty.` };
  }
  if (/opening hour/i.test(message)) return { field: 'closingHour', message };
  return { field: null, message };
}

function Field({
  id,
  label,
  hint,
  error,
  prefix,
  suffix,
  children,
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  prefix?: string;
  suffix?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <div className="relative">
        {prefix ? (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-stone-400">{prefix}</span>
        ) : null}
        {children}
        {suffix ? (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-stone-400">{suffix}</span>
        ) : null}
      </div>
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-xs font-medium text-red-600" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1 text-xs text-stone-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Restaurant policy settings (manager/admin): name and address, tax and
 * service-charge rates used on bills (US5.2), Flame Point value, the KDS delay
 * threshold (US4.5), reservation duration and grace period (US7.4) and opening
 * hours. Read-only for anyone without edit permission.
 */
export function SettingsForm() {
  const { user } = useAuth();
  const toast = useToast();
  const editable = can.editSettings(user?.role);

  const [saved, setSaved] = useState<FormState | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await settingsApi.get();
      const next = toForm(res.settings);
      setSaved(next);
      setForm(next);
      setTimeSlots(res.timeSlots);
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const dirty = useMemo(() => Boolean(form && saved && JSON.stringify(form) !== JSON.stringify(saved)), [form, saved]);

  if (loading) {
    return (
      <Card>
        <Spinner label="Loading settings…" />
      </Card>
    );
  }
  if (!form || !saved) {
    return (
      <Card>
        <p className="text-sm text-stone-600">Settings could not be loaded.</p>
        <button type="button" className="btn-secondary mt-3" onClick={load}>
          Try again
        </button>
      </Card>
    );
  }

  const values = form;
  const set = (key: FieldKey, value: string) => {
    setForm((f) => (f ? { ...f, [key]: value } : f));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const input = (key: FieldKey, props: React.InputHTMLAttributes<HTMLInputElement> & { padLeft?: boolean; padRight?: boolean } = {}) => {
    const { padLeft, padRight, ...rest } = props;
    return (
      <input
        id={`setting-${key}`}
        className={`input ${padLeft ? 'pl-7' : ''} ${padRight ? 'pr-12' : ''} ${errors[key] ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : ''}`}
        value={values[key]}
        onChange={(e) => set(key, e.target.value)}
        aria-invalid={Boolean(errors[key])}
        aria-describedby={errors[key] ? `setting-${key}-error` : `setting-${key}-hint`}
        {...rest}
      />
    );
  };

  // Live example bill using the rates being edited (mirrors the server's order maths).
  const tax = Number(values.taxPercent) / 100;
  const service = Number(values.servicePercent) / 100;
  const point = Number(values.pointValue);
  const exampleOk = [tax, service, point].every((n) => Number.isFinite(n) && n >= 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!editable) return;
    const nextErrors: Errors = {};
    if (!values.restaurantName.trim()) nextErrors.restaurantName = 'Restaurant name cannot be empty.';
    if (!values.address.trim()) nextErrors.address = 'Address cannot be empty.';
    for (const key of NUMERIC_FIELDS) {
      if (values[key].trim() === '' || !Number.isFinite(Number(values[key]))) nextErrors[key] = 'Enter a number.';
    }
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      toast('Please fix the highlighted fields.', 'error');
      return;
    }

    setSaving(true);
    try {
      const res = await settingsApi.update(toPayload(values));
      const next = toForm(res.settings);
      setSaved(next);
      setForm(next);
      setErrors({});
      toast('Settings saved. New orders use the updated rates; existing bills keep theirs.', 'success');
    } catch (err) {
      const mapped = mapServerError(errorMessage(err));
      if (mapped.field) setErrors({ [mapped.field]: mapped.message });
      toast(mapped.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      {!editable ? (
        <div className="mb-4 rounded-lg border border-stone-200 bg-stone-100 px-4 py-3 text-sm text-stone-600">
          You can view these settings but only managers and admins can change them.
        </div>
      ) : null}

      <fieldset disabled={!editable || saving} className="min-w-0 space-y-4">
        <Card>
          <CardHeader title="Restaurant" subtitle="Printed on invoices and receipts." />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="setting-restaurantName" label="Restaurant name" error={errors.restaurantName} hint="Shown at the top of every bill and receipt.">
              {input('restaurantName', { maxLength: 80 })}
            </Field>
            <Field id="setting-address" label="Address" error={errors.address} hint="Printed under the name on receipts.">
              {input('address', { maxLength: 160 })}
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Billing & loyalty"
            subtitle="The restaurant-configured rates applied to every bill (US5.2)."
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="setting-taxPercent" label="Tax rate" suffix="%" error={errors.taxPercent} hint="0–50%. Charged on the subtotal after any Flame Point discount.">
              {input('taxPercent', { type: 'number', inputMode: 'decimal', min: 0, max: 50, step: 0.01, padRight: true })}
            </Field>
            <Field id="setting-servicePercent" label="Service charge (dine-in)" suffix="%" error={errors.servicePercent} hint="0–50%. Added to dine-in bills only; online orders skip it.">
              {input('servicePercent', { type: 'number', inputMode: 'decimal', min: 0, max: 50, step: 0.01, padRight: true })}
            </Field>
            <Field id="setting-pointValue" label="Flame Point value" prefix="$" error={errors.pointValue} hint="$0–$1. What one point is worth when a customer redeems it.">
              {input('pointValue', { type: 'number', inputMode: 'decimal', min: 0, max: 1, step: 0.01, padLeft: true })}
            </Field>
          </div>
          {exampleOk ? (
            <p className="mt-4 rounded-lg bg-stone-50 px-3 py-2 text-sm text-stone-600">
              Example: a {money(100)} dine-in bill → service {money(100 * service)} + tax {money(100 * tax)} ={' '}
              <span className="font-semibold text-stone-800">{money(100 + 100 * service + 100 * tax)}</span>. 100 Flame
              Points take {money(100 * point)} off.
            </p>
          ) : null}
          <p className="mt-3 text-xs text-stone-500">
            Rates are locked onto each order when it&apos;s created: changes apply to new orders, and existing bills keep
            the rates they started with.
          </p>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Kitchen" subtitle="Kitchen display (US4.5)." />
            <Field
              id="setting-kitchenDelayMinutes"
              label="Delay threshold"
              suffix="min"
              error={errors.kitchenDelayMinutes}
              hint="1–240 min. The KDS flags tickets waiting longer than this as delayed."
            >
              {input('kitchenDelayMinutes', { type: 'number', inputMode: 'numeric', min: 1, max: 240, step: 1, padRight: true })}
            </Field>
          </Card>

          <Card>
            <CardHeader title="Opening hours" subtitle="Used for table occupancy and peak-hour analytics." />
            <div className="grid grid-cols-2 gap-4">
              <Field id="setting-openingHour" label="Opens" error={errors.openingHour}>
                <select
                  id="setting-openingHour"
                  className="input"
                  value={values.openingHour}
                  onChange={(e) => set('openingHour', e.target.value)}
                >
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>
                      {hourLabel(h)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id="setting-closingHour" label="Closes" error={errors.closingHour}>
                <select
                  id="setting-closingHour"
                  className="input"
                  value={values.closingHour}
                  onChange={(e) => set('closingHour', e.target.value)}
                  aria-invalid={Boolean(errors.closingHour)}
                >
                  {Array.from({ length: 24 }, (_, i) => i + 1).map((h) => (
                    <option key={h} value={h}>
                      {hourLabel(h)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader title="Reservations" subtitle="Table holds and late arrivals (US7.4)." />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="setting-reservationDurationMinutes"
              label="Booking duration"
              suffix="min"
              error={errors.reservationDurationMinutes}
              hint="30–300 min. How long each booking holds its table when checking availability."
            >
              {input('reservationDurationMinutes', { type: 'number', inputMode: 'numeric', min: 30, max: 300, step: 5, padRight: true })}
            </Field>
            <Field
              id="setting-reservationGraceMinutes"
              label="Grace period"
              suffix="min"
              error={errors.reservationGraceMinutes}
              hint="0–120 min. After this, a confirmed guest who hasn't arrived is flagged late and can be marked a no-show."
            >
              {input('reservationGraceMinutes', { type: 'number', inputMode: 'numeric', min: 0, max: 120, step: 1, padRight: true })}
            </Field>
          </div>
          {timeSlots.length ? (
            <p className="mt-4 text-xs text-stone-500">
              Bookable time slots: <span className="text-stone-700">{timeSlots.join(', ')}</span>
            </p>
          ) : null}
        </Card>
      </fieldset>

      {editable ? (
        <div className="sticky bottom-0 z-20 -mx-4 mt-4 flex flex-wrap items-center gap-2 border-t border-stone-200 bg-stone-50/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:bg-white/95">
          <p className={`mr-auto text-sm ${dirty ? 'font-medium text-amber-700' : 'text-stone-500'}`} aria-live="polite">
            {dirty ? 'You have unsaved changes.' : 'All changes saved.'}
          </p>
          <button
            type="button"
            className="btn-secondary"
            disabled={!dirty || saving}
            onClick={() => {
              setForm(saved);
              setErrors({});
            }}
          >
            Reset
          </button>
          <button type="submit" className="btn-primary" disabled={!dirty || saving}>
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      ) : null}
    </form>
  );
}

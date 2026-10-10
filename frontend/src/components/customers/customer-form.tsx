'use client';

import { useEffect, useState } from 'react';
import type { Customer } from '@/types';
import { ALLERGY_OPTIONS, DIETARY_OPTIONS, optionsWith, toggleValue } from '@/components/customers/preference-options';
import { FieldError, SubmitHint, describedBy } from '@/components/forms/field-error';
import { TONES } from '@/components/forms/tone';
import {
  normalizeName, validateContact, validateEmail, validateMaxLength, validateName, formatPhoneInput, validatePhone,
  EMAIL_MAX, NAME_MAX, PHONE_MAX,
} from '@/lib/validation/fields';
import { useFormValidation, type Rules } from '@/lib/validation/use-form-validation';

interface Draft {
  name: string;
  email: string;
  phone: string;
  type: 'walk-in' | 'online';
  dietary: string[];
  allergies: string[];
  notes: string;
}

const empty: Draft = { name: '', email: '', phone: '', type: 'walk-in', dietary: [], allergies: [], notes: '' };
const NOTES_MAX = 500;
const ERR = TONES.light.inputError;

/** The validated fields, plus `contact` (email + phone) for the "one way to reach them" rule. */
type Values = Pick<Draft, 'name' | 'email' | 'phone' | 'notes'> & { contact: string };

/** Mirrors server/src/routes/customers.js; the name rule is stricter on purpose (no "SS"). */
const RULES: Rules<Values> = {
  name: (v) => validateName(v, { missing: "Enter the customer's name." }),
  email: (v) => validateEmail(v, { required: false }),
  phone: (v) => validatePhone(v),
  contact: (_, f) => validateContact(f.email, f.phone),
  notes: (v) => validateMaxLength(v, NOTES_MAX, 'Notes'),
};
const LABELS = { name: 'Full name', email: 'Email', phone: 'Phone', contact: 'Email or phone', notes: 'Notes' };

function toDraft(initial?: Customer | null): Draft {
  return initial
    ? {
        name: initial.name,
        email: initial.email,
        phone: initial.phone,
        type: initial.type,
        dietary: initial.preferences.dietary,
        allergies: initial.preferences.allergies,
        notes: initial.notes,
      }
    : empty;
}

/** Add or edit a ledger customer (US1.1) with dietary preferences and allergies (US1.5). */
export function CustomerForm({
  initial,
  onSubmit,
  onCancel,
  submitting,
  error,
}: {
  initial?: Customer | null;
  onSubmit: (data: Partial<Customer>) => void;
  onCancel: () => void;
  submitting?: boolean;
  /** Server validation message, shown inside the dialog. */
  error?: string | null;
}) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial));
  const v = useFormValidation<Values>(
    { name: draft.name, email: draft.email, phone: draft.phone, notes: draft.notes, contact: `${draft.email}\n${draft.phone}` },
    RULES,
    { labels: LABELS },
  );
  const errors = v.errors;
  const { reset } = v;

  useEffect(() => {
    setDraft(toDraft(initial));
    reset();
  }, [initial, reset]);

  function toggle(list: 'dietary' | 'allergies', value: string) {
    setDraft((d) => ({ ...d, [list]: toggleValue(d[list], value) }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!v.touchAll()) return;
    onSubmit({
      name: normalizeName(draft.name),
      email: draft.email.trim(),
      phone: draft.phone.trim(),
      type: draft.type,
      preferences: { dietary: draft.dietary, allergies: draft.allergies },
      notes: draft.notes,
    });
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="customer-name" className="label">
            Full name *
          </label>
          <input
            id="customer-name"
            className={`input ${errors.name ? ERR : ''}`}
            required
            maxLength={NAME_MAX}
            autoComplete="off"
            placeholder="e.g. Sara Khan"
            value={draft.name}
            aria-invalid={Boolean(errors.name) || undefined}
            aria-describedby={describedBy(errors.name && 'customer-name-err')}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            onBlur={() => v.blur('name')}
          />
          <FieldError id="customer-name-err" message={errors.name} />
        </div>
        <div>
          <label htmlFor="customer-phone" className="label">
            Phone
          </label>
          <input
            id="customer-phone"
            type="tel"
            inputMode="numeric"
            className={`input ${errors.phone || errors.contact ? ERR : ''}`}
            maxLength={PHONE_MAX}
            placeholder="+92 300 1234567"
            value={draft.phone}
            aria-invalid={Boolean(errors.phone || errors.contact) || undefined}
            aria-describedby={describedBy(errors.phone && 'customer-phone-err', errors.contact && 'customer-contact-err')}
            onChange={(e) => setDraft({ ...draft, phone: formatPhoneInput(e.target.value) })}
            onBlur={() => {
              v.blur('phone');
              v.blur('contact');
            }}
          />
          <FieldError id="customer-phone-err" message={errors.phone} />
        </div>
        <div>
          <label htmlFor="customer-email" className="label">
            Email
          </label>
          <input
            id="customer-email"
            type="email"
            inputMode="email"
            className={`input ${errors.email || errors.contact ? ERR : ''}`}
            maxLength={EMAIL_MAX}
            placeholder="name@example.com"
            value={draft.email}
            aria-invalid={Boolean(errors.email || errors.contact) || undefined}
            aria-describedby={describedBy(errors.email && 'customer-email-err', errors.contact && 'customer-contact-err')}
            onChange={(e) => setDraft({ ...draft, email: e.target.value })}
            onBlur={() => {
              v.blur('email');
              v.blur('contact');
            }}
          />
          <FieldError id="customer-email-err" message={errors.email} />
        </div>
        <div>
          <label htmlFor="customer-type-field" className="label">
            Type
          </label>
          <select
            id="customer-type-field"
            className="input"
            value={draft.type}
            onChange={(e) => setDraft({ ...draft, type: e.target.value as 'walk-in' | 'online' })}
          >
            <option value="walk-in">Walk-in</option>
            <option value="online">Online</option>
          </select>
        </div>
        {errors.contact ? (
          <p id="customer-contact-err" className="-mt-2 text-xs text-red-600 sm:col-span-2">
            {errors.contact}
          </p>
        ) : (
          <p className="-mt-2 text-xs text-stone-500 sm:col-span-2">Add at least an email or a phone number.</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="label">Dietary preferences</p>
          <div className="flex flex-wrap gap-2">
            {optionsWith(DIETARY_OPTIONS, draft.dietary).map((d) => (
              <Chip key={d} active={draft.dietary.includes(d)} onClick={() => toggle('dietary', d)} label={d} />
            ))}
          </div>
        </div>
        <div>
          <p className="label">Allergies</p>
          <div className="flex flex-wrap gap-2">
            {optionsWith(ALLERGY_OPTIONS, draft.allergies).map((a) => (
              <Chip key={a} active={draft.allergies.includes(a)} onClick={() => toggle('allergies', a)} label={a} danger />
            ))}
          </div>
        </div>
      </div>

      <div>
        <label htmlFor="customer-notes" className="label">
          Notes
        </label>
        <textarea
          id="customer-notes"
          className={`input min-h-[72px] ${errors.notes ? ERR : ''}`}
          maxLength={NOTES_MAX}
          placeholder="e.g. allergic to peanuts, prefers window seat"
          value={draft.notes}
          aria-invalid={Boolean(errors.notes) || undefined}
          aria-describedby={describedBy('customer-notes-count', errors.notes && 'customer-notes-err')}
          onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          onBlur={() => v.blur('notes')}
        />
        <p id="customer-notes-count" className="mt-1 text-right text-xs text-stone-500">
          {draft.notes.length}/{NOTES_MAX}
        </p>
        <FieldError id="customer-notes-err" message={errors.notes} />
      </div>

      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="space-y-2">
        <SubmitHint id="customer-submit-hint" fields={v.invalidLabels} className="text-right" />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="btn-secondary" disabled={submitting}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={submitting || !v.isValid}
            aria-disabled={submitting || !v.isValid}
            aria-describedby={v.isValid ? undefined : 'customer-submit-hint'}
          >
            {submitting ? 'Saving…' : initial ? 'Save changes' : 'Add customer'}
          </button>
        </div>
      </div>
    </form>
  );
}

function Chip({
  label,
  active,
  onClick,
  danger = false,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={active}
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
        active
          ? danger
            ? 'border-red-300 bg-red-50 text-red-700'
            : 'border-emerald-300 bg-emerald-50 text-emerald-700'
          : 'border-stone-200 bg-white text-stone-500 hover:bg-stone-50'
      }`}
    >
      {label}
    </button>
  );
}
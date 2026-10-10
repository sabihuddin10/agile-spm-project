'use client';

import { useState } from 'react';
import type { Customer } from '@/types';
import { customerApi } from '@/lib/api';
import { useAuth } from '@/context/auth-context';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { errorMessage } from '@/lib/format';
import { ALLERGY_OPTIONS, DIETARY_OPTIONS, optionsWith, toggleValue } from '@/components/customers/preference-options';
import {
  normalizeName, validateEmail, validateMaxLength, validateName, formatPhoneInput, validatePhone, EMAIL_MAX, NAME_MAX, PHONE_MAX,
} from '@/lib/validation/fields';
import { useFormValidation, type Rules } from '@/lib/validation/use-form-validation';
import { FieldError, SubmitHint, describedBy } from '@/components/forms/field-error';

const NOTES_MAX = 500;

const RULES: Rules<Draft> = {
  name: (v) => validateName(v, { missing: 'Name cannot be empty.' }),
  email: (v) => validateEmail(v),
  phone: (v) => validatePhone(v),
  notes: (v) => validateMaxLength(v, NOTES_MAX, 'Notes'),
};
const LABELS = { name: 'Name', email: 'Email', phone: 'Phone', notes: 'Notes' };

interface Draft {
  name: string;
  email: string;
  phone: string;
  notes: string;
  dietary: string[];
  allergies: string[];
}

function toDraft(c: Customer): Draft {
  return {
    name: c.name,
    email: c.email,
    phone: c.phone,
    notes: c.notes,
    dietary: c.preferences?.dietary ?? [],
    allergies: c.preferences?.allergies ?? [],
  };
}


/**
 * Self-service profile (US1.2): contact details, notes, and dietary preferences
 * and allergies as toggle chips (US1.5). Server validation errors are shown inline.
 * Re-mount with key={customer.id} to load a different profile.
 */
export function ProfileEditor({ customer, onSaved }: { customer: Customer; onSaved: (customer: Customer) => void }) {
  const toast = useToast();
  const { refreshUser } = useAuth();
  const [saved, setSaved] = useState<Draft>(() => toDraft(customer));
  const [draft, setDraft] = useState<Draft>(saved);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const v = useFormValidation(draft, RULES, { labels: LABELS });

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setError(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!v.touchAll()) return;
    setSaving(true);
    setError(null);
    try {
      const { customer: updated } = await customerApi.updateMe({
        name: normalizeName(draft.name),
        email: draft.email.trim(),
        phone: draft.phone.trim(),
        notes: draft.notes,
        preferences: { dietary: draft.dietary, allergies: draft.allergies },
      });
      const next = toDraft(updated);
      setSaved(next);
      setDraft(next);
      v.reset();
      onSaved(updated);
      toast('Profile saved.', 'success');
      refreshUser().catch(() => undefined); // keep the header's name/email in step
    } catch (err) {
      setError(errorMessage(err, 'Your profile could not be saved.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <form onSubmit={save} noValidate>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-base font-semibold tracking-tight text-bone sm:text-xl">Your profile</h3>
          <span className="rounded-full border border-ember/30 bg-ember/10 px-3 py-1 text-xs font-medium text-ember-soft">
            {customer.loyaltyPoints} Flame Points
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:mt-5 sm:grid-cols-2 sm:gap-4">
          <Field
            id="profile-name"
            label="Name"
            value={draft.name}
            onChange={(value) => set('name', value)}
            onBlur={() => v.blur('name')}
            error={v.errors.name}
            autoComplete="name"
            maxLength={NAME_MAX + 20}
            placeholder="e.g. Sara Khan"
            required
          />
          <Field
            id="profile-email"
            label="Email"
            type="email"
            value={draft.email}
            onChange={(value) => set('email', value)}
            onBlur={() => v.blur('email')}
            error={v.errors.email}
            autoComplete="email"
            maxLength={EMAIL_MAX}
            placeholder="name@example.com"
            required
          />
          <Field
            id="profile-phone"
            label="Phone"
            type="tel"
            value={draft.phone}
            onChange={(value) => set('phone', formatPhoneInput(value))}
            onBlur={() => v.blur('phone')}
            error={v.errors.phone}
            autoComplete="tel"
            maxLength={PHONE_MAX}
            placeholder="+92 300 1234567"
          />
        </div>

        <PreferenceChips
          title="Dietary preferences"
          hint="We'll highlight dishes that suit you."
          options={optionsWith(DIETARY_OPTIONS, draft.dietary)}
          selected={draft.dietary}
          recorded={saved.dietary}
          onToggle={(v) => set('dietary', toggleValue(draft.dietary, v))}
        />
        <PreferenceChips
          title="Allergies"
          hint="Dishes containing these are flagged on the menu and shared with the kitchen."
          options={optionsWith(ALLERGY_OPTIONS, draft.allergies)}
          selected={draft.allergies}
          recorded={saved.allergies}
          onToggle={(v) => set('allergies', toggleValue(draft.allergies, v))}
          danger
        />

        <div className="mt-4 sm:mt-5">
          <label htmlFor="profile-notes" className="label">
            Notes for the restaurant
          </label>
          <textarea
            id="profile-notes"
            className="input min-h-[72px] resize-y"
            placeholder="e.g. prefers a quiet table, contactless delivery"
            value={draft.notes}
            onChange={(e) => set('notes', e.target.value)}
            onBlur={() => v.blur('notes')}
            maxLength={NOTES_MAX}
            aria-invalid={Boolean(v.errors.notes) || undefined}
            aria-describedby={describedBy('profile-notes-count', v.errors.notes && 'profile-notes-error')}
          />
          <p id="profile-notes-count" className="mt-1 text-right text-xs text-bone-faint">
            {draft.notes.length}/{NOTES_MAX}
          </p>
          <FieldError id="profile-notes-error" message={v.errors.notes} tone="dark" />
        </div>

        {error ? (
          <p role="alert" className="mt-4 rounded-xl border border-red-400/40 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-3 sm:mt-5">
          <button
            type="submit"
            className="btn-primary"
            disabled={saving || !dirty || !v.isValid}
            aria-disabled={saving || !dirty || !v.isValid}
            aria-describedby={v.isValid ? undefined : 'profile-submit-hint'}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          {dirty && !saving ? (
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setDraft(saved);
                setError(null);
                v.reset();
              }}
            >
              Discard
            </button>
          ) : null}
          {dirty ? <span className="text-xs text-bone-faint">Unsaved changes</span> : null}
        </div>
        <SubmitHint id="profile-submit-hint" fields={v.invalidLabels} tone="dark" className="mt-2" />
      </form>
    </Card>
  );
}

function PreferenceChips({
  title,
  hint,
  options,
  selected,
  recorded,
  onToggle,
  danger = false,
}: {
  title: string;
  hint: string;
  options: string[];
  selected: string[];
  /** What is saved on the profile right now. */
  recorded: string[];
  onToggle: (value: string) => void;
  danger?: boolean;
}) {
  return (
    <fieldset className="mt-4 sm:mt-5">
      <legend className="label">{title}</legend>
      <p className="-mt-0.5 mb-2 text-xs text-bone-faint">{hint}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = selected.includes(o);
          return (
            <button
              key={o}
              type="button"
              role="checkbox"
              aria-checked={on}
              onClick={() => onToggle(o)}
              className={`rounded-full border px-3 py-1.5 text-sm capitalize transition ${
                on
                  ? danger
                    ? 'border-red-400/50 bg-red-500/15 text-red-200'
                    : 'border-ember bg-ember/15 text-bone'
                  : 'border-char-hairline bg-char-deep text-bone-dim hover:border-ember/40 hover:text-bone'
              }`}
            >
              {on ? '✓ ' : ''}
              {o}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-bone-faint">
        On file: {recorded.length > 0 ? <span className="text-bone-dim">{recorded.join(', ')}</span> : 'None recorded'}
      </p>
    </fieldset>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  onBlur,
  error,
  type = 'text',
  autoComplete,
  maxLength,
  placeholder,
  required = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  error?: string;
  type?: string;
  autoComplete?: string;
  maxLength?: number;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <input
        id={id}
        type={type}
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        autoComplete={autoComplete}
        maxLength={maxLength}
        placeholder={placeholder}
        required={required}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={describedBy(error && `${id}-error`)}
      />
      <FieldError id={`${id}-error`} message={error} tone="dark" />
    </div>
  );
}

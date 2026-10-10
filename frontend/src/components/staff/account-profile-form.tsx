'use client';

import { useState } from 'react';
import type { User } from '@/types';
import { ApiError, authApi } from '@/lib/api';
import { errorMessage } from '@/lib/format';
import { useAuth } from '@/context/auth-context';
import { Card, CardHeader } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { TextField } from '@/components/staff/text-field';
import { SubmitHint } from '@/components/forms/field-error';
import { normalizeName, validateEmail, validateName, validatePhone, EMAIL_MAX, NAME_MAX, PHONE_MAX } from '@/lib/validation/fields';
import { useFormValidation, type Rules } from '@/lib/validation/use-form-validation';

interface Draft {
  name: string;
  email: string;
  phone: string;
}

type Errors = Partial<Record<keyof Draft | 'currentPassword', string>>;

interface Values extends Draft {
  currentPassword: string;
  /** Whether the sign-in email differs from the saved one (then the current password is needed). */
  emailChanged: boolean;
}

const RULES: Rules<Values> = {
  name: (v) => validateName(v, { missing: 'Enter your name.' }),
  email: (v) => validateEmail(v, { missing: 'Enter a valid email address.' }),
  phone: (v) => validatePhone(v),
  currentPassword: (v, all) => (all.emailChanged && !v ? 'Enter your current password to change your email.' : undefined),
};

const LABELS = { name: 'Name', email: 'Email', phone: 'Phone', currentPassword: 'Current password' };

const toDraft = (u: User): Draft => ({ name: u.name, email: u.email, phone: u.phone ?? '' });

/**
 * A staff member's own name, email and phone. Changing the email asks for the
 * current password in the same form, as the server requires it.
 */
export function AccountProfileForm({ user }: { user: User }) {
  const { updateSession } = useAuth();
  const toast = useToast();
  const [saved, setSaved] = useState<Draft>(() => toDraft(user));
  const [draft, setDraft] = useState<Draft>(saved);
  const [currentPassword, setCurrentPassword] = useState('');
  /** Errors the server sent back (shown until the field is edited). */
  const [serverErrors, setServerErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const emailChanged = draft.email.trim().toLowerCase() !== saved.email.toLowerCase();
  const dirty = draft.name !== saved.name || draft.email !== saved.email || draft.phone !== saved.phone;
  const v = useFormValidation<Values>({ ...draft, currentPassword, emailChanged }, RULES, { labels: LABELS });
  const errors: Errors = {
    name: serverErrors.name ?? v.errors.name,
    email: serverErrors.email ?? v.errors.email,
    phone: serverErrors.phone ?? v.errors.phone,
    currentPassword: serverErrors.currentPassword ?? v.errors.currentPassword,
  };

  function set(key: keyof Draft, value: string) {
    setDraft((d) => ({ ...d, [key]: value }));
    setServerErrors((e) => ({ ...e, [key]: undefined }));
    setFormError(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!v.touchAll()) return;

    setSaving(true);
    try {
      const { user: updated } = await authApi.updateMe({
        name: normalizeName(draft.name),
        phone: draft.phone.trim(),
        ...(emailChanged ? { email: draft.email.trim(), currentPassword } : {}),
      });
      const next = toDraft(updated);
      setSaved(next);
      setDraft(next);
      setCurrentPassword('');
      v.reset();
      updateSession(updated);
      toast('Profile saved.', 'success');
    } catch (err) {
      const message = errorMessage(err, 'Your profile could not be saved.');
      if (err instanceof ApiError && err.status === 409) setServerErrors({ email: message });
      else if (err instanceof ApiError && err.status === 400 && /password/i.test(message)) setServerErrors({ currentPassword: message });
      else setFormError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader title="Profile" subtitle="How you appear to the team and how we reach you." />
      <form onSubmit={save} noValidate>
        <fieldset disabled={saving} className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="account-name"
            label="Name"
            value={draft.name}
            onChange={(value) => set('name', value)}
            onBlur={() => v.blur('name')}
            autoComplete="name"
            maxLength={NAME_MAX + 20}
            placeholder="e.g. Sara Khan"
            error={errors.name}
          />
          <TextField
            id="account-email"
            label="Email"
            type="email"
            value={draft.email}
            onChange={(value) => set('email', value)}
            onBlur={() => v.blur('email')}
            autoComplete="email"
            maxLength={EMAIL_MAX}
            placeholder="name@example.com"
            inputMode="email"
            error={errors.email}
            hint="You sign in with this address."
          />
          <TextField
            id="account-phone"
            label="Phone"
            type="tel"
            value={draft.phone}
            onChange={(value) => set('phone', value)}
            onBlur={() => v.blur('phone')}
            autoComplete="tel"
            maxLength={PHONE_MAX}
            placeholder="+92 300 1234567"
            inputMode="tel"
            error={errors.phone}
            hint="Digits, spaces and + ( ) - . (7 to 20 digits)."
            optional
          />
          {emailChanged ? (
            <TextField
              id="account-current-password"
              label="Current password"
              type="password"
              value={currentPassword}
              onChange={(value) => {
                setCurrentPassword(value);
                setServerErrors((e) => ({ ...e, currentPassword: undefined }));
              }}
              onBlur={() => v.blur('currentPassword')}
              autoComplete="current-password"
              error={errors.currentPassword}
              hint="Needed to change the email you sign in with."
            />
          ) : null}
        </fieldset>

        {formError ? (
          <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {formError}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            className="btn-primary"
            disabled={saving || !dirty || !v.isValid}
            aria-disabled={saving || !dirty || !v.isValid}
            aria-describedby={v.isValid ? undefined : 'account-submit-hint'}
          >
            {saving ? 'Saving…' : 'Save profile'}
          </button>
          {dirty && !saving ? (
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setDraft(saved);
                setCurrentPassword('');
                setServerErrors({});
                v.reset();
                setFormError(null);
              }}
            >
              Discard
            </button>
          ) : null}
        </div>
        <SubmitHint id="account-submit-hint" fields={v.invalidLabels} className="mt-2" />
      </form>
    </Card>
  );
}

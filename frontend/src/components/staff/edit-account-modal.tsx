'use client';

import { useState } from 'react';
import type { User } from '@/types';
import { ApiError, authApi } from '@/lib/api';
import { errorMessage } from '@/lib/format';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { TextField } from '@/components/staff/text-field';
import { SubmitHint } from '@/components/forms/field-error';
import { normalizeName, validateEmail, validateName, validatePhone, EMAIL_MAX, NAME_MAX, PHONE_MAX } from '@/lib/validation/fields';
import { useFormValidation, type Rules } from '@/lib/validation/use-form-validation';

type Field = 'name' | 'email' | 'phone';
type Draft = Record<Field, string>;

/** Mirrors profileChanges() in server/src/routes/auth.js (personName, email, phone). */
const RULES: Rules<Draft> = {
  name: (v) => validateName(v, { missing: 'Enter a name.' }),
  email: (v) => validateEmail(v, { missing: 'Enter a valid email address.' }),
  phone: (v) => validatePhone(v),
};
const LABELS = { name: 'Name', email: 'Email', phone: 'Phone' };

/**
 * A manager or admin correcting the name, email or phone of an account below
 * their own rank. Role and password are changed elsewhere.
 */
export function EditAccountModal({
  user,
  onClose,
  onSaved,
}: {
  user: User;
  onClose: () => void;
  onSaved: (user: User) => unknown;
}) {
  const toast = useToast();
  const [draft, setDraft] = useState<Draft>({
    name: user.name,
    email: user.email,
    phone: user.phone ?? '',
  });
  /** Errors the server sent back (shown until the field is edited). */
  const [serverErrors, setServerErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const v = useFormValidation(draft, RULES, { labels: LABELS });
  const errors = {
    name: serverErrors.name ?? v.errors.name,
    email: serverErrors.email ?? v.errors.email,
    phone: serverErrors.phone ?? v.errors.phone,
  };

  function set(key: Field, value: string) {
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
      const { user: updated } = await authApi.updateUserProfile(user.id, {
        name: normalizeName(draft.name),
        email: draft.email.trim(),
        phone: draft.phone.trim(),
      });
      toast(`${updated.name}'s details were updated.`, 'success');
      await onSaved(updated);
    } catch (err) {
      const message = errorMessage(err, 'The details could not be saved.');
      if (err instanceof ApiError && err.status === 409) setServerErrors({ email: message });
      else setFormError(message);
      setSaving(false);
    }
  }

  return (
    <Modal title={`Edit ${user.name}'s details`} onClose={saving ? () => undefined : onClose}>
      <form onSubmit={save} noValidate>
        <fieldset disabled={saving} className="space-y-4">
          <TextField
            id="edit-account-name"
            label="Name"
            value={draft.name}
            onChange={(value) => set('name', value)}
            onBlur={() => v.blur('name')}
            maxLength={NAME_MAX + 20}
            placeholder="e.g. Sara Khan"
            error={errors.name}
          />
          <TextField
            id="edit-account-email"
            label="Email"
            type="email"
            inputMode="email"
            value={draft.email}
            onChange={(value) => set('email', value)}
            onBlur={() => v.blur('email')}
            maxLength={EMAIL_MAX}
            placeholder="name@example.com"
            error={errors.email}
            hint="They sign in with this address."
          />
          <TextField
            id="edit-account-phone"
            label="Phone"
            type="tel"
            inputMode="tel"
            value={draft.phone}
            onChange={(value) => set('phone', value)}
            onBlur={() => v.blur('phone')}
            maxLength={PHONE_MAX}
            placeholder="+92 300 1234567"
            error={errors.phone}
            optional
          />
        </fieldset>

        {formError ? (
          <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {formError}
          </p>
        ) : null}

        <SubmitHint id="edit-account-submit-hint" fields={v.invalidLabels} className="mt-4 sm:mt-6 sm:text-right" />
        <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={saving || !v.isValid}
            aria-disabled={saving || !v.isValid}
            aria-describedby={v.isValid ? undefined : 'edit-account-submit-hint'}
          >
            {saving ? 'Saving…' : 'Save details'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

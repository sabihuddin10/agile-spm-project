'use client';

import { useState } from 'react';
import type { User } from '@/types';
import { ApiError, authApi } from '@/lib/api';
import { errorMessage } from '@/lib/format';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { TextField, isValidEmail } from '@/components/staff/text-field';

type Field = 'name' | 'email' | 'phone';

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
  const [draft, setDraft] = useState<Record<Field, string>>({
    name: user.name,
    email: user.email,
    phone: user.phone ?? '',
  });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set(key: Field, value: string) {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
    setFormError(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const found: Partial<Record<Field, string>> = {};
    if (!draft.name.trim()) found.name = 'Enter a name.';
    if (!isValidEmail(draft.email)) found.email = 'Enter a valid email address.';
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    try {
      const { user: updated } = await authApi.updateUserProfile(user.id, {
        name: draft.name.trim(),
        email: draft.email.trim(),
        phone: draft.phone.trim(),
      });
      toast(`${updated.name}'s details were updated.`, 'success');
      await onSaved(updated);
    } catch (err) {
      const message = errorMessage(err, 'The details could not be saved.');
      if (err instanceof ApiError && err.status === 409) setErrors({ email: message });
      else setFormError(message);
      setSaving(false);
    }
  }

  return (
    <Modal title={`Edit ${user.name}'s details`} onClose={saving ? () => undefined : onClose}>
      <form onSubmit={save} noValidate>
        <fieldset disabled={saving} className="space-y-4">
          <TextField id="edit-account-name" label="Name" value={draft.name} onChange={(v) => set('name', v)} error={errors.name} />
          <TextField
            id="edit-account-email"
            label="Email"
            type="email"
            value={draft.email}
            onChange={(v) => set('email', v)}
            error={errors.email}
            hint="They sign in with this address."
          />
          <TextField
            id="edit-account-phone"
            label="Phone"
            type="tel"
            value={draft.phone}
            onChange={(v) => set('phone', v)}
            optional
          />
        </fieldset>

        {formError ? (
          <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {formError}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save details'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

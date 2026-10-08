'use client';

import { useState } from 'react';
import type { User } from '@/types';
import { authApi } from '@/lib/api';
import { errorMessage } from '@/lib/format';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { TextField } from '@/components/staff/text-field';
import { MIN_PASSWORD_LENGTH } from '@/components/staff/change-password-form';

type Field = 'next' | 'confirm';

/**
 * An admin typing a new password for an account below them. No old password is
 * needed; the account is signed out everywhere and uses the new one from now on.
 */
export function SetPasswordModal({
  user,
  onClose,
  onSaved,
}: {
  user: User;
  onClose: () => void;
  onSaved: (user: User) => unknown;
}) {
  const toast = useToast();
  const [draft, setDraft] = useState<Record<Field, string>>({ next: '', confirm: '' });
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
    if (draft.next.length < MIN_PASSWORD_LENGTH) found.next = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
    else if (draft.confirm !== draft.next) found.confirm = 'Passwords do not match.';
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    try {
      const { user: updated } = await authApi.setUserPassword(user.id, draft.next);
      toast(`${updated.name}'s password was changed. They were signed out on every device.`, 'success');
      await onSaved(updated);
    } catch (err) {
      setFormError(errorMessage(err, 'The password could not be changed.'));
      setSaving(false);
    }
  }

  return (
    <Modal title={`Set ${user.name}'s password`} onClose={saving ? () => undefined : onClose}>
      <form onSubmit={save} noValidate>
        <p className="mb-4 text-sm text-stone-600">
          Type the new password and tell {user.name} what it is. Their old password stops working and they are signed out on every device.
        </p>
        <fieldset disabled={saving} className="space-y-4">
          <TextField
            id="set-password-new"
            label="New password"
            type="password"
            value={draft.next}
            onChange={(v) => set('next', v)}
            autoComplete="new-password"
            error={errors.next}
            hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
          />
          <TextField
            id="set-password-confirm"
            label="Confirm new password"
            type="password"
            value={draft.confirm}
            onChange={(v) => set('confirm', v)}
            autoComplete="new-password"
            error={errors.confirm}
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
            {saving ? 'Saving…' : 'Set password'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

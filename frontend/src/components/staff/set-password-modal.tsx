'use client';

import { useState } from 'react';
import type { User } from '@/types';
import { authApi } from '@/lib/api';
import { errorMessage } from '@/lib/format';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { confirmError, passwordError } from '@/lib/validation/password';
import { useFormValidation, type Rules } from '@/lib/validation/use-form-validation';
import { FieldError, describedBy } from '@/components/forms/field-error';
import { PasswordInput } from '@/components/forms/password-input';
import { PasswordMatch } from '@/components/forms/password-match';
import { PasswordRequirements } from '@/components/forms/password-requirements';

interface Draft {
  next: string;
  confirm: string;
}

/**
 * An admin typing a new password for an account below them. No old password is
 * needed; the new one is checked live against the password policy, and the
 * account is signed out everywhere and uses the new one from now on.
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
  const [draft, setDraft] = useState<Draft>({ next: '', confirm: '' });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const account = { email: user.email, name: user.name };

  const rules: Rules<Draft> = {
    next: (v) => passwordError(v, account),
    confirm: (v, d) => confirmError(d.next, v),
  };
  const v = useFormValidation(draft, rules);

  function set(key: keyof Draft, value: string) {
    setDraft((d) => ({ ...d, [key]: value }));
    setFormError(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!v.touchAll()) return;

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
          <div>
            <label htmlFor="set-password-new" className="label">
              New password
            </label>
            <PasswordInput
              id="set-password-new"
              value={draft.next}
              onChange={(value) => set('next', value)}
              onBlur={() => v.blur('next')}
              invalid={Boolean(v.errors.next)}
              describedBy={describedBy('set-password-rules', v.errors.next && 'set-password-new-error')}
            />
            <FieldError id="set-password-new-error" message={v.errors.next} />
            <PasswordRequirements id="set-password-rules" value={draft.next} {...account} showUnmet={v.submitted} />
          </div>
          <div>
            <label htmlFor="set-password-confirm" className="label">
              Confirm new password
            </label>
            <PasswordInput
              id="set-password-confirm"
              value={draft.confirm}
              onChange={(value) => set('confirm', value)}
              onBlur={() => v.blur('confirm')}
              invalid={Boolean(v.errors.confirm)}
              describedBy={describedBy('set-password-match', v.errors.confirm && !draft.confirm && 'set-password-confirm-error')}
            />
            {draft.confirm ? null : <FieldError id="set-password-confirm-error" message={v.errors.confirm} />}
            <PasswordMatch id="set-password-match" password={draft.next} confirm={draft.confirm} />
          </div>
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

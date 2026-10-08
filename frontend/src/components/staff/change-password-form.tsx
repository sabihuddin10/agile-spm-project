'use client';

import { useState } from 'react';
import { ApiError, authApi } from '@/lib/api';
import { errorMessage } from '@/lib/format';
import { useAuth } from '@/context/auth-context';
import { Card, CardHeader } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { TextField } from '@/components/staff/text-field';

export const MIN_PASSWORD_LENGTH = 6;

interface Fields {
  current: string;
  next: string;
  confirm: string;
}

const EMPTY: Fields = { current: '', next: '', confirm: '' };

/**
 * Change your own password. The server revokes every other session and returns
 * a fresh token, which is stored through the auth context so this tab stays
 * signed in. Admins set a new password without entering the current one.
 */
export function ChangePasswordForm({ id }: { id?: string }) {
  const { user: me, updateSession } = useAuth();
  const needsCurrent = me?.role !== 'admin';
  const toast = useToast();
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [errors, setErrors] = useState<Partial<Fields>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set(key: keyof Fields, value: string) {
    setFields((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
    setFormError(null);
  }

  function validate(): Partial<Fields> {
    const found: Partial<Fields> = {};
    if (needsCurrent && !fields.current) found.current = 'Enter your current password.';
    if (fields.next.length < MIN_PASSWORD_LENGTH) found.next = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
    else if (needsCurrent && fields.next === fields.current) found.next = 'Choose a password different from your current one.';
    if (!found.next && fields.confirm !== fields.next) found.confirm = 'Passwords do not match.';
    return found;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    try {
      const { user, token } = await authApi.changePassword(needsCurrent ? fields.current : undefined, fields.next);
      updateSession(user, token);
      setFields(EMPTY);
      toast('Password changed. Other sessions were signed out.', 'success');
    } catch (err) {
      const message = errorMessage(err, 'Your password could not be changed.');
      if (err instanceof ApiError && err.status === 400 && /current/i.test(message)) setErrors({ current: message });
      else setFormError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <div id={id} className="scroll-mt-20">
        <CardHeader
          title="Password"
          subtitle={
            needsCurrent
              ? 'Changing it signs you out on every other device.'
              : 'As an admin you can set a new password without the current one. It signs you out on every other device.'
          }
        />
      </div>
      <form onSubmit={submit} noValidate>
        <fieldset disabled={saving} className="space-y-4">
          {needsCurrent ? (
            <div className="sm:w-1/2 sm:pr-2">
              <TextField
                id="password-current"
                label="Current password"
                type="password"
                value={fields.current}
                onChange={(v) => set('current', v)}
                autoComplete="current-password"
                error={errors.current}
              />
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              id="password-new"
              label="New password"
              type="password"
              value={fields.next}
              onChange={(v) => set('next', v)}
              autoComplete="new-password"
              error={errors.next}
              hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
            />
            <TextField
              id="password-confirm"
              label="Confirm new password"
              type="password"
              value={fields.confirm}
              onChange={(v) => set('confirm', v)}
              autoComplete="new-password"
              error={errors.confirm}
            />
          </div>
        </fieldset>

        {formError ? (
          <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {formError}
          </p>
        ) : null}

        <div className="mt-5">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Changing…' : 'Change password'}
          </button>
        </div>
      </form>
    </Card>
  );
}

'use client';

import { useState } from 'react';
import { ApiError, authApi } from '@/lib/api';
import { errorMessage } from '@/lib/format';
import { useAuth } from '@/context/auth-context';
import { Card, CardHeader } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { PASSWORD_MIN, confirmError, passwordError } from '@/lib/validation/password';
import { useFormValidation, type Rules } from '@/lib/validation/use-form-validation';
import { FieldError, SubmitHint, describedBy } from '@/components/forms/field-error';
import { PasswordInput } from '@/components/forms/password-input';
import { PasswordMatch } from '@/components/forms/password-match';
import { PasswordRequirements } from '@/components/forms/password-requirements';

export const MIN_PASSWORD_LENGTH = PASSWORD_MIN;

interface Fields {
  current: string;
  next: string;
  confirm: string;
}

const EMPTY: Fields = { current: '', next: '', confirm: '' };

/**
 * Change your own password. The new one is checked live against the password
 * policy; the server revokes every other session and returns a fresh token,
 * which is stored through the auth context so this tab stays signed in.
 * Admins set a new password without entering the current one.
 */
export function ChangePasswordForm({ id }: { id?: string }) {
  const { user: me, updateSession } = useAuth();
  const needsCurrent = me?.role !== 'admin';
  const toast = useToast();
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [serverErrors, setServerErrors] = useState<Partial<Fields>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const account = { email: me?.email, name: me?.name };

  const rules: Rules<Fields> = {
    current: (v) => (needsCurrent && !v ? 'Enter your current password.' : undefined),
    next: (v, f) => {
      if (needsCurrent && v && v === f.current) return 'Choose a password different from your current one.';
      return passwordError(v, account);
    },
    confirm: (v, f) => confirmError(f.next, v),
  };
  const v = useFormValidation(fields, rules, {
    labels: { current: 'Current password', next: 'New password', confirm: 'Confirm new password' },
  });
  const errors: Partial<Fields> = {
    current: serverErrors.current ?? v.errors.current,
    next: serverErrors.next ?? v.errors.next,
    confirm: v.errors.confirm,
  };

  function set(key: keyof Fields, value: string) {
    setFields((f) => ({ ...f, [key]: value }));
    setServerErrors((e) => ({ ...e, [key]: undefined }));
    setFormError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!v.touchAll()) return;

    setSaving(true);
    try {
      const { user, token } = await authApi.changePassword(needsCurrent ? fields.current : undefined, fields.next);
      updateSession(user, token);
      setFields(EMPTY);
      v.reset();
      toast('Password changed. Other sessions were signed out.', 'success');
    } catch (err) {
      const message = errorMessage(err, 'Your password could not be changed.');
      if (err instanceof ApiError && err.status === 400 && /current/i.test(message)) setServerErrors({ current: message });
      else if (err instanceof ApiError && err.status === 400 && /^Password needs/i.test(message)) setServerErrors({ next: message });
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
              <label htmlFor="password-current" className="label">
                Current password
              </label>
              <PasswordInput
                id="password-current"
                autoComplete="current-password"
                value={fields.current}
                onChange={(value) => set('current', value)}
                onBlur={() => v.blur('current')}
                invalid={Boolean(errors.current)}
                describedBy={describedBy(errors.current && 'password-current-error')}
              />
              <FieldError id="password-current-error" message={errors.current} />
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="password-new" className="label">
                New password
              </label>
              <PasswordInput
                id="password-new"
                value={fields.next}
                onChange={(value) => set('next', value)}
                onBlur={() => v.blur('next')}
                invalid={Boolean(errors.next)}
                describedBy={describedBy('password-new-rules', errors.next && 'password-new-error')}
              />
              <FieldError id="password-new-error" message={errors.next} />
              <PasswordRequirements id="password-new-rules" value={fields.next} {...account} showUnmet={v.isTouched('next')} />
            </div>
            <div>
              <label htmlFor="password-confirm" className="label">
                Confirm new password
              </label>
              <PasswordInput
                id="password-confirm"
                value={fields.confirm}
                onChange={(value) => set('confirm', value)}
                onBlur={() => v.blur('confirm')}
                invalid={Boolean(errors.confirm)}
                describedBy={describedBy('password-confirm-match', errors.confirm && !fields.confirm && 'password-confirm-error')}
              />
              {fields.confirm ? null : <FieldError id="password-confirm-error" message={errors.confirm} />}
              <PasswordMatch id="password-confirm-match" password={fields.next} confirm={fields.confirm} />
            </div>
          </div>
        </fieldset>

        {formError ? (
          <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {formError}
          </p>
        ) : null}

        <div className="mt-5 space-y-2">
          <button
            type="submit"
            className="btn-primary"
            disabled={saving || !v.isValid}
            aria-disabled={saving || !v.isValid}
            aria-describedby={v.isValid ? undefined : 'password-submit-hint'}
          >
            {saving ? 'Changing…' : 'Change password'}
          </button>
          <SubmitHint id="password-submit-hint" fields={v.invalidLabels} />
        </div>
      </form>
    </Card>
  );
}

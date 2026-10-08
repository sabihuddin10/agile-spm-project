'use client';

import { useState } from 'react';
import type { User } from '@/types';
import { ApiError, authApi } from '@/lib/api';
import { errorMessage } from '@/lib/format';
import { useAuth } from '@/context/auth-context';
import { Card, CardHeader } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { TextField, isValidEmail } from '@/components/staff/text-field';

interface Draft {
  name: string;
  email: string;
  phone: string;
}

type Errors = Partial<Record<keyof Draft | 'currentPassword', string>>;

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
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const emailChanged = draft.email.trim().toLowerCase() !== saved.email.toLowerCase();
  const dirty = draft.name !== saved.name || draft.email !== saved.email || draft.phone !== saved.phone;

  function set(key: keyof Draft, value: string) {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
    setFormError(null);
  }

  function validate(): Errors {
    const next: Errors = {};
    if (!draft.name.trim()) next.name = 'Enter your name.';
    if (!isValidEmail(draft.email)) next.email = 'Enter a valid email address.';
    if (emailChanged && !currentPassword) next.currentPassword = 'Enter your current password to change your email.';
    return next;
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    try {
      const { user: updated } = await authApi.updateMe({
        name: draft.name.trim(),
        phone: draft.phone.trim(),
        ...(emailChanged ? { email: draft.email.trim(), currentPassword } : {}),
      });
      const next = toDraft(updated);
      setSaved(next);
      setDraft(next);
      setCurrentPassword('');
      updateSession(updated);
      toast('Profile saved.', 'success');
    } catch (err) {
      const message = errorMessage(err, 'Your profile could not be saved.');
      if (err instanceof ApiError && err.status === 409) setErrors({ email: message });
      else if (err instanceof ApiError && err.status === 400 && /password/i.test(message)) setErrors({ currentPassword: message });
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
            onChange={(v) => set('name', v)}
            autoComplete="name"
            error={errors.name}
          />
          <TextField
            id="account-email"
            label="Email"
            type="email"
            value={draft.email}
            onChange={(v) => set('email', v)}
            autoComplete="email"
            error={errors.email}
            hint="You sign in with this address."
          />
          <TextField
            id="account-phone"
            label="Phone"
            type="tel"
            value={draft.phone}
            onChange={(v) => set('phone', v)}
            autoComplete="tel"
            optional
          />
          {emailChanged ? (
            <TextField
              id="account-current-password"
              label="Current password"
              type="password"
              value={currentPassword}
              onChange={(v) => {
                setCurrentPassword(v);
                setErrors((e) => ({ ...e, currentPassword: undefined }));
              }}
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
          <button type="submit" className="btn-primary" disabled={saving || !dirty}>
            {saving ? 'Saving…' : 'Save profile'}
          </button>
          {dirty && !saving ? (
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setDraft(saved);
                setCurrentPassword('');
                setErrors({});
                setFormError(null);
              }}
            >
              Discard
            </button>
          ) : null}
        </div>
      </form>
    </Card>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/components/ui/toast';
import { errorMessage } from '@/lib/format';
import { normalizeName, validateEmail, validateName, NAME_MAX, EMAIL_MAX } from '@/lib/validation/fields';
import { confirmError, passwordError } from '@/lib/validation/password';
import { useFormValidation, type Rules } from '@/lib/validation/use-form-validation';
import { FieldError, SubmitHint, describedBy } from '@/components/forms/field-error';
import { PasswordInput } from '@/components/forms/password-input';
import { PasswordMatch } from '@/components/forms/password-match';
import { PasswordRequirements } from '@/components/forms/password-requirements';

interface Form {
  name: string;
  email: string;
  password: string;
  confirm: string;
}

const RULES: Rules<Form> = {
  name: (v) => validateName(v),
  email: (v) => validateEmail(v),
  password: (v, f) => passwordError(v, { email: f.email, name: f.name }),
  confirm: (v, f) => confirmError(f.password, v),
};
const LABELS = { name: 'Full name', email: 'Email', password: 'Password', confirm: 'Confirm password' };

/**
 * Customer self-registration (US1.2). Fields are checked when you leave them
 * and live after that; the password checklist updates as you type and mirrors
 * the server's password policy. Server errors are shown above the button.
 */
export function RegisterForm() {
  const { register } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const [form, setForm] = useState<Form>({ name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const v = useFormValidation(form, RULES, { labels: LABELS });

  function set<K extends keyof Form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!v.touchAll()) return;
    setError(null);
    setSubmitting(true);
    try {
      const user = await register(normalizeName(form.name), form.email.trim(), form.password);
      toast(`Welcome to Plate & Flame, ${user.name.split(' ')[0]}.`, 'success');
      router.push('/');
    } catch (err) {
      setError(errorMessage(err, 'Registration failed.'));
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="card">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-bone">Create your account</h1>
        <p className="mt-1 text-sm text-bone-dim">
          Order ahead, track your orders, earn Flame Points and keep your allergies on file.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
          <div>
            <label htmlFor="name" className="label">
              Full name
            </label>
            <input
              id="name"
              type="text"
              required
              autoComplete="name"
              maxLength={NAME_MAX + 20}
              placeholder="e.g. Sara Khan"
              className="input"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              onBlur={() => v.blur('name')}
              aria-invalid={Boolean(v.errors.name) || undefined}
              aria-describedby={describedBy(v.errors.name && 'name-error')}
            />
            <FieldError id="name-error" message={v.errors.name} tone="dark" />
          </div>
          <div>
            <label htmlFor="email" className="label">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              maxLength={EMAIL_MAX}
              placeholder="name@example.com"
              className="input"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              onBlur={() => v.blur('email')}
              aria-invalid={Boolean(v.errors.email) || undefined}
              aria-describedby={describedBy(v.errors.email && 'email-error')}
            />
            <FieldError id="email-error" message={v.errors.email} tone="dark" />
          </div>
          <div>
            <label htmlFor="password" className="label">
              Password
            </label>
            <PasswordInput
              id="password"
              tone="dark"
              value={form.password}
              onChange={(value) => set('password', value)}
              onBlur={() => v.blur('password')}
              invalid={Boolean(v.errors.password)}
              describedBy={describedBy('password-rules', v.errors.password && 'password-error')}
            />
            <FieldError id="password-error" message={v.errors.password} tone="dark" />
            <PasswordRequirements
              id="password-rules"
              value={form.password}
              email={form.email}
              name={form.name}
              tone="dark"
              showUnmet={v.isTouched('password')}
            />
          </div>
          <div>
            <label htmlFor="confirm" className="label">
              Confirm password
            </label>
            <PasswordInput
              id="confirm"
              tone="dark"
              value={form.confirm}
              onChange={(value) => set('confirm', value)}
              onBlur={() => v.blur('confirm')}
              invalid={Boolean(v.errors.confirm)}
              describedBy={describedBy('confirm-match', v.errors.confirm && form.confirm === '' && 'confirm-error')}
            />
            {form.confirm === '' ? <FieldError id="confirm-error" message={v.errors.confirm} tone="dark" /> : null}
            <PasswordMatch id="confirm-match" password={form.password} confirm={form.confirm} tone="dark" />
          </div>

          {error ? (
            <p role="alert" className="rounded-xl border border-red-400/40 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-200">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            className="btn-primary h-10 w-full lg:h-12"
            disabled={submitting || !v.isValid}
            aria-disabled={submitting || !v.isValid}
            aria-describedby={v.isValid ? undefined : 'register-submit-hint'}
          >
            {submitting ? 'Creating account…' : 'Create account'}
          </button>
          <SubmitHint id="register-submit-hint" fields={v.invalidLabels} tone="dark" className="text-center" />
        </form>
      </div>
    </div>
  );
}

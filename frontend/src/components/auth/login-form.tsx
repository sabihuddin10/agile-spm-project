'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/components/ui/toast';
import { errorMessage } from '@/lib/format';
import { validateEmail, validateRequired, EMAIL_MAX } from '@/lib/validation/fields';
import { useFormValidation, type Rules } from '@/lib/validation/use-form-validation';
import { FieldError, SubmitHint, describedBy } from '@/components/forms/field-error';
import { PasswordInput } from '@/components/forms/password-input';

// Sign-in only checks that something sensible was typed; the password policy
// applies when a password is set, so older (and demo) passwords still work.
const RULES: Rules<{ email: string; password: string }> = {
  email: (v) => validateEmail(v),
  password: (v) => validateRequired(v, 'Please enter your password.'),
};
const LABELS = { email: 'Email', password: 'Password' };

const DEMO_ACCOUNTS = [
  { label: 'Admin', email: 'admin@rest.test' },
  { label: 'Manager', email: 'manager@rest.test' },
  { label: 'Chef', email: 'chef@rest.test' },
  { label: 'Waiter', email: 'waiter@rest.test' },
  { label: 'Customer', email: 'customer@rest.test' },
];

/**
 * Sign in for customers and staff (US1.1). Shows a notice when the previous
 * session ended (expired token or suspended account → /login?expired=1).
 */
export function LoginForm() {
  const { login } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const v = useFormValidation({ email, password }, RULES, { labels: LABELS });

  // Read the query string directly (useSearchParams would need a Suspense boundary).
  useEffect(() => {
    setExpired(new URLSearchParams(window.location.search).get('expired') === '1');
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!v.touchAll()) return;
    setSubmitting(true);
    try {
      const user = await login(email.trim(), password);
      toast(`Welcome back, ${user.name.split(' ')[0]}.`, 'success');
      router.push(user.role === 'customer' ? '/' : '/staff');
    } catch (err) {
      setError(errorMessage(err, 'Login failed.'));
      setSubmitting(false);
    }
  }

  function quickLogin(quickEmail: string) {
    setEmail(quickEmail);
    setPassword('password');
    setError(null);
  }

  return (
    <div className="w-full max-w-md">
      <div className="card">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-bone">Sign in</h1>
        <p className="mt-1 text-sm text-bone-dim">Use your account, or pick a demo account below.</p>

        {expired ? (
          <p role="status" className="mt-4 rounded-xl border border-ember/40 bg-ember/10 px-3.5 py-2.5 text-sm text-ember-glow">
            Your session ended — please sign in again.
          </p>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
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
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => v.blur('email')}
              aria-invalid={Boolean(v.errors.email) || undefined}
              aria-describedby={describedBy(v.errors.email && 'login-email-error')}
              placeholder="name@example.com"
            />
            <FieldError id="login-email-error" message={v.errors.email} tone="dark" />
          </div>
          <div>
            <label htmlFor="password" className="label">
              Password
            </label>
            <PasswordInput
              id="password"
              tone="dark"
              autoComplete="current-password"
              value={password}
              onChange={setPassword}
              onBlur={() => v.blur('password')}
              invalid={Boolean(v.errors.password)}
              describedBy={describedBy(v.errors.password && 'login-password-error')}
            />
            <FieldError id="login-password-error" message={v.errors.password} tone="dark" />
          </div>

          {error ? (
            <p role="alert" className="rounded-xl border border-red-400/40 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-200">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            className="btn-primary w-full"
            disabled={submitting || !v.isValid}
            aria-disabled={submitting || !v.isValid}
            aria-describedby={v.isValid ? undefined : 'login-submit-hint'}
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
          <SubmitHint id="login-submit-hint" fields={v.invalidLabels} tone="dark" className="text-center" />
        </form>

        <div className="mt-6 border-t border-char-hairline pt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-bone-faint">Quick demo login</p>
          <div className="flex flex-wrap gap-2">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                onClick={() => quickLogin(acc.email)}
                disabled={submitting}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  email === acc.email
                    ? 'border-ember bg-ember/15 text-bone'
                    : 'border-char-hairline text-bone-dim hover:border-ember/40 hover:text-bone'
                }`}
              >
                {acc.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-bone-faint">
            Any demo account password: <code className="font-mono text-bone-dim">password</code>
          </p>
        </div>
      </div>

      <p className="mt-4 text-center text-sm text-bone-dim">
        No account yet?{' '}
        <Link href="/register" className="font-medium text-ember-soft hover:underline">
          Register as a customer
        </Link>
      </p>
    </div>
  );
}

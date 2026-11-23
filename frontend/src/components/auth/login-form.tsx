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
// applies when a password is set, so older passwords still work.
const RULES: Rules<{ email: string; password: string }> = {
  email: (v) => validateEmail(v),
  password: (v) => validateRequired(v, 'Please enter your password.'),
};
const LABELS = { email: 'Email', password: 'Password' };

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

  return (
    <div className="w-full max-w-md">
      <div className="card">
        <h1 className="font-display text-lg font-semibold tracking-tight text-bone sm:text-2xl">Sign in</h1>
        <p className="mt-1 text-sm text-bone-dim">Sign in with your email and password to access your account.</p>

        {expired ? (
          <p role="status" className="mt-4 rounded-xl border border-ember/40 bg-ember/10 px-3.5 py-2.5 text-sm text-ember-glow">
            Your session ended — please sign in again.
          </p>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-5 space-y-3 sm:mt-6 sm:space-y-4" noValidate>
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
            className="btn-primary w-full sm:h-10 lg:h-12"
            disabled={submitting || !v.isValid}
            aria-disabled={submitting || !v.isValid}
            aria-describedby={v.isValid ? undefined : 'login-submit-hint'}
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
          <SubmitHint id="login-submit-hint" fields={v.invalidLabels} tone="dark" className="text-center" />
        </form>
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

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/components/ui/toast';
import { errorMessage } from '@/lib/format';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Customer self-registration (US1.2): validates name, email and password, and shows server errors. */
export function RegisterForm() {
  const { register } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setError(null);
  }

  function validate(): string | null {
    if (!form.name.trim()) return 'Please enter your name.';
    if (!EMAIL_RE.test(form.email.trim())) return 'Please enter a valid email address.';
    if (form.password.length < 6) return 'Password must be at least 6 characters.';
    if (form.password !== form.confirm) return 'Passwords do not match.';
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const user = await register(form.name.trim(), form.email.trim(), form.password);
      toast(`Welcome to Plate & Flame, ${user.name.split(' ')[0]}.`, 'success');
      router.push('/');
    } catch (err) {
      setError(errorMessage(err, 'Registration failed.'));
      setSubmitting(false);
    }
  }

  const mismatch = form.confirm.length > 0 && form.password !== form.confirm;

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
              className="input"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
            />
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
              className="input"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="password" className="label">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              aria-describedby="password-hint"
              className="input"
              value={form.password}
              onChange={(e) => set('password', e.target.value)}
            />
            <p id="password-hint" className="mt-1 text-xs text-bone-faint">
              At least 6 characters.
            </p>
          </div>
          <div>
            <label htmlFor="confirm" className="label">
              Confirm password
            </label>
            <input
              id="confirm"
              type="password"
              required
              autoComplete="new-password"
              aria-invalid={mismatch}
              className="input"
              value={form.confirm}
              onChange={(e) => set('confirm', e.target.value)}
            />
            {mismatch ? <p className="mt-1 text-xs text-red-300">Passwords do not match yet.</p> : null}
          </div>

          {error ? (
            <p role="alert" className="rounded-xl border border-red-400/40 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-200">
              {error}
            </p>
          ) : null}

          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  );
}

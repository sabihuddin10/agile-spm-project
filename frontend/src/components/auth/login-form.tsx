'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/components/ui/toast';

const DEMO_ACCOUNTS = [
  { label: 'Admin', email: 'admin@rest.test' },
  { label: 'Manager', email: 'manager@rest.test' },
  { label: 'Chef', email: 'chef@rest.test' },
  { label: 'Waiter', email: 'waiter@rest.test' },
  { label: 'Customer', email: 'customer@rest.test' },
];

export function LoginForm() {
  const { login } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const user = await login(email, password);
      toast('Welcome back.', 'success');
      router.push(user.role === 'customer' ? '/' : '/staff');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setSubmitting(false);
    }
  }

  function quickLogin(quickEmail: string) {
    setEmail(quickEmail);
    setPassword('password');
  }

  return (
    <div className="w-full max-w-md">
      <div className="card">
        <h1 className="text-xl font-bold">Sign in</h1>
        <p className="mt-1 text-sm text-stone-500">
          Use a demo account or your registered email.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
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
              autoComplete="current-password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : null}

          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="mt-6 border-t border-stone-100 pt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">
            Quick demo login
          </p>
          <div className="flex flex-wrap gap-2">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                onClick={() => quickLogin(acc.email)}
                className="rounded-full border border-stone-200 px-3 py-1 text-xs font-medium text-stone-600 hover:bg-stone-50"
              >
                {acc.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-stone-400">Any demo account password: <code className="font-mono">password</code></p>
        </div>
      </div>

      <p className="mt-4 text-center text-sm text-stone-500">
        No account yet?{' '}
        <Link href="/register" className="font-medium text-brand-600 hover:underline">
          Register as a customer
        </Link>
      </p>
    </div>
  );
}
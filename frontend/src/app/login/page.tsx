import type { Metadata } from 'next';
import Link from 'next/link';
import { LoginForm } from '@/components/auth/login-form';

export const metadata: Metadata = { title: 'Sign in' };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-brand-50 via-stone-50 to-stone-100 px-4 py-12">
      <Link href="/" className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 text-white font-bold">
          RO
        </div>
        <div>
          <p className="font-semibold">Restaurant Ops Platform</p>
          <p className="text-xs text-stone-500">Scrum delivery · 10 sprints</p>
        </div>
      </Link>
      <LoginForm />
    </main>
  );
}
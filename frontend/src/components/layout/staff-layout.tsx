'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { StaffShell } from '@/components/layout/staff-shell';
import { Spinner } from '@/components/ui/spinner';
import { canAccess, isStaff, type Section } from '@/lib/permissions';

/**
 * Wraps every staff page. Pass the page's `section`: roles without access see a
 * 403 notice and are redirected to their own dashboard (US1.1).
 */
export function StaffLayout({ children, section }: { children: React.ReactNode; section?: Section }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const forbidden = Boolean(user && isStaff(user.role) && section && !canAccess(user.role, section));

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/login');
    else if (user.role === 'customer') router.replace('/');
  }, [loading, user, router]);

  useEffect(() => {
    if (!forbidden) return;
    const id = window.setTimeout(() => router.replace('/staff'), 2500);
    return () => window.clearTimeout(id);
  }, [forbidden, router]);

  if (loading || !user || !isStaff(user.role)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50">
        <Spinner label="Loading session…" />
      </div>
    );
  }

  if (forbidden) {
    return (
      <StaffShell>
        <div className="mx-auto mt-16 max-w-md rounded-xl border border-red-200 bg-white p-5 text-center sm:p-8 shadow-sm">
          <p className="font-mono text-sm font-semibold text-red-600">403 · Forbidden</p>
          <h1 className="mt-2 text-xl font-bold">You don&apos;t have access to this page</h1>
          <p className="mt-2 text-sm text-stone-500">
            Your role (<span className="font-medium capitalize">{user.role}</span>) isn&apos;t permitted here.
            Taking you back to your dashboard…
          </p>
          <Link href="/staff" className="btn-primary mt-5">
            Go to my dashboard
          </Link>
        </div>
      </StaffShell>
    );
  }

  return <StaffShell>{children}</StaffShell>;
}

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { StaffShell } from '@/components/layout/staff-shell';
import { Spinner } from '@/components/ui/spinner';

const STAFF_ROLES = new Set(['waiter', 'chef', 'manager', 'admin']);

export function StaffLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/login');
    else if (user.role === 'customer') router.replace('/');
  }, [loading, user, router]);

  if (loading || !user || !STAFF_ROLES.has(user.role)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50">
        <Spinner label="Loading session…" />
      </div>
    );
  }

  return <StaffShell>{children}</StaffShell>;
}
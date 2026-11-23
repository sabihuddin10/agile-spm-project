'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { StaffLayout } from '@/components/layout/staff-layout';
import { MyAccount } from '@/components/staff/my-account';
import { ROLE_META, initials } from '@/components/staff/role-meta';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/context/auth-context';
import { authApi } from '@/lib/api';
import { can, holdsRole } from '@/lib/permissions';
import { errorMessage } from '@/lib/format';
import type { User } from '@/types';

/** One account's details: your own opens My account; managers and admins can view anyone. */
export default function AccountDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const { user } = useAuth();
  const [target, setTarget] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isSelf = userId === user?.id;
  const mayView = holdsRole(user?.role, ['manager', 'admin']);

  useEffect(() => {
    if (!user || isSelf || !mayView) return;
    authApi
      .users()
      .then(({ users }) => {
        const found = users.find((u) => u.id === userId);
        if (found) setTarget(found);
        else setError('Account not found.');
      })
      .catch((err) => setError(errorMessage(err)));
  }, [user, userId, isSelf, mayView]);

  return (
    <StaffLayout section="account">
      {isSelf ? (
        <MyAccount />
      ) : !mayView ? (
        <p className="text-sm text-stone-600">You can only view your own account.</p>
      ) : error ? (
        <p className="text-sm text-red-700">{error}</p>
      ) : !target ? (
        <p className="text-sm text-stone-500">Loading…</p>
      ) : (
        <div className="card space-y-4 p-4 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-stone-100 text-base font-bold text-stone-600" aria-hidden="true">
              {initials(target.name)}
            </span>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-stone-900">{target.name}</h1>
              <p className="truncate text-sm text-stone-600">{target.email}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone={ROLE_META[target.role].tone}>{ROLE_META[target.role].label}</Badge>
            <Badge tone={target.active ? 'emerald' : 'red'}>{target.active ? 'Active' : 'Suspended'}</Badge>
          </div>
          {can.assignRoles(user?.role) ? (
            <Link href="/staff/users" className="btn-secondary inline-block">
              Manage this account in staff management
            </Link>
          ) : null}
        </div>
      )}
    </StaffLayout>
  );
}

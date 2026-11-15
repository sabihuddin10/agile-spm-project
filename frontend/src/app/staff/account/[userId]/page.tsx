'use client';

import { StaffLayout } from '@/components/layout/staff-layout';
import { MyAccount } from '@/components/staff/my-account';
import { useAuth } from '@/context/auth-context';
import { useSearchParams } from 'next/navigation';
import { authApi } from '@/lib/api';
import { errorMessage } from '@/lib/format';
import { useToast } from '@/components/ui/toast';
import { NotFound } from 'next';
import type { User } from '@/types';

export default async function AccountPage() {
  const { user } = useAuth();
  const router = useRouter();
  const search = useSearchParams();
  const targetId = search.get('userId') ?? user?.id;

  if (!targetId) return <NotFound />;

  // admins / managers can view any staff / customer; others only themselves
  const canView = user?.role === 'admin' || user?.role === 'manager'
    ? true
    : targetId === user?.id;

  if (!canView) {
    router.replace('/staff');
    return null;
  }

  // fetch the user record
  const { users: all } = await authApi.users();
  const target = all.find((u) => u.id === targetId) ?? user;

  if (!target) return <NotFound />;

  const roleMeta = {
    admin: { label: 'Admin', tone: 'brand' },
    manager: { label: 'Manager', tone: 'blue' },
    chef: { label: 'Chef', tone: 'amber' },
    waiter: { label: 'Waiter', tone: 'emerald' },
    customer: { label: 'Customer', tone: 'stone' },
  };

  return (
    <StaffLayout section="account">
      {targetId === user?.id ? (
        <MyAccount />
      ) : (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-stone-900">{target.name}</h2>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 text-sm font-bold text-stone-600 sm:h-12 sm:w-12 sm:text-base"
              aria-hidden="true"
            >
              {target.name?.split(' ').filter(Boolean).map((p) => p[0])[0]?.toUpperCase() ?? ''}
            </span>
            <div>
              <p className="font-medium text-stone-800">{target.email}</p>
              <p className="text-xs text-stone-500">
                Role: {roleMeta[target.role]?.label ?? target.role}
              </p>
              <p className="text-xs text-stone-500">
                Active: {target.active ? 'Yes' : 'Suspended'}  ·  Member since{
                  target.createdAt
                    ? new Date(target.createdAt).toLocaleDateString(undefined, {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })
                    : '—'
                }
              </p>
            </div>
          </div>

          {user?.role === 'admin' && (
            <a
              href="/staff/users"
              className="mt-4 inline-block btn-secondary"
              rel="noopener noreferrer"
            >
              Manage this account in staff management
            </a>
          )}
        </div>
      )}
    </StaffLayout>
  );
}
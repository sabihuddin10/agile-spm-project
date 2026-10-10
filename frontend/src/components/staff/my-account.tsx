'use client';

import type { StaffRole } from '@/types';
import { isStaff } from '@/lib/permissions';
import { useAuth } from '@/context/auth-context';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { AccountProfileForm } from '@/components/staff/account-profile-form';
import { ChangePasswordForm } from '@/components/staff/change-password-form';
import { RoleCapabilities } from '@/components/staff/role-capabilities';
import { ROLE_META, initials } from '@/components/staff/role-meta';

function memberSince(iso: string | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

/** My account — any staff member's own profile, password and role summary. */
export function MyAccount() {
  const { user } = useAuth();
  if (!user || !isStaff(user.role)) return null;

  const role = user.role as StaffRole;
  const since = memberSince(user.createdAt);

  return (
    <>
      <PageHeader title="My account" subtitle="Your details, your password and what your role gives you access to." />

      {user.mustChangePassword ? (
        <div role="alert" className="mb-4 rounded-lg sm:mb-5 border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-medium">You&apos;re signed in with a temporary password.</p>
          <p className="mt-0.5">
            Set your own password below before you carry on.{' '}
            <a href="#change-password" className="font-medium underline underline-offset-2 hover:text-amber-900">
              Go to password
            </a>
          </p>
        </div>
      ) : null}

      {/* Phones: avatar beside the name, badges on one wrapping row below. */}
      <div className="card mb-4 flex flex-wrap items-center gap-x-3 gap-y-2.5 p-4 sm:mb-5 sm:flex-nowrap sm:gap-4 sm:p-5">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-700 sm:h-12 sm:w-12 sm:text-base"
          aria-hidden="true"
        >
          {initials(user.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-stone-900 sm:text-lg">{user.name}</p>
          <p className="truncate text-xs text-stone-500 sm:text-sm">{user.email}</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-1.5 text-xs text-stone-500 sm:w-auto sm:gap-2">
          <Badge tone={ROLE_META[role].tone}>{ROLE_META[role].label}</Badge>
          <Badge tone={user.active ? 'emerald' : 'red'}>{user.active ? 'Active' : 'Suspended'}</Badge>
          {since ? <span>Member since {since}</span> : null}
        </div>
      </div>

      <div className="grid gap-4 sm:gap-5 lg:grid-cols-3 lg:items-start">
        <div className="space-y-4 sm:space-y-5 lg:col-span-2">
          <AccountProfileForm key={user.id} user={user} />
          <ChangePasswordForm id="change-password" />
        </div>
        <RoleCapabilities role={role} />
      </div>
    </>
  );
}

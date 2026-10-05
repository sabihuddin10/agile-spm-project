'use client';

import type { User } from '@/types';
import { can } from '@/lib/permissions';
import { useAuth } from '@/context/auth-context';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { AccountTable } from '@/components/staff/account-table';
import { ROLE_META, STAFF_ROLE_ORDER } from '@/components/staff/role-meta';

/**
 * Team roster with per-role counts. Admins assign roles (US9.2) and suspend or
 * remove staff (US9.4); managers see the roster read-only.
 */
export function TeamPanel({
  roster,
  loading,
  onChanged,
}: {
  roster: User[];
  loading: boolean;
  onChanged: () => unknown;
}) {
  const { user } = useAuth();
  const isAdmin = can.assignRoles(user?.role);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STAFF_ROLE_ORDER.map((role) => {
          const members = roster.filter((u) => u.role === role);
          const suspended = members.filter((u) => !u.active).length;
          return (
            <div key={role} className="card p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">{ROLE_META[role].plural}</p>
              <p className="mt-1 text-2xl font-bold text-stone-800">{loading ? '–' : members.length}</p>
              <p className="text-xs text-stone-500">{suspended ? `${suspended} suspended` : 'All active'}</p>
            </div>
          );
        })}
      </div>

      <div
        className={`rounded-lg border px-4 py-3 text-sm ${
          isAdmin ? 'border-blue-200 bg-blue-50 text-blue-800' : 'border-stone-200 bg-stone-100 text-stone-600'
        }`}
      >
        {isAdmin ? (
          <>
            <p>Role changes apply on the user&apos;s next request or page load — no need for them to sign out.</p>
            <p className="mt-0.5">Suspended or removed staff are signed out on their next request.</p>
          </>
        ) : (
          <p>Roles and account access are managed by an admin. You can review applications and plan shifts.</p>
        )}
      </div>

      <Card className="p-0">
        {loading ? (
          <Spinner label="Loading team…" />
        ) : (
          <AccountTable users={roster} onChanged={onChanged} emptyTitle="No staff accounts yet" />
        )}
      </Card>
    </div>
  );
}

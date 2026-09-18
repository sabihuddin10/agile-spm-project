'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Role, User } from '@/types';
import { authApi } from '@/lib/api';
import { StaffLayout } from '@/components/layout/staff-layout';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';

const ROLES: Role[] = ['customer', 'waiter', 'chef', 'manager', 'admin'];
const STAFF_ROLES = ['waiter', 'chef', 'manager', 'admin'];

export default function UsersPage() {
  const toast = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { users: list } = await authApi.users();
      setUsers(list);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to load users.', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const staff = users.filter((u) => STAFF_ROLES.includes(u.role));
  const staffByRole = (role: Role) => staff.filter((u) => u.role === role).length;

  async function setRole(userId: string, role: Role) {
    try {
      await authApi.updateUser(userId, { role });
      toast('Role updated.', 'success');
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to update role.', 'error');
    }
  }

  async function toggleActive(user: User) {
    try {
      await authApi.updateUser(user.id, { active: !user.active });
      toast(user.active ? 'User deactivated.' : 'User reactivated.', 'success');
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to update status.', 'error');
    }
  }

  return (
    <StaffLayout>
      <PageHeader
        title="Staff & roles"
        subtitle="Sprint 9 · Staff Management + Sprint 1 RBAC (admin): assign roles, suspend access, and view the team roster."
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(['waiter', 'chef', 'manager', 'admin'] as Role[]).map((r) => (
          <div key={r} className="card p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400 capitalize">
              {r}s
            </p>
            <p className="mt-1 text-2xl font-bold text-stone-800">{staffByRole(r)}</p>
          </div>
        ))}
      </div>

      <Card className="p-0">
        {loading ? (
          <Spinner label="Loading users…" />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <p className="font-medium text-stone-800">{u.name}</p>
                      <p className="text-xs text-stone-400">{u.email}</p>
                    </td>
                    <td>
                      <select
                        className="input w-32 !py-1.5 text-xs"
                        value={u.role}
                        onChange={(e) => setRole(u.id, e.target.value as Role)}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <Badge tone={u.active ? 'emerald' : 'red'}>{u.active ? 'Active' : 'Suspended'}</Badge>
                    </td>
                    <td className="text-right">
                      <button
                        onClick={() => toggleActive(u)}
                        className={`btn !px-3 !py-1.5 text-xs ${
                          u.active ? 'btn-danger' : 'btn-secondary'
                        }`}
                      >
                        {u.active ? 'Suspend' : 'Reactivate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </StaffLayout>
  );
}
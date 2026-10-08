'use client';

import { useMemo, useState } from 'react';
import type { Role, User } from '@/types';
import { authApi } from '@/lib/api';
import { can, canAdministerAccount, canManageAccount } from '@/lib/permissions';
import { errorMessage } from '@/lib/format';
import { useAuth } from '@/context/auth-context';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';
import { ConfirmDialog } from '@/components/staff/confirm-dialog';
import { CredentialsModal } from '@/components/staff/credentials-modal';
import { EditAccountModal } from '@/components/staff/edit-account-modal';
import { ROLE_META, ROLE_ORDER, initials, roleRank } from '@/components/staff/role-meta';

const article = (word: string) => (/^[aeiou]/i.test(word) ? 'an' : 'a');

/**
 * List of user accounts. Admins change roles (US9.2), suspend / reactivate and
 * remove (US9.4) accounts below admin. Managers and admins edit details and
 * reset passwords on staff strictly below their own rank (managers: waiters and
 * chefs). Nobody manages their own account here — that is My account.
 */
export function AccountTable({
  users,
  onChanged,
  searchable = false,
  emptyTitle = 'No accounts yet',
}: {
  users: User[];
  onChanged: () => unknown;
  /** Show a search box and role filter (All accounts tab). */
  searchable?: boolean;
  emptyTitle?: string;
}) {
  const { user: me } = useAuth();
  const toast = useToast();
  const canAssign = can.assignRoles(me?.role);
  const canSuspend = can.suspendStaff(me?.role);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [removing, setRemoving] = useState<User | null>(null);
  const [editing, setEditing] = useState<User | null>(null);
  const [resetting, setResetting] = useState<User | null>(null);
  const [issued, setIssued] = useState<{ user: User; tempPassword: string } | null>(null);
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | ''>('');

  const sorted = useMemo(
    () => users.slice().sort((a, b) => roleRank(a.role) - roleRank(b.role) || a.name.localeCompare(b.name)),
    [users],
  );

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return sorted.filter(
      (u) =>
        (!roleFilter || u.role === roleFilter) &&
        (!needle || u.name.toLowerCase().includes(needle) || u.email.toLowerCase().includes(needle)),
    );
  }, [sorted, q, roleFilter]);

  async function changeRole(u: User, role: Role) {
    if (role === u.role) return;
    setBusyId(u.id);
    try {
      await authApi.updateUser(u.id, { role });
      const label = ROLE_META[role].label.toLowerCase();
      toast(`${u.name} is now ${article(label)} ${label}. New permissions apply on their next request or page load.`, 'success');
      await onChanged();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function toggleActive(u: User) {
    setBusyId(u.id);
    try {
      await authApi.updateUser(u.id, { active: !u.active });
      toast(
        u.active ? `${u.name} suspended — they'll be signed out on their next request.` : `${u.name} reactivated.`,
        'success',
      );
      await onChanged();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function confirmRemove() {
    if (!removing) return;
    setBusyId(removing.id);
    try {
      await authApi.removeUser(removing.id);
      toast(`${removing.name}'s account was removed.`, 'success');
      setRemoving(null);
      await onChanged();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function confirmReset() {
    if (!resetting) return;
    setBusyId(resetting.id);
    try {
      const { user: updated, tempPassword } = await authApi.resetPassword(resetting.id);
      setResetting(null);
      setIssued({ user: updated, tempPassword });
      await onChanged();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function detailsSaved() {
    setEditing(null);
    await onChanged();
  }

  return (
    <div>
      {searchable ? (
        <div className="flex flex-col gap-2 border-b border-stone-200 p-4 sm:flex-row">
          <input
            className="input sm:max-w-xs"
            type="search"
            placeholder="Search name or email…"
            aria-label="Search accounts"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            className="input sm:w-48"
            aria-label="Filter by role"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as Role | '')}
          >
            <option value="">All roles ({users.length})</option>
            {ROLE_ORDER.map((r) => (
              <option key={r} value={r}>
                {ROLE_META[r].plural} ({users.filter((u) => u.role === r).length})
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {visible.length === 0 ? (
        <EmptyState title={users.length === 0 ? emptyTitle : 'No accounts match'} hint={users.length ? 'Try a different search or role.' : undefined} />
      ) : (
        <ul className="divide-y divide-stone-100">
          {visible.map((u) => {
            const isSelf = u.id === me?.id;
            const busy = busyId === u.id;
            const selfHint = isSelf ? 'Manage your own account from My account' : undefined;
            // Admin controls show (disabled) on your own row, and not at all on another admin.
            const showAdminControls = isSelf || canAdministerAccount(me, u);
            const manageable = canManageAccount(me, u);
            return (
              <li
                key={u.id}
                className={`flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 ${u.active ? '' : 'bg-stone-50'}`}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      u.active ? 'bg-brand-50 text-brand-700' : 'bg-stone-200 text-stone-500'
                    }`}
                    aria-hidden="true"
                  >
                    {initials(u.name)}
                  </span>
                  <div className="min-w-0">
                    <p className={`truncate font-medium ${u.active ? 'text-stone-800' : 'text-stone-500'}`}>
                      {u.name}
                      {isSelf ? <span className="ml-1.5 text-xs font-normal text-stone-400">(you)</span> : null}
                    </p>
                    <p className="truncate text-xs text-stone-500">{u.email}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pl-12 sm:justify-end sm:pl-0">
                  {canAssign && showAdminControls ? (
                    <select
                      className="input w-auto !py-1.5 text-xs"
                      aria-label={`Role for ${u.name}`}
                      value={u.role}
                      disabled={isSelf || busy}
                      title={selfHint}
                      onChange={(e) => changeRole(u, e.target.value as Role)}
                    >
                      {ROLE_ORDER.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_META[r].label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Badge tone={ROLE_META[u.role].tone}>{ROLE_META[u.role].label}</Badge>
                  )}

                  <Badge tone={u.active ? 'emerald' : 'red'}>{u.active ? 'Active' : 'Suspended'}</Badge>

                  {manageable ? (
                    <>
                      <button
                        type="button"
                        className="btn-secondary !px-3 !py-1.5 text-xs"
                        onClick={() => setEditing(u)}
                        disabled={busy}
                        aria-label={`Edit details for ${u.name}`}
                      >
                        Edit details
                      </button>
                      <button
                        type="button"
                        className="btn-secondary !px-3 !py-1.5 text-xs"
                        onClick={() => setResetting(u)}
                        disabled={busy}
                        aria-label={`Reset password for ${u.name}`}
                      >
                        Reset password
                      </button>
                    </>
                  ) : null}

                  {canSuspend && showAdminControls ? (
                    <>
                      <button
                        type="button"
                        className="btn-secondary !px-3 !py-1.5 text-xs"
                        onClick={() => toggleActive(u)}
                        disabled={isSelf || busy}
                        title={selfHint}
                      >
                        {u.active ? 'Suspend' : 'Reactivate'}
                      </button>
                      <button
                        type="button"
                        className="btn-ghost !px-3 !py-1.5 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={() => setRemoving(u)}
                        disabled={isSelf || busy}
                        title={selfHint}
                      >
                        Remove
                      </button>
                    </>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {removing ? (
        <ConfirmDialog
          title={`Remove ${removing.name}?`}
          confirmLabel="Remove account"
          busy={busyId === removing.id}
          onConfirm={confirmRemove}
          onCancel={() => setRemoving(null)}
        >
          <p>
            <span className="font-medium text-stone-800">{removing.email}</span> will be deleted and signed out on
            their next request. This cannot be undone.
          </p>
          <p>Past orders and shifts stay in the records. To pause access temporarily, suspend the account instead.</p>
        </ConfirmDialog>
      ) : null}

      {resetting ? (
        <ConfirmDialog
          title={`Reset ${resetting.name}'s password?`}
          confirmLabel="Reset password"
          danger={false}
          busy={busyId === resetting.id}
          onConfirm={confirmReset}
          onCancel={() => setResetting(null)}
        >
          <p>
            A temporary password is generated and shown to you once. {resetting.name} is signed out on every device and
            asked to set their own password after signing in.
          </p>
        </ConfirmDialog>
      ) : null}

      {issued ? (
        <CredentialsModal
          variant="reset"
          user={issued.user}
          tempPassword={issued.tempPassword}
          onClose={() => setIssued(null)}
        />
      ) : null}

      {editing ? <EditAccountModal user={editing} onClose={() => setEditing(null)} onSaved={detailsSaved} /> : null}
    </div>
  );
}

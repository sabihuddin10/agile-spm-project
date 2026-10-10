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
import { SetPasswordModal } from '@/components/staff/set-password-modal';
import { RowActionsMenu, type RowAction } from '@/components/staff/row-actions-menu';
import { ROLE_META, ROLE_ORDER, initials, roleRank } from '@/components/staff/role-meta';

const article = (word: string) => (/^[aeiou]/i.test(word) ? 'an' : 'a');

/** One line on what a role can reach, shown before a role change is applied. */
const ROLE_ACCESS: Record<Role, string> = {
  admin: 'Admins can do everything, including changing roles, suspending and removing accounts.',
  manager:
    'Managers run the menu, inventory, refunds, shifts, analytics and settings, and manage waiter and chef accounts.',
  chef: 'Chefs work the kitchen queue and see recipes and stock counts, but not billing, customers or tables.',
  waiter: 'Waiters take orders, seat tables, handle reservations and take payment, but cannot refund.',
  customer: 'Customers lose every staff screen and can only order and book for themselves.',
};

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
  const canSetPasswords = can.setPasswords(me?.role);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [removing, setRemoving] = useState<User | null>(null);
  const [editing, setEditing] = useState<User | null>(null);
  const [resetting, setResetting] = useState<User | null>(null);
  const [settingPassword, setSettingPassword] = useState<User | null>(null);
  const [roleChange, setRoleChange] = useState<{ user: User; role: Role } | null>(null);
  const [suspending, setSuspending] = useState<User | null>(null);
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

  async function confirmRoleChange() {
    if (!roleChange) return;
    const { user: u, role } = roleChange;
    setBusyId(u.id);
    try {
      await authApi.updateUser(u.id, { role });
      const label = ROLE_META[role].label.toLowerCase();
      toast(`${u.name} is now ${article(label)} ${label}. New permissions apply on their next request or page load.`, 'success');
      setRoleChange(null);
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
      setSuspending(null);
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
                      {isSelf ? <span className="ml-1.5 text-xs font-normal text-stone-500">(you)</span> : null}
                    </p>
                    <p className="truncate text-xs text-stone-500">{u.email}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pl-12 sm:justify-end sm:pl-0">
                  {canAssign && showAdminControls ? (
                    <select
                      className="input w-auto py-1.5"
                      aria-label={`Role for ${u.name}`}
                      value={u.role}
                      disabled={isSelf || busy}
                      title={selfHint}
                      onChange={(e) => {
                        const role = e.target.value as Role;
                        if (role !== u.role) setRoleChange({ user: u, role });
                      }}
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
                    <button
                      type="button"
                      className="btn-sm btn-secondary"
                      onClick={() => setEditing(u)}
                      disabled={busy}
                      aria-label={`Edit details for ${u.name}`}
                    >
                      Edit
                    </button>
                  ) : null}

                  {(() => {
                    const actions: RowAction[] = [];
                    if (manageable) {
                      actions.push({
                        label: 'Reset password',
                        ariaLabel: `Reset password for ${u.name}`,
                        onSelect: () => setResetting(u),
                      });
                      if (canSetPasswords) {
                        actions.push({
                          label: 'Set password',
                          ariaLabel: `Set password for ${u.name}`,
                          onSelect: () => setSettingPassword(u),
                        });
                      }
                    }
                    if (canSuspend && showAdminControls && !isSelf) {
                      actions.push({
                        label: u.active ? 'Suspend' : 'Reactivate',
                        onSelect: () => (u.active ? setSuspending(u) : void toggleActive(u)),
                      });
                      actions.push({ label: 'Remove', danger: true, onSelect: () => setRemoving(u) });
                    }
                    // Your own row keeps a disabled trigger so rows line up and the hint explains why.
                    if (actions.length === 0 && !(isSelf && canSuspend)) return null;
                    return (
                      <RowActionsMenu
                        label={`More actions for ${u.name}`}
                        actions={actions}
                        disabled={busy || actions.length === 0}
                        title={actions.length === 0 ? selfHint : undefined}
                      />
                    );
                  })()}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {roleChange ? (
        <ConfirmDialog
          title={`Make ${roleChange.user.name} ${article(ROLE_META[roleChange.role].label)} ${ROLE_META[
            roleChange.role
          ].label.toLowerCase()}?`}
          confirmLabel={`Make ${ROLE_META[roleChange.role].label.toLowerCase()}`}
          danger={roleRank(roleChange.role) > roleRank(roleChange.user.role)}
          busy={busyId === roleChange.user.id}
          onConfirm={confirmRoleChange}
          onCancel={() => setRoleChange(null)}
        >
          <p>{ROLE_ACCESS[roleChange.role]}</p>
          <p>The change applies on their next request or page load.</p>
        </ConfirmDialog>
      ) : null}

      {suspending ? (
        <ConfirmDialog
          title={`Suspend ${suspending.name}?`}
          confirmLabel="Suspend account"
          busy={busyId === suspending.id}
          onConfirm={() => toggleActive(suspending)}
          onCancel={() => setSuspending(null)}
        >
          <p>
            They are signed out on their next request and cannot sign in until reactivated. Their orders and shifts
            stay in the records.
          </p>
        </ConfirmDialog>
      ) : null}

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

      {settingPassword ? (
        <SetPasswordModal
          user={settingPassword}
          onClose={() => setSettingPassword(null)}
          onSaved={async () => {
            setSettingPassword(null);
            await onChanged();
          }}
        />
      ) : null}
    </div>
  );
}

'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { StaffApplication, StaffRole, User } from '@/types';
import { staffApi } from '@/lib/api';
import { errorMessage, formatDateTime, timeAgo } from '@/lib/format';
import { useAuth } from '@/context/auth-context';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/toast';
import { ConfirmDialog } from '@/components/staff/confirm-dialog';
import { CredentialsModal } from '@/components/staff/credentials-modal';
import { ROLE_META } from '@/components/staff/role-meta';

const STATUS_TONE = { pending: 'amber', approved: 'emerald', rejected: 'red' } as const;

/**
 * Staff application review queue (US9.1): approve with a role — managers may
 * approve waiters and chefs, admins also managers — or reject. Approval creates
 * the account and reveals a one-time temporary password.
 */
export function ApplicationsPanel({
  applications,
  loading,
  onChanged,
}: {
  applications: StaffApplication[];
  loading: boolean;
  onChanged: () => unknown;
}) {
  const { user } = useAuth();
  const toast = useToast();
  const approvable: StaffRole[] = user?.role === 'admin' ? ['waiter', 'chef', 'manager'] : ['waiter', 'chef'];

  const [roles, setRoles] = useState<Record<string, StaffRole>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<StaffApplication | null>(null);
  const [created, setCreated] = useState<{ user: User; tempPassword: string } | null>(null);

  const pending = applications.filter((a) => a.status === 'pending');
  const decided = applications.filter((a) => a.status !== 'pending');

  async function approve(app: StaffApplication) {
    const role = roles[app.id] ?? app.desiredRole;
    setBusyId(app.id);
    try {
      const res = await staffApi.approve(app.id, role);
      setCreated({ user: res.user, tempPassword: res.tempPassword });
      toast(`${app.name} approved as ${ROLE_META[role].label.toLowerCase()}.`, 'success');
      await onChanged();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function confirmReject() {
    if (!rejecting) return;
    setBusyId(rejecting.id);
    try {
      await staffApi.reject(rejecting.id);
      toast(`${rejecting.name}'s application was rejected.`, 'success');
      setRejecting(null);
      await onChanged();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <Card>
        <Spinner label="Loading applications…" />
      </Card>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-stone-600">
        <p>
          Candidates apply through the public{' '}
          <Link href="/careers" target="_blank" rel="noreferrer" className="font-medium text-brand-700 hover:underline">
            careers page ↗
          </Link>
          . Approving creates their staff account.
        </p>
        {user?.role !== 'admin' ? (
          <p className="text-xs text-stone-500">Managers can approve waiters and chefs.</p>
        ) : null}
      </div>

      <section aria-labelledby="pending-heading">
        <h2 id="pending-heading" className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-stone-500">
          Awaiting review
          <Badge tone={pending.length ? 'amber' : 'stone'}>{pending.length}</Badge>
        </h2>

        {pending.length === 0 ? (
          <Card>
            <EmptyState title="No pending applications" hint="New applications from the careers page will appear here." />
          </Card>
        ) : (
          <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
            {pending.map((app) => {
              const busy = busyId === app.id;
              const role = roles[app.id] ?? app.desiredRole;
              return (
                <Card key={app.id} className="flex flex-col p-3.5 sm:p-5">
                  {/* Name and role badge in one wrapping row; contact and age underneath. */}
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <p className="text-sm font-semibold text-stone-900 sm:text-base">{app.name}</p>
                    <Badge tone={ROLE_META[app.desiredRole].tone}>Applying as {ROLE_META[app.desiredRole].label.toLowerCase()}</Badge>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-stone-500 sm:text-sm">
                    {app.email}
                    {app.phone ? ` · ${app.phone}` : ''}
                  </p>
                  <p className="mt-0.5 text-xs text-stone-500 sm:mt-1">Applied {timeAgo(app.createdAt)}</p>

                  <p className="mt-2.5 flex-1 whitespace-pre-line rounded-lg bg-stone-50 px-3 py-2 text-sm text-stone-700 sm:mt-3">
                    {app.experience || <span className="italic text-stone-500">No experience details given.</span>}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-2 sm:mt-4">
                    <label htmlFor={`role-${app.id}`} className="text-sm text-stone-500">
                      Approve as
                    </label>
                    <select
                      id={`role-${app.id}`}
                      className="input w-auto"
                      value={role}
                      disabled={busy}
                      onChange={(e) => setRoles((r) => ({ ...r, [app.id]: e.target.value as StaffRole }))}
                    >
                      {approvable.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_META[r].label}
                        </option>
                      ))}
                    </select>
                    <div className="ml-auto flex gap-2">
                      <button type="button" className="btn-secondary" disabled={busy} onClick={() => setRejecting(app)}>
                        Reject
                      </button>
                      <button type="button" className="btn-primary" disabled={busy} onClick={() => approve(app)}>
                        {busy ? 'Approving…' : 'Approve'}
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {decided.length > 0 ? (
        <section aria-labelledby="decided-heading">
          <h2 id="decided-heading" className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">
            Decided
          </h2>
          <Card className="p-0">
            <ul className="divide-y divide-stone-100">
              {decided.map((app) => {
                const role = app.status === 'approved' ? app.approvedRole ?? app.desiredRole : app.desiredRole;
                return (
                  <li key={app.id} className="flex flex-col gap-1.5 px-3.5 py-2.5 sm:flex-row sm:items-center sm:gap-4 sm:px-4 sm:py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-stone-800 sm:text-base">{app.name}</p>
                      <p className="truncate text-xs text-stone-500">{app.email}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
                      <Badge tone={STATUS_TONE[app.status]}>
                        {app.status === 'approved' ? 'Approved' : 'Rejected'}
                      </Badge>
                      <span>
                        {app.status === 'approved' ? 'as' : 'applied as'} {ROLE_META[role].label.toLowerCase()}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        by {app.decidedByName ?? 'unknown'} on {formatDateTime(app.decidedAt)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        </section>
      ) : null}

      {rejecting ? (
        <ConfirmDialog
          title={`Reject ${rejecting.name}?`}
          confirmLabel="Reject application"
          busy={busyId === rejecting.id}
          onConfirm={confirmReject}
          onCancel={() => setRejecting(null)}
        >
          <p>
            The application from <span className="font-medium text-stone-800">{rejecting.email}</span> will be marked
            as rejected. No account is created; they can apply again later.
          </p>
        </ConfirmDialog>
      ) : null}

      {created ? (
        <CredentialsModal user={created.user} tempPassword={created.tempPassword} onClose={() => setCreated(null)} />
      ) : null}
    </div>
  );
}

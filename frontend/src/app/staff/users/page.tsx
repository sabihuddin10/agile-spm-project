'use client';

import { useCallback, useEffect, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { StaffApplication, User } from '@/types';
import { staffApi } from '@/lib/api';
import { can, canAccess } from '@/lib/permissions';
import { errorMessage } from '@/lib/format';
import { useAuth } from '@/context/auth-context';
import { usePolling } from '@/hooks/use-polling';
import { StaffLayout } from '@/components/layout/staff-layout';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { useToast } from '@/components/ui/toast';
import { TeamPanel } from '@/components/staff/team-panel';
import { ApplicationsPanel } from '@/components/staff/applications-panel';
import { ShiftPlanner } from '@/components/staff/shift-planner';
import { PerformancePanel } from '@/components/staff/performance-panel';
import { AllAccountsPanel } from '@/components/staff/all-accounts-panel';

type Tab = 'team' | 'applications' | 'shifts' | 'performance' | 'accounts';

const TAB_LABELS: Record<Tab, string> = {
  team: 'Team',
  applications: 'Applications',
  shifts: 'Shifts',
  performance: 'Performance',
  accounts: 'All accounts',
};

/** Staff management console: roster and roles, hiring, rota, performance and all accounts. */
function StaffManagement() {
  const { user } = useAuth();
  const toast = useToast();
  const role = user?.role;

  const tabs = (Object.keys(TAB_LABELS) as Tab[]).filter((t) => {
    if (t === 'applications') return can.approveStaff(role);
    if (t === 'shifts') return can.scheduleShifts(role);
    if (t === 'accounts') return can.assignRoles(role);
    return canAccess(role, 'staff');
  });

  const [tab, setTab] = useState<Tab>('team');
  const active: Tab = tabs.includes(tab) ? tab : 'team';

  const [roster, setRoster] = useState<User[]>([]);
  const [rosterLoading, setRosterLoading] = useState(true);
  const [rosterError, setRosterError] = useState(false);
  const [applications, setApplications] = useState<StaffApplication[]>([]);
  const [appsLoading, setAppsLoading] = useState(true);
  const canReview = can.approveStaff(role);

  const loadRoster = useCallback(async () => {
    try {
      const { staff } = await staffApi.roster();
      setRoster(staff);
      setRosterError(false);
    } catch (err) {
      setRosterError(true);
      toast(errorMessage(err), 'error');
    } finally {
      setRosterLoading(false);
    }
  }, [toast]);

  const loadApplications = useCallback(
    async (quiet = false) => {
      if (!canReview) return;
      try {
        const { applications: list } = await staffApi.applications();
        setApplications(list);
      } catch (err) {
        if (!quiet) toast(errorMessage(err), 'error');
      } finally {
        setAppsLoading(false);
      }
    },
    [canReview, toast],
  );

  useEffect(() => {
    loadRoster();
    loadApplications();
  }, [loadRoster, loadApplications]);

  // Keep the pending-applications badge current while the page is open.
  usePolling(() => loadApplications(true), 30000, canReview);

  // Deep links such as /staff/users#applications open the matching tab.
  useEffect(() => {
    const fromHash = window.location.hash.slice(1);
    if (Object.prototype.hasOwnProperty.call(TAB_LABELS, fromHash)) setTab(fromHash as Tab);
  }, []);

  function select(next: Tab) {
    setTab(next);
    window.history.replaceState(null, '', `#${next}`);
  }

  function onTabKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const i = tabs.indexOf(active);
    const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    select(next);
    document.getElementById(`tab-${next}`)?.focus();
  }

  const pendingCount = applications.filter((a) => a.status === 'pending').length;

  return (
    <>
      <PageHeader
        title="Staff management"
        subtitle="Team roster and roles, hiring, the weekly rota and staff performance."
      />

      <div
        role="tablist"
        aria-label="Staff management sections"
        onKeyDown={onTabKey}
        className="-mx-4 mb-5 flex gap-1 overflow-x-auto border-b border-stone-200 px-4 sm:mx-0 sm:px-0"
      >
        {tabs.map((t) => {
          const selected = t === active;
          return (
            <button
              key={t}
              id={`tab-${t}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`panel-${t}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(t)}
              className={`-mb-px flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                selected
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-stone-500 hover:border-stone-300 hover:text-stone-800'
              }`}
            >
              {TAB_LABELS[t]}
              {t === 'applications' && pendingCount > 0 ? (
                <span
                  className="rounded-full bg-amber-500 px-1.5 py-px text-xs font-bold leading-4 tabular-nums text-white"
                  aria-label={`${pendingCount} pending`}
                >
                  {pendingCount}
                </span>
              ) : null}
              {t === 'team' && !rosterLoading && !rosterError ? (
                <span className="text-xs font-normal tabular-nums text-stone-500">{roster.length}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`panel-${active}`} aria-labelledby={`tab-${active}`}>
        {active === 'team' && rosterError && roster.length === 0 ? (
          <div className="card">
            <EmptyState
              title="Couldn't load the team"
              hint="Check your connection, then try again."
              action={
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setRosterLoading(true);
                    loadRoster();
                  }}
                >
                  Try again
                </button>
              }
            />
          </div>
        ) : active === 'team' ? (
          <TeamPanel roster={roster} loading={rosterLoading} onChanged={loadRoster} />
        ) : null}
        {active === 'applications' ? (
          <ApplicationsPanel
            applications={applications}
            loading={appsLoading}
            onChanged={() => Promise.all([loadApplications(), loadRoster()])}
          />
        ) : null}
        {active === 'shifts' ? <ShiftPlanner roster={roster} /> : null}
        {active === 'performance' ? <PerformancePanel /> : null}
        {active === 'accounts' ? <AllAccountsPanel onChanged={loadRoster} /> : null}
      </div>
    </>
  );
}

export default function StaffUsersPage() {
  return (
    <StaffLayout section="staff">
      <StaffManagement />
    </StaffLayout>
  );
}

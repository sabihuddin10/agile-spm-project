'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { PresenceEntry, WorkforceOverview } from '@/types';
import { workforceApi } from '@/lib/workforce-api';
import { can } from '@/lib/permissions';
import { errorMessage, money } from '@/lib/format';
import { useAuth } from '@/context/auth-context';
import { usePolling } from '@/hooks/use-polling';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/toast';
import { MonthPicker } from '@/components/workforce/month-picker';
import { PresenceList } from '@/components/workforce/presence-list';
import { StaffDrilldown } from '@/components/workforce/staff-drilldown';
import { StaffOverviewTable } from '@/components/workforce/staff-overview-table';
import { LazyHoursByRole, LazyLatenessTrend, LazyWorkCharts } from '@/components/workforce/lazy-charts';
import { currentMonth, hoursText, monthLabel, ratePct, recentMonths } from '@/components/workforce/workforce-format';

interface Tile {
  label: string;
  value: string;
  hint: string;
}

/** KPI tiles: filter-chip style pills on phones (see .stat in globals.css), stacked cards from `sm` up. */
function KpiTiles({ tiles }: { tiles: Tile[] }) {
  return (
    <dl className={`stat-row grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3 ${tiles.length === 4 ? 'xl:grid-cols-4' : 'xl:grid-cols-3'}`}>
      {tiles.map((t) => (
        <div key={t.label} className="stat card min-w-0 p-4">
          <dt className="stat-label min-w-0 text-xs font-medium text-stone-500">{t.label}</dt>
          <dd className="stat-value mt-1 text-2xl font-semibold tabular-nums text-stone-900">{t.value}</dd>
          <dd className="stat-extra mt-0.5 text-xs text-stone-500">{t.hint}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Workforce hub (managers and admins): month KPIs, live presence, team charts
 * and the staff table with drill-down. Managers see waiters and chefs only and
 * never any money; admins see everyone, payroll, and can edit wages and bonuses.
 *
 * The open drill-down lives in the URL (`?staff=<id>`) so it can be shared and
 * the browser's Back button closes it.
 */
export function WorkforceHub() {
  return (
    <Suspense
      fallback={
        <Card>
          <Spinner label="Loading workforce…" />
        </Card>
      }
    >
      <WorkforceHubContent />
    </Suspense>
  );
}

function WorkforceHubContent() {
  const { user } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isAdmin = can.managePay(user?.role);
  const [month, setMonth] = useState(() => currentMonth());
  const [overview, setOverview] = useState<WorkforceOverview | null>(null);
  const [overviewError, setOverviewError] = useState(false);
  const [people, setPeople] = useState<PresenceEntry[]>([]);
  const selected = searchParams?.get('staff') || null;
  // True when this page pushed the drill-down entry, so "Back to team" can pop it.
  const pushedRef = useRef(false);

  const select = useCallback(
    (id: string) => {
      pushedRef.current = true;
      router.push(`${pathname}?staff=${encodeURIComponent(id)}`);
    },
    [router, pathname],
  );

  const closeDrilldown = useCallback(() => {
    if (pushedRef.current) {
      pushedRef.current = false;
      router.back();
    } else {
      router.replace(pathname, { scroll: false });
    }
  }, [router, pathname]);

  const loadOverview = useCallback(async () => {
    try {
      setOverview(await workforceApi.overview(month));
      setOverviewError(false);
    } catch (err) {
      setOverviewError(true);
      toast(errorMessage(err), 'error');
    }
  }, [month, toast]);

  const loadPresence = useCallback(async () => {
    try {
      setPeople((await workforceApi.presence()).people);
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  }, [toast]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);
  useEffect(() => {
    loadPresence();
  }, [loadPresence]);
  usePolling(loadPresence, 30000);

  const tiles: Tile[] = [];
  if (overview) {
    const worked = overview.rows.reduce((s, r) => s + r.summary.shiftsWorked, 0);
    const missed = overview.rows.reduce((s, r) => s + r.summary.shiftsMissed, 0);
    const lateMinutes = overview.rows.reduce((s, r) => s + r.summary.lateMinutes, 0);
    tiles.push(
      { label: 'Paid hours', value: hoursText(overview.totals.paidMinutes), hint: `${overview.rows.length} people, breaks excluded` },
      { label: 'Late arrivals', value: String(overview.totals.lateCount), hint: lateMinutes ? `${lateMinutes} min late in total` : 'Nobody late' },
      {
        label: 'Attendance',
        value: worked + missed ? ratePct(worked / (worked + missed)) : '—',
        hint: `${worked} shifts worked, ${missed} missed`,
      },
    );
    if (isAdmin && overview.totals.payroll !== null) {
      tiles.push({ label: 'Payroll', value: money(overview.totals.payroll), hint: 'Wages, tips and bonuses, less late deductions' });
    }
  }

  const picker = <MonthPicker value={month} months={recentMonths(4)} onChange={setMonth} id="workforce-month" />;

  return (
    <>
      <PageHeader
        title="Workforce"
        subtitle={
          isAdmin
            ? 'Attendance, hours, lateness and payroll for the whole team.'
            : 'Attendance, hours and lateness for waiters and chefs.'
        }
        action={picker}
      />

      {selected ? (
        <StaffDrilldown
          userId={selected}
          month={month}
          canManagePay={isAdmin}
          onBack={closeDrilldown}
          onChanged={loadOverview}
        />
      ) : !overview && overviewError ? (
        <Card>
          <EmptyState
            title="Couldn't load the workforce overview"
            hint="Check your connection, then try again."
            action={
              <button type="button" className="btn-secondary" onClick={() => loadOverview()}>
                Try again
              </button>
            }
          />
        </Card>
      ) : !overview ? (
        <Card>
          <Spinner label="Loading workforce…" />
        </Card>
      ) : (
        <div className="space-y-3 sm:space-y-6">
          <section aria-label={`Totals for ${monthLabel(month)}`}>
            <KpiTiles tiles={tiles} />
          </section>

          <PresenceList people={people} selfId={user?.id} title="Who's in now" variant="board" />

          <div className="grid grid-cols-1 gap-3 sm:gap-4 xl:grid-cols-3">
            <div className="min-w-0 xl:col-span-2">
              <LazyWorkCharts
                series={overview.series}
                modes={['week', 'day', 'hour']}
                title="Team hours"
                subtitle={`All visible staff, ${monthLabel(month)}.`}
              />
            </div>
            <div className="min-w-0 space-y-3 sm:space-y-4">
              <LazyHoursByRole rows={overview.rows} />
              <LazyLatenessTrend days={overview.series.day} />
            </div>
          </div>

          <StaffOverviewTable overview={overview} showPay={isAdmin} onSelect={select} />
        </div>
      )}
    </>
  );
}

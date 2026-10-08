'use client';

import { useCallback, useEffect, useState } from 'react';
import type { PresenceEntry, WorkforceOverview } from '@/types';
import { workforceApi } from '@/lib/workforce-api';
import { can } from '@/lib/permissions';
import { errorMessage, money } from '@/lib/format';
import { useAuth } from '@/context/auth-context';
import { usePolling } from '@/hooks/use-polling';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/toast';
import { MonthPicker } from '@/components/workforce/month-picker';
import { PresenceList } from '@/components/workforce/presence-list';
import { StaffDrilldown } from '@/components/workforce/staff-drilldown';
import { StaffOverviewTable } from '@/components/workforce/staff-overview-table';
import { HoursByRole, LatenessTrend } from '@/components/workforce/team-charts';
import { WorkCharts } from '@/components/workforce/work-charts';
import { currentMonth, hoursText, monthLabel, ratePct, recentMonths } from '@/components/workforce/workforce-format';

interface Tile {
  label: string;
  value: string;
  hint: string;
}

/** KPI tiles: a compact row (label left, number right) on phones, stacked cards from `sm` up. */
function KpiTiles({ tiles }: { tiles: Tile[] }) {
  return (
    <dl className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${tiles.length === 4 ? 'xl:grid-cols-4' : 'xl:grid-cols-3'}`}>
      {tiles.map((t) => (
        <div key={t.label} className="card flex min-w-0 items-center justify-between gap-3 !p-4 sm:block">
          <dt className="min-w-0 text-xs font-medium text-stone-500">{t.label}</dt>
          <dd className="shrink-0 text-xl font-semibold tabular-nums text-stone-900 sm:mt-1 sm:text-2xl">{t.value}</dd>
          <dd className="mt-0.5 hidden text-xs text-stone-400 sm:block">{t.hint}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Workforce hub (managers and admins): month KPIs, live presence, team charts
 * and the staff table with drill-down. Managers see waiters and chefs only and
 * never any money; admins see everyone, payroll, and can edit wages and bonuses.
 */
export function WorkforceHub() {
  const { user } = useAuth();
  const toast = useToast();
  const isAdmin = can.managePay(user?.role);
  const [month, setMonth] = useState(() => currentMonth());
  const [overview, setOverview] = useState<WorkforceOverview | null>(null);
  const [people, setPeople] = useState<PresenceEntry[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    try {
      setOverview(await workforceApi.overview(month));
    } catch (err) {
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
          onBack={() => setSelected(null)}
          onChanged={loadOverview}
        />
      ) : !overview ? (
        <Card>
          <Spinner label="Loading workforce…" />
        </Card>
      ) : (
        <div className="space-y-6">
          <section aria-label={`Totals for ${monthLabel(month)}`}>
            <KpiTiles tiles={tiles} />
          </section>

          <PresenceList people={people} selfId={user?.id} title="Who's in now" variant="board" />

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="min-w-0 xl:col-span-2">
              <WorkCharts
                series={overview.series}
                modes={['week', 'day', 'hour']}
                title="Team hours"
                subtitle={`All visible staff, ${monthLabel(month)}.`}
              />
            </div>
            <div className="min-w-0 space-y-4">
              <HoursByRole rows={overview.rows} />
              <LatenessTrend days={overview.series.day} />
            </div>
          </div>

          <StaffOverviewTable overview={overview} showPay={isAdmin} onSelect={setSelected} />
        </div>
      )}
    </>
  );
}

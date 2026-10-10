'use client';

import { Bar, Chart } from 'react-chartjs-2';
import type { ChartData, ChartOptions } from 'chart.js';
import type { SeriesPoint, StaffRole, WorkforceOverviewRow } from '@/types';
import { CHART_COLORS, TOOLTIP_STYLE } from '@/components/analytics/chart-setup';
import { DataTableToggle } from '@/components/analytics/analytics-card';
import { EmptyState } from '@/components/ui/empty-state';
import { ROLE_META, STAFF_ROLE_ORDER } from '@/components/staff/role-meta';
import { hoursText } from '@/components/workforce/workforce-format';
import { WORKFORCE_CHART_COLORS, chartAnimation } from '@/components/workforce/chart-tokens';

const toHours = (m: number) => Math.round((m / 60) * 10) / 10;

function CardShell({ id, title, subtitle, children }: { id: string; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="card flex min-w-0 flex-col p-4 sm:p-5" aria-labelledby={id}>
      <h2 id={id} className="text-lg font-semibold">
        {title}
      </h2>
      <p className="mb-4 mt-0.5 text-sm text-stone-500">{subtitle}</p>
      {children}
    </section>
  );
}

/** Paid vs scheduled hours per role for the month. */
export function HoursByRole({ rows }: { rows: WorkforceOverviewRow[] }) {
  const roles = STAFF_ROLE_ORDER.filter((r) => rows.some((row) => row.user.role === r));
  const total = (role: StaffRole, key: 'paidMinutes' | 'scheduledMinutes') =>
    rows.filter((r) => r.user.role === role).reduce((s, r) => s + r.summary[key], 0);
  const data: ChartData<'bar', number[], string> = {
    labels: roles.map((r) => ROLE_META[r].plural),
    datasets: [
      { label: 'Scheduled', data: roles.map((r) => toHours(total(r, 'scheduledMinutes'))), backgroundColor: CHART_COLORS.muted, borderRadius: 3, maxBarThickness: 18 },
      { label: 'Paid', data: roles.map((r) => toHours(total(r, 'paidMinutes'))), backgroundColor: CHART_COLORS.count, borderRadius: 3, maxBarThickness: 18 },
    ],
  };
  const options: ChartOptions<'bar'> = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    animation: chartAnimation(),
    plugins: {
      legend: { display: false },
      tooltip: { ...TOOLTIP_STYLE, callbacks: { label: (i) => ` ${i.dataset.label}: ${i.raw as number} h` } },
    },
    scales: {
      x: { beginAtZero: true, grid: { color: CHART_COLORS.grid }, border: { display: false }, title: { display: true, text: 'Hours', color: WORKFORCE_CHART_COLORS.axisTitle } },
      y: { grid: { display: false }, border: { color: CHART_COLORS.axis } },
    },
  };
  const description = roles
    .map((r) => `${ROLE_META[r].plural}: ${hoursText(total(r, 'paidMinutes'))} paid of ${hoursText(total(r, 'scheduledMinutes'))}`)
    .join('; ');

  return (
    <CardShell id="hours-by-role-heading" title="Hours by role" subtitle="Paid against scheduled, this month.">
      {roles.length === 0 ? (
        <EmptyState title="No hours yet" />
      ) : (
        <>
          <div className="relative h-48" role="img" aria-label={`Hours by role. ${description}.`}>
            <Bar data={data} options={options} />
          </div>
          <DataTableToggle>
            <table className="table-base">
              <thead className="sticky top-0 bg-white">
                <tr>
                  <th scope="col">Role</th>
                  <th scope="col" className="text-right">Scheduled</th>
                  <th scope="col" className="text-right">Paid</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {roles.map((r) => (
                  <tr key={r}>
                    <td>{ROLE_META[r].plural}</td>
                    <td className="text-right">{hoursText(total(r, 'scheduledMinutes'))}</td>
                    <td className="text-right">{hoursText(total(r, 'paidMinutes'))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTableToggle>
        </>
      )}
    </CardShell>
  );
}

/** Late arrivals per day across the team. */
export function LatenessTrend({ days }: { days: SeriesPoint[] }) {
  const total = days.reduce((s, d) => s + d.lateCount, 0);
  const worst = days.reduce<SeriesPoint | null>((w, d) => (d.lateCount > (w?.lateCount ?? 0) ? d : w), null);
  const data: ChartData<'line', number[], string> = {
    labels: days.map((d) => d.label),
    datasets: [
      {
        label: 'Late arrivals',
        data: days.map((d) => d.lateCount),
        borderColor: WORKFORCE_CHART_COLORS.danger,
        backgroundColor: WORKFORCE_CHART_COLORS.danger,
        borderWidth: 2,
        pointRadius: days.map((d) => (d.lateCount > 0 ? 3 : 0)),
        tension: 0.25,
        stepped: false,
      },
    ],
  };
  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: chartAnimation(),
    plugins: { legend: { display: false }, tooltip: { ...(TOOLTIP_STYLE as object) } },
    scales: {
      x: { grid: { display: false }, border: { color: CHART_COLORS.axis }, ticks: { maxRotation: 0, autoSkip: true, autoSkipPadding: 12 } },
      y: { beginAtZero: true, grid: { color: CHART_COLORS.grid }, border: { display: false }, ticks: { precision: 0, maxTicksLimit: 4 } },
    },
  };
  const description = total
    ? `${total} late arrival${total === 1 ? '' : 's'} this month${worst ? `; most on ${worst.label} (${worst.lateCount})` : ''}.`
    : 'No late arrivals this month.';

  return (
    <CardShell id="lateness-heading" title="Lateness" subtitle="Late check-ins per day across the team.">
      <p className="mb-3 text-sm text-stone-600">{description}</p>
      <div className="relative h-48" role="img" aria-label={`Lateness trend. ${description}`}>
        <Chart type="line" data={data} options={options} />
      </div>
      <DataTableToggle>
        <table className="table-base">
          <thead className="sticky top-0 bg-white">
            <tr>
              <th scope="col">Day</th>
              <th scope="col" className="text-right">Late arrivals</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {days.map((d) => (
              <tr key={d.key}>
                <td>{d.label}</td>
                <td className="text-right">{d.lateCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTableToggle>
    </CardShell>
  );
}

'use client';

import { useState } from 'react';
import { Chart } from 'react-chartjs-2';
import type { ChartData, ChartOptions } from 'chart.js';
import type { SeriesPoint, WorkSeries } from '@/types';
import { CHART_COLORS, TOOLTIP_STYLE } from '@/components/analytics/chart-setup';
import { DataTableToggle, Segmented } from '@/components/analytics/analytics-card';
import { EmptyState } from '@/components/ui/empty-state';
import { hoursText } from '@/components/workforce/workforce-format';
import { WORKFORCE_CHART_COLORS, chartAnimation } from '@/components/workforce/chart-tokens';

export type ChartMode = 'day' | 'week' | 'month' | 'hour';

type Mixed = 'bar' | 'line';

const MODE_LABEL: Record<ChartMode, string> = { day: 'Day', week: 'Week', month: 'Month', hour: 'Hour of day' };

/** Break bars sit in a warm neutral so they read as "time off the clock", not as a state. */
const BREAK_COLOR = WORKFORCE_CHART_COLORS.breakTime;
const LATE_COLOR = WORKFORCE_CHART_COLORS.danger; // late is a state

const toHours = (m: number) => Math.round((m / 60) * 10) / 10;

function describe(points: SeriesPoint[], mode: ChartMode): string {
  const paid = points.reduce((s, p) => s + p.paidMinutes, 0);
  const scheduled = points.reduce((s, p) => s + p.scheduledMinutes, 0);
  const breaks = points.reduce((s, p) => s + p.breakMinutes, 0);
  const late = points.reduce((s, p) => s + p.lateCount, 0);
  const top = [...points].filter((p) => p.paidMinutes > 0).sort((a, b) => b.paidMinutes - a.paidMinutes).slice(0, 3);
  const base = `${hoursText(paid)} paid of ${hoursText(scheduled)} scheduled, ${hoursText(breaks)} of breaks, ${late} late arrival${late === 1 ? '' : 's'}.`;
  if (!top.length) return base;
  return `${base} ${mode === 'hour' ? 'Busiest hours' : 'Most hours'}: ${top.map((p) => `${p.label} (${hoursText(p.paidMinutes)})`).join(', ')}.`;
}

/**
 * Paid vs scheduled hours, break time and late arrivals by day, ISO week,
 * month or hour of day, with a text summary and a data-table twin.
 */
export function WorkCharts({
  series,
  modes = ['day', 'week', 'month', 'hour'],
  title = 'Hours breakdown',
  subtitle,
  initialMode,
}: {
  series: Partial<WorkSeries>;
  modes?: ChartMode[];
  title?: string;
  subtitle?: string;
  initialMode?: ChartMode;
}) {
  const [mode, setMode] = useState<ChartMode>(initialMode ?? modes[0]);
  const points = series[mode] ?? [];
  const hasData = points.some((p) => p.paidMinutes > 0 || p.scheduledMinutes > 0);
  const dense = points.length > 31;
  const headingId = `work-charts-${title.replace(/\W/g, '').toLowerCase()}`;

  const chartData: ChartData<Mixed, number[], string> = {
    labels: points.map((p) => p.label),
    datasets: [
      {
        type: 'bar',
        label: 'Scheduled',
        data: points.map((p) => toHours(p.scheduledMinutes)),
        backgroundColor: CHART_COLORS.muted,
        hoverBackgroundColor: CHART_COLORS.mutedHover,
        borderRadius: 3,
        maxBarThickness: 20,
        yAxisID: 'y',
        order: 3,
      },
      {
        type: 'bar',
        label: 'Paid',
        data: points.map((p) => toHours(p.paidMinutes)),
        backgroundColor: CHART_COLORS.count,
        hoverBackgroundColor: CHART_COLORS.countHover,
        borderRadius: 3,
        maxBarThickness: 20,
        yAxisID: 'y',
        order: 2,
      },
      {
        type: 'bar',
        label: 'Breaks',
        data: points.map((p) => toHours(p.breakMinutes)),
        backgroundColor: BREAK_COLOR,
        borderRadius: 3,
        maxBarThickness: 20,
        yAxisID: 'y',
        order: 4,
      },
      {
        type: 'line',
        label: 'Late arrivals',
        data: points.map((p) => p.lateCount),
        borderColor: LATE_COLOR,
        backgroundColor: LATE_COLOR,
        showLine: false,
        pointStyle: 'triangle',
        pointRadius: points.map((p) => (p.lateCount > 0 ? 5 : 0)),
        pointHoverRadius: 7,
        yAxisID: 'y1',
        order: 1,
      },
    ],
  };

  const options: ChartOptions<Mixed> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: chartAnimation(),
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        ...(TOOLTIP_STYLE as object),
        callbacks: {
          label: (item) =>
            item.dataset.label === 'Late arrivals' ? ` Late arrivals: ${item.raw as number}` : ` ${item.dataset.label}: ${item.raw as number} h`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { color: CHART_COLORS.axis },
        ticks: { maxRotation: 0, autoSkip: true, autoSkipPadding: dense ? 12 : 8 },
      },
      y: {
        beginAtZero: true,
        grid: { color: CHART_COLORS.grid },
        border: { display: false },
        ticks: { maxTicksLimit: 6 },
        title: { display: true, text: 'Hours', color: WORKFORCE_CHART_COLORS.axisTitle },
      },
      y1: {
        position: 'right',
        beginAtZero: true,
        grid: { display: false },
        border: { display: false },
        ticks: { precision: 0, maxTicksLimit: 4 },
        title: { display: true, text: 'Late', color: WORKFORCE_CHART_COLORS.axisTitle },
      },
    },
  };

  const description = describe(points, mode);

  return (
    <section className="card flex min-w-0 flex-col p-3.5 sm:p-5" aria-labelledby={headingId}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3 sm:mb-4">
        <div className="min-w-0">
          <h2 id={headingId} className="text-base font-semibold sm:text-lg">
            {title}
          </h2>
          {subtitle ? <p className="mt-0.5 text-sm text-stone-500">{subtitle}</p> : null}
        </div>
        <Segmented<ChartMode>
          label="Group hours by"
          value={mode}
          onChange={setMode}
          options={modes.map((m) => ({ value: m, label: MODE_LABEL[m] }))}
        />
      </div>

      {!hasData ? (
        <EmptyState title="No hours in this period" />
      ) : (
        <>
          <p className="mb-3 text-sm text-stone-600">{description}</p>
          <div className="relative h-48 sm:h-72" role="img" aria-label={`${title} by ${MODE_LABEL[mode].toLowerCase()}. ${description}`}>
            <Chart type="bar" data={chartData} options={options} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-600" aria-hidden="true">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: CHART_COLORS.muted }} />
              Scheduled
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: CHART_COLORS.count }} />
              Paid
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: BREAK_COLOR }} />
              Breaks (unpaid)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="text-xs leading-none" style={{ color: LATE_COLOR }} aria-hidden="true">
                ▲
              </span>
              Late arrivals
            </span>
          </div>
          <DataTableToggle>
            <table className="table-base">
              <thead className="sticky top-0 bg-white">
                <tr>
                  <th scope="col">{MODE_LABEL[mode]}</th>
                  <th scope="col" className="text-right">Scheduled</th>
                  <th scope="col" className="text-right">Paid</th>
                  <th scope="col" className="text-right">Breaks</th>
                  <th scope="col" className="text-right">Late</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {points.map((p) => (
                  <tr key={p.key}>
                    <td>{p.label}</td>
                    <td className="text-right">{hoursText(p.scheduledMinutes)}</td>
                    <td className="text-right">{hoursText(p.paidMinutes)}</td>
                    <td className="text-right">{hoursText(p.breakMinutes)}</td>
                    <td className="text-right">{p.lateCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTableToggle>
        </>
      )}
    </section>
  );
}

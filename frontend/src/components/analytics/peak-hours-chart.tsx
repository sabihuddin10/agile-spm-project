'use client';

import { Bar } from 'react-chartjs-2';
import type { ChartData, ChartOptions } from 'chart.js';
import type { AnalyticsDashboard } from '@/types';
import { CHART_COLORS, TOOLTIP_STYLE } from '@/components/analytics/chart-setup';
import { AnalyticsCard, DataTableToggle } from '@/components/analytics/analytics-card';
import { count, currency, hourLabel } from '@/components/analytics/analytics-format';
import { EmptyState } from '@/components/ui/empty-state';

/**
 * US10.4 — orders by hour of day across the period; the three busiest hours are
 * highlighted in brand colour and the busiest hour's daily average is called out.
 */
export function PeakHoursChart({ hours, className = '' }: { hours: AnalyticsDashboard['peakHours']; className?: string }) {
  const top = [...hours]
    .filter((h) => h.orders > 0)
    .sort((a, b) => b.orders - a.orders || a.hour - b.hour)
    .slice(0, 3);
  const topHours = new Set(top.map((h) => h.hour));
  const peak = top[0] ?? null;
  const total = hours.reduce((s, h) => s + h.orders, 0);

  const chartData: ChartData<'bar', number[], string> = {
    labels: hours.map((h) => hourLabel(h.hour)),
    datasets: [
      {
        label: 'Orders',
        data: hours.map((h) => h.orders),
        backgroundColor: hours.map((h) => (topHours.has(h.hour) ? CHART_COLORS.revenue : CHART_COLORS.muted)),
        hoverBackgroundColor: hours.map((h) => (topHours.has(h.hour) ? CHART_COLORS.revenueHover : CHART_COLORS.mutedHover)),
        borderRadius: 4,
        maxBarThickness: 24,
        categoryPercentage: 0.85,
        barPercentage: 0.9,
      },
    ],
  };

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 250 },
    plugins: {
      legend: { display: false },
      tooltip: {
        ...TOOLTIP_STYLE,
        callbacks: {
          title: (items) => {
            const h = items[0] ? hours[items[0].dataIndex] : null;
            return h ? `${hourLabel(h.hour)}–${hourLabel((h.hour + 1) % 24)}${topHours.has(h.hour) ? '  ·  Top 3' : ''}` : '';
          },
          label: (item) => {
            const h = hours[item.dataIndex];
            return h ? ` ${count(h.orders)} orders · ${h.avgPerDay}/day avg` : '';
          },
          afterLabel: (item) => {
            const h = hours[item.dataIndex];
            return h ? ` ${currency(h.revenue)} revenue` : '';
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { color: CHART_COLORS.axis },
        ticks: { maxRotation: 0, autoSkip: true, autoSkipPadding: 8 },
      },
      y: {
        beginAtZero: true,
        grid: { color: CHART_COLORS.grid },
        border: { display: false },
        ticks: { precision: 0, maxTicksLimit: 6 },
        title: { display: true, text: 'Orders', color: CHART_COLORS.axisTitle },
      },
    },
  };

  const description = peak
    ? `Orders by hour of day. Busiest hours: ${top.map((h) => `${hourLabel(h.hour)} (${count(h.orders)} orders)`).join(', ')}.`
    : 'No orders.';

  return (
    <AnalyticsCard
      title="Peak hours"
      story="US10.4"
      subtitle="Orders placed in each hour of opening time."
      className={className}
    >
      {total === 0 ? (
        <EmptyState title="No orders in this period" />
      ) : (
        <>
          {peak ? (
            <p className="mb-3 text-sm text-stone-600">
              Busiest hour <span className="font-semibold text-stone-900">{hourLabel(peak.hour)}</span> — averaging{' '}
              <span className="font-semibold text-stone-900">{peak.avgPerDay} orders/day</span> ({count(peak.orders)} in total).
            </p>
          ) : null}
          <div className="relative h-48 sm:h-64" role="img" aria-label={description}>
            <Bar data={chartData} options={options} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-600">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: CHART_COLORS.revenue }} aria-hidden="true" />
              Top 3 hours: {top.map((h) => hourLabel(h.hour)).join(', ')}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: CHART_COLORS.muted }} aria-hidden="true" />
              Other hours
            </span>
          </div>
          <DataTableToggle>
            <table className="table-base">
              <thead className="sticky top-0 bg-white">
                <tr>
                  <th scope="col">Hour</th>
                  <th scope="col" className="text-right">Orders</th>
                  <th scope="col" className="text-right">Avg / day</th>
                  <th scope="col" className="text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {hours.map((h) => (
                  <tr key={h.hour} className={topHours.has(h.hour) ? 'bg-brand-50/60' : ''}>
                    <td>
                      {hourLabel(h.hour)}
                      {topHours.has(h.hour) ? <span className="sr-only"> (top 3)</span> : null}
                    </td>
                    <td className="text-right">{count(h.orders)}</td>
                    <td className="text-right">{h.avgPerDay}</td>
                    <td className="text-right">{currency(h.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTableToggle>
        </>
      )}
    </AnalyticsCard>
  );
}

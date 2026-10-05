'use client';

import { Chart } from 'react-chartjs-2';
import type { ChartData, ChartOptions } from 'chart.js';
import type { AnalyticsDashboard } from '@/types';
import { CHART_COLORS, TOOLTIP_STYLE } from '@/components/analytics/chart-setup';
import { AnalyticsCard, DataTableToggle } from '@/components/analytics/analytics-card';
import { compactCurrency, count, currency, longDate, periodLabel, periodLongLabel } from '@/components/analytics/analytics-format';
import { EmptyState } from '@/components/ui/empty-state';

type Mixed = 'bar' | 'line';

/**
 * US10.1 — revenue (bars, $) and order count (line, second axis) for each
 * day / week / month of the selected period, with a data-table twin.
 */
export function RevenueTrendChart({ data }: { data: AnalyticsDashboard }) {
  const { trend, range } = data;
  const g = range.granularity;
  const labels = trend.map((t) => periodLabel(t.period, g));
  const longLabels = trend.map((t) => periodLongLabel(t.period, g, range.from, range.to));
  const totalOrders = trend.reduce((s, t) => s + t.orders, 0);
  const best = trend.reduce<(typeof trend)[number] | null>((b, t) => (!b || t.revenue > b.revenue ? t : b), null);
  const bestIdx = best ? trend.indexOf(best) : -1;
  const dense = trend.length > 31;

  const chartData: ChartData<Mixed, number[], string> = {
    labels,
    datasets: [
      {
        type: 'bar',
        label: 'Revenue',
        data: trend.map((t) => t.revenue),
        backgroundColor: CHART_COLORS.revenue,
        hoverBackgroundColor: CHART_COLORS.revenueHover,
        borderRadius: 4,
        maxBarThickness: 24,
        categoryPercentage: 0.8,
        barPercentage: 0.9,
        yAxisID: 'y',
        order: 2,
      },
      {
        type: 'line',
        label: 'Orders',
        data: trend.map((t) => t.orders),
        borderColor: CHART_COLORS.count,
        backgroundColor: CHART_COLORS.count,
        borderWidth: 2,
        pointRadius: dense ? 0 : 4,
        pointHoverRadius: 6,
        pointHitRadius: 12,
        pointBorderColor: CHART_COLORS.surface,
        pointBorderWidth: 2,
        tension: 0.3,
        yAxisID: 'y1',
        order: 1,
      },
    ],
  };

  const options: ChartOptions<Mixed> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 250 },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'top',
        align: 'end',
        labels: { usePointStyle: true, pointStyle: 'rectRounded', boxWidth: 8, boxHeight: 8, color: '#44403c' },
      },
      tooltip: {
        ...(TOOLTIP_STYLE as object),
        callbacks: {
          title: (items) => (items[0] ? longLabels[items[0].dataIndex] : ''),
          label: (item) =>
            item.dataset.label === 'Revenue' ? ` Revenue: ${currency(item.parsed.y ?? 0)}` : ` Orders: ${count(item.parsed.y ?? 0)}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { color: CHART_COLORS.axis },
        ticks: { autoSkip: true, maxRotation: 0, autoSkipPadding: 12 },
      },
      y: {
        position: 'left',
        beginAtZero: true,
        grid: { color: CHART_COLORS.grid },
        border: { display: false },
        ticks: { callback: (v) => compactCurrency(Number(v)), maxTicksLimit: 6 },
        title: { display: true, text: 'Revenue ($)', color: '#78716c' },
      },
      y1: {
        position: 'right',
        beginAtZero: true,
        grid: { drawOnChartArea: false },
        border: { display: false },
        ticks: { precision: 0, maxTicksLimit: 6 },
        title: { display: true, text: 'Orders', color: '#78716c' },
      },
    },
  };

  const description = best
    ? `Revenue and order count by ${g} from ${longDate(range.from)} to ${longDate(range.to)}. ` +
      `Total ${currency(data.kpis.revenue)} from ${count(totalOrders)} orders. ` +
      `Highest revenue: ${longLabels[bestIdx]} with ${currency(best.revenue)} from ${count(best.orders)} orders.`
    : 'No revenue data.';

  return (
    <AnalyticsCard
      title="Revenue & orders trend"
      story="US10.1"
      subtitle={`Net revenue (bars) and orders placed (line) per ${g}.`}
    >
      {totalOrders === 0 ? (
        <EmptyState title="No orders in this period" hint="Pick a wider range — the demo data covers the last 60 days." />
      ) : (
        <>
          <div className="relative h-64 sm:h-80" role="img" aria-label={description}>
            <Chart type="bar" data={chartData} options={options} />
          </div>
          {best ? (
            <p className="mt-3 text-sm text-stone-600">
              Best {g}: <span className="font-semibold text-stone-900">{longLabels[bestIdx]}</span> —{' '}
              {currency(best.revenue)} from {count(best.orders)} orders.
            </p>
          ) : null}
          <DataTableToggle>
            <table className="table-base">
              <thead className="sticky top-0 bg-white">
                <tr>
                  <th scope="col">Period</th>
                  <th scope="col" className="text-right">Revenue</th>
                  <th scope="col" className="text-right">Orders</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {trend.map((t, i) => (
                  <tr key={t.period}>
                    <td className="whitespace-nowrap">{longLabels[i]}</td>
                    <td className="text-right">{currency(t.revenue)}</td>
                    <td className="text-right">{count(t.orders)}</td>
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

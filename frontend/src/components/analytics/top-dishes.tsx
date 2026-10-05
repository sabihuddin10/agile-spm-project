'use client';

import { useState } from 'react';
import { Bar } from 'react-chartjs-2';
import type { ChartData, ChartOptions } from 'chart.js';
import type { AnalyticsDashboard } from '@/types';
import { CHART_COLORS, TOOLTIP_STYLE } from '@/components/analytics/chart-setup';
import { AnalyticsCard, Segmented } from '@/components/analytics/analytics-card';
import { compactCurrency, count, currency } from '@/components/analytics/analytics-format';
import { EmptyState } from '@/components/ui/empty-state';

type Metric = 'qty' | 'revenue';

const METRICS: { value: Metric; label: string }[] = [
  { value: 'qty', label: 'By quantity' },
  { value: 'revenue', label: 'By revenue' },
];

const TOP_N = 10;

/**
 * US10.2 — best-selling dishes in the period, ranked by quantity sold or by
 * revenue: a horizontal bar chart of the top 10 plus a compact ranked table.
 */
export function TopDishes({ dishes, className = '' }: { dishes: AnalyticsDashboard['dishes']; className?: string }) {
  const [metric, setMetric] = useState<Metric>('qty');

  const ranked = [...dishes]
    .sort((a, b) => b[metric] - a[metric] || (metric === 'qty' ? b.revenue - a.revenue : b.qty - a.qty))
    .slice(0, TOP_N);
  const totalQty = dishes.reduce((s, d) => s + d.qty, 0);
  const totalRevenue = dishes.reduce((s, d) => s + d.revenue, 0);
  const isRevenue = metric === 'revenue';
  const color = isRevenue ? CHART_COLORS.revenue : CHART_COLORS.count;

  const chartData: ChartData<'bar', number[], string> = {
    labels: ranked.map((d) => d.name),
    datasets: [
      {
        label: isRevenue ? 'Revenue' : 'Quantity sold',
        data: ranked.map((d) => d[metric]),
        backgroundColor: color,
        hoverBackgroundColor: isRevenue ? CHART_COLORS.revenueHover : CHART_COLORS.countHover,
        borderRadius: 4,
        maxBarThickness: 20,
        categoryPercentage: 0.85,
        barPercentage: 0.9,
      },
    ],
  };

  const options: ChartOptions<'bar'> = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 250 },
    plugins: {
      legend: { display: false },
      tooltip: {
        ...TOOLTIP_STYLE,
        callbacks: {
          label: (item) => {
            const d = ranked[item.dataIndex];
            return d ? ` ${count(d.qty)} sold · ${currency(d.revenue)}` : '';
          },
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        grid: { color: CHART_COLORS.grid },
        border: { display: false },
        ticks: {
          maxTicksLimit: 5,
          precision: 0,
          callback: (v) => (isRevenue ? compactCurrency(Number(v)) : count(Number(v))),
        },
      },
      y: {
        grid: { display: false },
        border: { color: CHART_COLORS.axis },
        ticks: { color: '#44403c', autoSkip: false },
      },
    },
  };

  const description =
    ranked.length > 0
      ? `Top ${ranked.length} dishes ${isRevenue ? 'by revenue' : 'by quantity sold'}. ` +
        ranked
          .slice(0, 3)
          .map((d, i) => `${i + 1}. ${d.name}: ${isRevenue ? currency(d.revenue) : `${count(d.qty)} sold`}`)
          .join('; ') +
        '.'
      : 'No dishes sold.';

  return (
    <AnalyticsCard
      title="Top-selling dishes"
      story="US10.2"
      subtitle="Paid orders in the period."
      className={className}
      action={<Segmented label="Rank dishes" value={metric} options={METRICS} onChange={setMetric} />}
    >
      {ranked.length === 0 ? (
        <EmptyState title="No dishes sold in this period" />
      ) : (
        <div className="grid gap-5 2xl:grid-cols-5">
          <div
            className="relative 2xl:col-span-3"
            style={{ height: Math.max(160, ranked.length * 30 + 40) }}
            role="img"
            aria-label={description}
          >
            <Bar data={chartData} options={options} />
          </div>
          <div className="overflow-x-auto 2xl:col-span-2">
            <table className="table-base [&_td]:px-2 [&_td]:py-1.5 [&_th]:px-2">
              <caption className="sr-only">Top {ranked.length} dishes, ranked {isRevenue ? 'by revenue' : 'by quantity'}</caption>
              <thead>
                <tr>
                  <th scope="col" className="w-8">#</th>
                  <th scope="col">Dish</th>
                  <th scope="col" className={`text-right ${!isRevenue ? 'text-stone-800' : ''}`}>Qty</th>
                  <th scope="col" className={`text-right ${isRevenue ? 'text-stone-800' : ''}`}>Revenue</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {ranked.map((d, i) => (
                  <tr key={d.name}>
                    <td className="text-stone-400">{i + 1}</td>
                    <td className="max-w-[12rem] truncate font-medium text-stone-800" title={d.name}>
                      {d.name}
                    </td>
                    <td className={`text-right ${!isRevenue ? 'font-semibold text-stone-900' : 'text-stone-600'}`}>{count(d.qty)}</td>
                    <td className={`text-right ${isRevenue ? 'font-semibold text-stone-900' : 'text-stone-600'}`}>
                      {currency(d.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="text-xs text-stone-500">
                  <td colSpan={2} className="!border-0 pt-2">
                    All {dishes.length} dishes
                  </td>
                  <td className="!border-0 pt-2 text-right">{count(totalQty)}</td>
                  <td className="!border-0 pt-2 text-right">{currency(totalRevenue)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </AnalyticsCard>
  );
}

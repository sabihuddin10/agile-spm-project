'use client';

import dynamic from 'next/dynamic';

/** Card-sized placeholder shown while a chart's code (Chart.js) downloads. */
export function ChartSkeleton({ tall = false }: { tall?: boolean }) {
  return (
    <div className="card animate-pulse p-4 sm:p-5" aria-hidden="true">
      <div className="h-4 w-32 rounded bg-stone-200" />
      <div className="mt-2 h-3 w-48 rounded bg-stone-100" />
      <div className={`mt-4 rounded-lg bg-stone-100 ${tall ? 'h-72' : 'h-44'}`} />
    </div>
  );
}

/*
 * Chart.js is the heaviest dependency on My work and Workforce, and nothing
 * above the fold needs it. Load the chart components on the client only, after
 * the numbers have rendered.
 */
export const LazyWorkCharts = dynamic(() => import('@/components/workforce/work-charts').then((m) => m.WorkCharts), {
  ssr: false,
  loading: () => <ChartSkeleton tall />,
});

export const LazyHoursByRole = dynamic(() => import('@/components/workforce/team-charts').then((m) => m.HoursByRole), {
  ssr: false,
  loading: () => <ChartSkeleton />,
});

export const LazyLatenessTrend = dynamic(
  () => import('@/components/workforce/team-charts').then((m) => m.LatenessTrend),
  { ssr: false, loading: () => <ChartSkeleton /> },
);

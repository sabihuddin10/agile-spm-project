'use client';

import type { ReactNode } from 'react';
import type { StaffAnalytics } from '@/types';
import { PayBreakdownCard } from '@/components/workforce/pay-breakdown';
import { WorkRings } from '@/components/workforce/progress-ring';
import { SessionsTable } from '@/components/workforce/sessions-table';
import { WorkCharts } from '@/components/workforce/work-charts';
import { monthLabel } from '@/components/workforce/workforce-format';

/**
 * Everything about one person's month: progress rings, pay (when visible),
 * hours charts and the sessions table. Used by My work and by the Workforce
 * hub's drill-down. `trend` (a longer range) feeds the week and month charts.
 */
export function StaffWorkView({
  data,
  trend,
  month,
  monthPicker,
  payFooter,
  onRemoveAdjustment,
}: {
  data: StaffAnalytics;
  trend?: StaffAnalytics | null;
  month: string;
  monthPicker?: ReactNode;
  payFooter?: ReactNode;
  onRemoveAdjustment?: (id: string) => void;
}) {
  const series = {
    day: data.series.day,
    week: (trend ?? data).series.week,
    month: (trend ?? data).series.month,
    hour: data.series.hour,
  };

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">{monthLabel(month)}</h2>
      <WorkRings summary={data.summary} data={data} periodLabel={monthLabel(month)} />

      <div className={`grid grid-cols-1 gap-4 ${data.pay ? 'xl:grid-cols-5' : ''}`}>
        {data.pay ? (
          <div className="min-w-0 xl:col-span-2">
            <PayBreakdownCard pay={data.pay} monthPicker={monthPicker} onRemoveAdjustment={onRemoveAdjustment} footer={payFooter} />
          </div>
        ) : null}
        <div className={`min-w-0 ${data.pay ? 'xl:col-span-3' : ''}`}>
          <WorkCharts
            series={series}
            title="Hours breakdown"
            subtitle={`Day and hour of day for ${monthLabel(month)}; week and month cover the last three months.`}
          />
        </div>
      </div>

      <SessionsTable sessions={data.sessions} shifts={data.shifts} />
    </div>
  );
}

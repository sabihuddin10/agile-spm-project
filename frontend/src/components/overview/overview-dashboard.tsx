'use client';

import type { Role, User } from '@/types';
import { formatTime, titleCase } from '@/lib/format';
import { useNow } from '@/hooks/use-polling';
import { Badge } from '@/components/ui/badge';
import { overviewAccess, useOverviewData } from '@/components/overview/use-overview-data';
import { FloorWidgets, KitchenWidgets, TodaySummary } from '@/components/overview/role-widgets';
import { LowStockBanner } from '@/components/overview/low-stock-banner';
import { NextShiftCard } from '@/components/overview/next-shift-card';
import { QuickLinks } from '@/components/overview/quick-links';

const ROLE_INTRO: Record<Exclude<Role, 'customer'>, { tone: 'emerald' | 'amber' | 'blue' | 'brand'; desc: string }> = {
  waiter: { tone: 'emerald', desc: 'Floor operations — confirm and serve orders, look after your tables and settle bills.' },
  chef: { tone: 'amber', desc: 'Kitchen — work the cooking queue, call dishes ready for pickup and keep stock accurate.' },
  manager: { tone: 'blue', desc: 'Operations oversight — service, sales, stock and the team across the restaurant.' },
  admin: { tone: 'brand', desc: 'System administration — every module, staff accounts, roles and settings.' },
};

function greeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Role-tailored live staff overview: floor, kitchen and today's numbers by
 * role, the low-stock alert (US8.4), the user's next shift and quick links to
 * every section their role can open. Refreshes every 10 s.
 */
export function OverviewDashboard({ user }: { user: User }) {
  const { data, loaded, updatedAt } = useOverviewData(user);
  const now = useNow(15_000);
  const access = overviewAccess(user.role);
  const intro = ROLE_INTRO[user.role as Exclude<Role, 'customer'>] ?? ROLE_INTRO.waiter;
  const loading = !loaded;
  const firstName = user.name.split(' ')[0] || user.name;

  return (
    <div className="space-y-4 sm:space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-stone-900">
              {greeting(new Date(now).getHours())}, {firstName}
            </h1>
            <Badge tone={intro.tone}>{titleCase(user.role)}</Badge>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-stone-500">{intro.desc}</p>
        </div>
        <p className="flex items-center gap-2 text-xs text-stone-500">
          <span className="relative flex h-2 w-2" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:animate-none" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          {updatedAt ? `Live · updated ${formatTime(new Date(updatedAt).toISOString())}` : 'Connecting…'}
        </p>
      </header>

      {access.inventory && data.inventory ? <LowStockBanner items={data.inventory} /> : null}

      {access.summary ? <TodaySummary summary={data.summary} loading={loading} /> : null}

      {access.floor || access.kitchen ? (
        <div className={`grid gap-4 sm:gap-6 ${access.floor && access.kitchen ? '2xl:grid-cols-2' : ''}`}>
          {access.floor ? (
            <FloorWidgets user={user} placed={data.placed} ready={data.ready} tables={data.tables} loading={loading} now={now} />
          ) : null}
          {access.kitchen ? <KitchenWidgets kitchen={data.kitchen} loading={loading} now={now} /> : null}
        </div>
      ) : null}

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        <NextShiftCard shifts={data.shifts} loading={loading} now={now} />
        <div className="lg:col-span-2">
          <QuickLinks role={user.role} />
        </div>
      </div>
    </div>
  );
}

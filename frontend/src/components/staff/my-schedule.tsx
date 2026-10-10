'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { Shift } from '@/types';
import { staffApi } from '@/lib/api';
import { can } from '@/lib/permissions';
import { SHIFT_STATUS, addDaysISO, errorMessage, formatDate, formatMinutes, localDateISO } from '@/lib/format';
import { useAuth } from '@/context/auth-context';
import { useNow, usePolling } from '@/hooks/use-polling';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/toast';
import { formatHours, mondayOf, parseISODate, timeToMinutes } from '@/components/staff/role-meta';

const pad = (n: number) => String(n).padStart(2, '0');

function dayDiff(from: string, to: string): number {
  return Math.round((parseISODate(to).getTime() - parseISODate(from).getTime()) / 86400000);
}

function relativeDay(date: string, today: string): string {
  const diff = dayDiff(today, date);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return diff > 0 ? `In ${diff} days` : `${-diff} days ago`;
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-stone-800">{value}</p>
      {sub ? <p className="text-xs text-stone-500">{sub}</p> : null}
    </div>
  );
}

/**
 * The signed-in staff member's own rota (US9.3 — a scheduled shift "appears on
 * that staff member's schedule view"): next-shift callout, upcoming shifts
 * grouped by day, recent shifts with their status and this week's hours.
 */
export function MySchedule() {
  const { user } = useAuth();
  const toast = useToast();
  const now = useNow(60000);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { shifts: list } = await staffApi.myShifts();
      setShifts(list);
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);
  usePolling(load, 60000);

  const nowDate = new Date(now);
  const today = localDateISO(nowDate);
  const nowTime = `${pad(nowDate.getHours())}:${pad(nowDate.getMinutes())}`;

  const { upcoming, past, groups } = useMemo(() => {
    const isOver = (s: Shift) => s.date < today || (s.date === today && s.end <= nowTime);
    const up = shifts.filter((s) => !isOver(s));
    const done = shifts.filter(isOver).reverse();
    const byDate = new Map<string, Shift[]>();
    for (const s of up) byDate.set(s.date, [...(byDate.get(s.date) ?? []), s]);
    return { upcoming: up, past: done, groups: Array.from(byDate.entries()) };
  }, [shifts, today, nowTime]);

  const weekFrom = localDateISO(mondayOf(nowDate));
  const weekTo = addDaysISO(6, parseISODate(weekFrom));
  const thisWeek = shifts.filter((s) => s.date >= weekFrom && s.date <= weekTo && s.status !== 'missed');
  const weekHours = thisWeek.reduce((sum, s) => sum + s.hours, 0);
  const upcomingHours = upcoming.reduce((sum, s) => sum + s.hours, 0);
  const completed = past.filter((s) => s.status === 'completed').length;

  const next = upcoming[0];
  const nowMinutes = timeToMinutes(nowTime);
  const onShiftNow = Boolean(next && next.date === today && next.start <= nowTime);

  let nextDetail = '';
  if (next) {
    if (onShiftNow) nextDetail = `On shift now · finishes in ${formatMinutes(timeToMinutes(next.end) - nowMinutes)}`;
    else if (next.date === today) nextDetail = `Starts in ${formatMinutes(timeToMinutes(next.start) - nowMinutes)}`;
    else nextDetail = relativeDay(next.date, today);
  }

  return (
    <>
      <PageHeader
        title="My schedule"
        subtitle={`Your shifts from last week to two weeks ahead${user ? `, ${user.name.split(' ')[0]}` : ''}. New shifts from your manager appear here automatically.`}
        action={
          can.scheduleShifts(user?.role) ? (
            <Link href="/staff/users#shifts" className="btn-secondary">
              Manage team rota
            </Link>
          ) : undefined
        }
      />

      {loading ? (
        <Card>
          <Spinner label="Loading your shifts…" />
        </Card>
      ) : (
        <div className="space-y-6">
          {next ? (
            <div
              className={`rounded-xl border p-5 shadow-sm ${
                onShiftNow ? 'border-emerald-300 bg-emerald-50' : 'border-brand-200 bg-brand-50'
              }`}
            >
              <p className={`text-xs font-semibold uppercase tracking-wide ${onShiftNow ? 'text-emerald-700' : 'text-brand-700'}`}>
                {onShiftNow ? 'Current shift' : 'Next shift'}
              </p>
              <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <p className="text-2xl font-bold text-stone-900">
                  {next.start}–{next.end}
                </p>
                <p className="text-lg font-medium text-stone-700">{formatDate(next.date)}</p>
                <p className="text-sm text-stone-500">{formatHours(next.hours)}</p>
              </div>
              <p className={`mt-1 text-sm font-medium ${onShiftNow ? 'text-emerald-800' : 'text-brand-800'}`}>{nextDetail}</p>
              {next.notes ? <p className="mt-2 text-sm text-stone-600">Note: {next.notes}</p> : null}
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="This week"
              value={formatHours(weekHours)}
              sub={`${thisWeek.length} shift${thisWeek.length === 1 ? '' : 's'} scheduled, Mon–Sun`}
            />
            <Stat label="Upcoming" value={String(upcoming.length)} sub={`${formatHours(upcomingHours)} in the next 2 weeks`} />
            <Stat label="Completed" value={String(completed)} sub="in the last 7 days" />
            <Stat
              label="Missed"
              value={String(past.filter((s) => s.status === 'missed').length)}
              sub="in the last 7 days"
            />
          </div>

          <section aria-labelledby="upcoming-heading">
            <h2 id="upcoming-heading" className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">
              Upcoming
            </h2>
            {groups.length === 0 ? (
              <Card>
                <EmptyState
                  title="No upcoming shifts"
                  hint="You're not on the rota for the next two weeks yet. Your manager's new shifts will show up here."
                />
              </Card>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {groups.map(([date, list]) => {
                  const isToday = date === today;
                  return (
                    <Card key={date} className={`p-4 ${isToday ? 'border-brand-300 ring-1 ring-brand-200' : ''}`}>
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="font-semibold text-stone-800">{formatDate(date)}</p>
                        <Badge tone={isToday ? 'brand' : 'stone'}>{relativeDay(date, today)}</Badge>
                      </div>
                      <ul className="divide-y divide-stone-100">
                        {list.map((s) => (
                          <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                            <span className="font-medium tabular-nums text-stone-900">
                              {s.start}–{s.end}
                            </span>
                            <span className="text-sm text-stone-500">{formatHours(s.hours)}</span>
                            <Badge tone={SHIFT_STATUS[s.status].tone} className="ml-auto">
                              {SHIFT_STATUS[s.status].label}
                            </Badge>
                            {s.notes ? <p className="w-full text-sm text-stone-600">{s.notes}</p> : null}
                          </li>
                        ))}
                      </ul>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          <section aria-labelledby="past-heading">
            <h2 id="past-heading" className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">
              Recent shifts
            </h2>
            <Card className="p-0">
              {past.length === 0 ? (
                <EmptyState title="No shifts in the last week" />
              ) : (
                <ul className="divide-y divide-stone-100">
                  {past.map((s) => (
                    <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                      <span className="w-28 font-medium text-stone-800">{formatDate(s.date)}</span>
                      <span className="tabular-nums text-stone-700">
                        {s.start}–{s.end}
                      </span>
                      <span className="text-sm text-stone-500">{formatHours(s.hours)}</span>
                      <Badge tone={SHIFT_STATUS[s.status].tone} className="ml-auto">
                        {s.status === 'scheduled' ? 'Awaiting sign-off' : SHIFT_STATUS[s.status].label}
                      </Badge>
                      {s.notes ? <p className="w-full text-sm text-stone-500">{s.notes}</p> : null}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </section>
        </div>
      )}
    </>
  );
}

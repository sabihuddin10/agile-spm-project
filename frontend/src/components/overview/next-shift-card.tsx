import Link from 'next/link';
import type { Shift } from '@/types';
import { formatDate, formatMinutes, localDateISO } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

const pad = (n: number) => String(n).padStart(2, '0');

function dayDiff(from: string, to: string): number {
  const [y1, m1, d1] = from.split('-').map(Number);
  const [y2, m2, d2] = to.split('-').map(Number);
  return Math.round((new Date(y2, m2 - 1, d2).getTime() - new Date(y1, m1 - 1, d1).getTime()) / 86_400_000);
}

function minutesUntil(time: string, now: Date): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m - (now.getHours() * 60 + now.getMinutes());
}

/**
 * "My next shift" (US9.3) — the signed-in staff member's first upcoming
 * scheduled shift, or the one in progress, linking to their schedule.
 */
export function NextShiftCard({ shifts, loading, now }: { shifts: Shift[] | null; loading: boolean; now: number }) {
  const date = new Date(now);
  const today = localDateISO(date);
  const hm = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  const upcoming = (shifts ?? [])
    .filter((s) => s.status === 'scheduled' && (s.date > today || (s.date === today && s.end > hm)))
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  const next = upcoming[0] ?? null;

  let when = '';
  let status: { tone: 'emerald' | 'blue' | 'stone'; label: string } | null = null;
  if (next) {
    const days = dayDiff(today, next.date);
    when = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : formatDate(next.date);
    if (days === 0 && next.start <= hm) status = { tone: 'emerald', label: 'On shift now' };
    else if (days === 0) {
      const mins = minutesUntil(next.start, date);
      status = { tone: 'blue', label: `Starts in ${formatMinutes(mins)}` };
    } else if (days > 1) status = { tone: 'stone', label: `In ${days} days` };
  }

  return (
    <Card className="flex flex-col">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-stone-900">My next shift</h2>
        <Link href="/staff/schedule" className="text-sm font-medium text-brand-700 hover:text-brand-800 hover:underline">
          Schedule →
        </Link>
      </div>

      {loading && !shifts ? (
        <div className="mt-4 space-y-2" aria-label="Loading shifts">
          <div className="h-6 w-32 animate-pulse rounded bg-stone-100 motion-reduce:animate-none" />
          <div className="h-4 w-48 animate-pulse rounded bg-stone-100 motion-reduce:animate-none" />
        </div>
      ) : !shifts ? (
        <p className="mt-4 text-sm text-stone-500">Your schedule couldn&apos;t be loaded.</p>
      ) : next ? (
        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-2xl font-semibold text-stone-900">{when}</p>
            {status ? <Badge tone={status.tone}>{status.label}</Badge> : null}
          </div>
          <p className="mt-1 text-sm text-stone-700">
            <span className="font-medium tabular-nums">
              {next.start}–{next.end}
            </span>
            <span className="text-stone-400"> · </span>
            {next.hours} h{when !== formatDate(next.date) ? <span className="text-stone-500"> · {formatDate(next.date)}</span> : null}
          </p>
          {next.notes ? <p className="mt-2 rounded-lg bg-stone-50 px-3 py-2 text-sm text-stone-600">{next.notes}</p> : null}
          {upcoming.length > 1 ? (
            <p className="mt-3 text-xs text-stone-500">
              {upcoming.length - 1} more shift{upcoming.length - 1 === 1 ? '' : 's'} scheduled in the next 30 days.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-4 text-sm text-stone-500">No shifts scheduled in the next 30 days.</p>
      )}
    </Card>
  );
}

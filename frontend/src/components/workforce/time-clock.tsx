'use client';

import type { AttendanceSettings, MyStatus } from '@/types';
import { DEFAULT_ATTENDANCE_SETTINGS } from '@/lib/workforce-mock';
import { useNow } from '@/hooks/use-polling';
import { Badge } from '@/components/ui/badge';
import { STATE_META, clockTime, elapsedSpoken, elapsedText, hoursText } from '@/components/workforce/workforce-format';

export type ClockAction = 'clock-in' | 'break-start' | 'break-end' | 'clock-out';

const ACTIONS: Record<MyStatus['state'], { action: ClockAction; label: string; primary: boolean }[]> = {
  off: [{ action: 'clock-in', label: 'Check in', primary: true }],
  working: [
    { action: 'break-start', label: 'Start break', primary: false },
    { action: 'clock-out', label: 'Check out', primary: true },
  ],
  on_break: [{ action: 'break-end', label: 'End break', primary: true }],
};

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Daily time clock: current state with a live timer, today's shift and only the
 * buttons valid right now (Check in → Start/End break → Check out). State
 * changes are announced politely to screen readers.
 */
export function TimeClock({
  status,
  onAction,
  busy = false,
  settings = DEFAULT_ATTENDANCE_SETTINGS,
}: {
  status: MyStatus;
  onAction: (action: ClockAction) => void;
  busy?: boolean;
  settings?: AttendanceSettings;
}) {
  const { lateGraceMinutes } = settings;
  const now = useNow(1000);
  const meta = STATE_META[status.state];
  const sinceMs = status.since ? now - new Date(status.since).getTime() : 0;
  const nowDate = new Date(now);
  const nowMin = nowDate.getHours() * 60 + nowDate.getMinutes();
  const shift = status.todayShift;
  const session = status.session;

  const minutesPastStart = shift ? nowMin - toMin(shift.start) : 0;
  const wouldBeLate =
    status.state === 'off' && shift && !session?.clockOut && minutesPastStart > lateGraceMinutes && nowMin < toMin(shift.end);
  const shiftOver = status.state === 'off' && session?.clockOut;

  let headline: string;
  if (status.state === 'working') headline = `Checked in since ${clockTime(status.since)}`;
  else if (status.state === 'on_break') headline = `On break since ${clockTime(status.since)}`;
  else if (shiftOver) headline = `Checked out at ${clockTime(session?.clockOut)}`;
  else headline = 'Not checked in';

  const announcement =
    status.state === 'off' ? `${headline}.` : `${headline}. ${meta.label} for ${elapsedSpoken(sinceMs)}.`;

  return (
    <section className="card" aria-labelledby="time-clock-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="time-clock-heading" className="text-lg font-semibold">
            Time clock
          </h2>
          <p className="mt-0.5 text-sm text-stone-500">
            {shift ? (
              <>
                Today&apos;s shift <span className="font-medium tabular-nums text-stone-700">{shift.start}–{shift.end}</span>
              </>
            ) : (
              'No shift scheduled today'
            )}
          </p>
        </div>
        <Badge tone={meta.tone}>
          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} aria-hidden="true" />
          {meta.label}
        </Badge>
      </div>

      <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-stone-600" aria-live="polite" aria-atomic="true">
            <span className="sr-only">{announcement}</span>
            <span aria-hidden="true">{headline}</span>
          </p>
          {status.state !== 'off' ? (
            <p className="mt-1 font-mono text-4xl font-semibold tabular-nums text-stone-900" aria-hidden="true">
              {elapsedText(sinceMs)}
            </p>
          ) : session ? (
            <p className="mt-1 text-2xl font-semibold text-stone-900">{hoursText(session.paidMinutes)} paid today</p>
          ) : null}
          {session && status.state !== 'off' ? (
            <p className="mt-1 text-sm text-stone-500">
              {hoursText(session.paidMinutes)} paid so far today
              {session.breaks.length ? ` · ${session.breaks.length} break${session.breaks.length === 1 ? '' : 's'}` : ''}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          {ACTIONS[status.state].map((a) => (
            <button
              key={a.action}
              type="button"
              className={`${a.primary ? 'btn-primary' : 'btn-secondary'} min-h-[48px] px-6 text-base`}
              onClick={() => onAction(a.action)}
              disabled={busy}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {wouldBeLate ? (
        <p role="alert" className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Your shift started at {shift?.start}. Checking in now will be marked late ({minutesPastStart} min) and a late
          deduction applies.
        </p>
      ) : null}
      {session?.late && status.state !== 'off' ? (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Checked in {session.lateMinutes} min after your shift start — marked late.
        </p>
      ) : null}

      <p className="mt-4 text-xs text-stone-500">
        Breaks are unpaid. A session longer than {settings.autoBreakAfterHours} h with no break recorded has an unpaid{' '}
        {settings.autoBreakMinutes}-min break deducted automatically.
      </p>
    </section>
  );
}

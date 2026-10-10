'use client';

import { useState } from 'react';
import type { AttendanceSession, WorkShift } from '@/types';
import { formatDate } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { clockTime, hoursText, missedMinutes, shiftMinutes } from '@/components/workforce/workforce-format';

type Row =
  | { kind: 'session'; key: string; date: string; sort: string; shift: WorkShift | null; session: AttendanceSession }
  | { kind: 'missed'; key: string; date: string; sort: string; shift: WorkShift };

function breakMinutes(b: { start: string; end: string | null }): number {
  return Math.max(0, Math.floor((new Date(b.end ?? Date.now()).getTime() - new Date(b.start).getTime()) / 60000));
}

function Breaks({ session }: { session: AttendanceSession }) {
  if (session.autoBreakMinutes) {
    return (
      <span className="inline-flex flex-wrap items-center gap-1">
        <Badge tone="stone">Auto</Badge>
        <span className="text-stone-600">{session.autoBreakMinutes} min, none recorded</span>
      </span>
    );
  }
  if (session.breaks.length === 0) return <span className="text-stone-500">None</span>;
  return (
    <span className="text-stone-600">
      {session.breaks
        .map((b) => `${clockTime(b.start)}–${b.end ? clockTime(b.end) : 'now'} (${breakMinutes(b)} min)`)
        .join(', ')}
    </span>
  );
}

function Late({ session }: { session: AttendanceSession }) {
  return session.late ? <Badge tone="red">{session.lateMinutes} min late</Badge> : <span className="text-stone-500">On time</span>;
}

/**
 * Sessions (and missed shifts) newest first: date, shift, check-in/out, breaks
 * with automatic breaks flagged, lateness and paid hours. Table on wider
 * screens, stacked rows on phones; "Show more" pages through older rows.
 */
export function SessionsTable({
  sessions,
  shifts,
  pageSize = 10,
}: {
  sessions: AttendanceSession[];
  shifts: WorkShift[];
  pageSize?: number;
}) {
  const [shown, setShown] = useState(pageSize);
  const shiftById = new Map(shifts.map((s) => [s.id, s]));
  const rows: Row[] = [
    ...sessions.map<Row>((s) => ({
      kind: 'session',
      key: s.id,
      date: s.date,
      sort: s.clockIn,
      shift: s.shiftId ? (shiftById.get(s.shiftId) ?? null) : null,
      session: s,
    })),
    ...shifts
      .filter((s) => s.status === 'missed')
      .map<Row>((s) => ({ kind: 'missed', key: s.id, date: s.date, sort: `${s.date}T${s.start}`, shift: s })),
  ].sort((a, b) => b.sort.localeCompare(a.sort));
  const visible = rows.slice(0, shown);
  const missed = missedMinutes(shifts);

  return (
    <section className="card !p-0" aria-labelledby="sessions-heading">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 pb-3 pt-4 sm:px-5 sm:pt-5">
        <div>
          <h2 id="sessions-heading" className="text-lg font-semibold">
            Sessions &amp; shifts
          </h2>
          <p className="mt-0.5 text-sm text-stone-500">
            {rows.length} record{rows.length === 1 ? '' : 's'}
            {missed ? ` · ${hoursText(missed)} missed (unpaid)` : ''}
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No sessions yet" hint="Check-ins and missed shifts will appear here." />
      ) : (
        <>
          <div className="hidden overflow-x-auto sm:block">
            <table className="table-base">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Shift</th>
                  <th scope="col">In – out</th>
                  <th scope="col">Breaks</th>
                  <th scope="col">Late</th>
                  <th scope="col" className="text-right">Paid</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {visible.map((r) =>
                  r.kind === 'missed' ? (
                    <tr key={r.key} className="bg-red-50/40">
                      <td className="whitespace-nowrap font-medium text-stone-800">{formatDate(r.date)}</td>
                      <td className="whitespace-nowrap">
                        {r.shift.start}–{r.shift.end}
                      </td>
                      <td colSpan={3}>
                        <Badge tone="red">Missed</Badge>
                        <span className="ml-2 text-stone-600">{hoursText(shiftMinutes(r.shift))} not worked (unpaid)</span>
                      </td>
                      <td className="text-right tabular-nums text-stone-500">0 h</td>
                    </tr>
                  ) : (
                    <tr key={r.key}>
                      <td className="whitespace-nowrap font-medium text-stone-800">{formatDate(r.date)}</td>
                      <td className="whitespace-nowrap">{r.shift ? `${r.shift.start}–${r.shift.end}` : <span className="text-stone-500">Unscheduled</span>}</td>
                      <td className="whitespace-nowrap">
                        {clockTime(r.session.clockIn)} – {r.session.clockOut ? clockTime(r.session.clockOut) : <Badge tone="emerald">Open</Badge>}
                      </td>
                      <td className="text-sm">
                        <Breaks session={r.session} />
                      </td>
                      <td className="whitespace-nowrap">
                        <Late session={r.session} />
                      </td>
                      <td className="text-right font-medium">{hoursText(r.session.paidMinutes)}</td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>

          <ul className="divide-y divide-stone-100 border-t border-stone-100 sm:hidden">
            {visible.map((r) => (
              <li key={r.key} className="space-y-1 px-4 py-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-stone-800">{formatDate(r.date)}</p>
                  <p className="font-semibold tabular-nums">{r.kind === 'missed' ? '0 h' : hoursText(r.session.paidMinutes)}</p>
                </div>
                <p className="tabular-nums text-stone-600">
                  Shift {r.shift ? `${r.shift.start}–${r.shift.end}` : 'unscheduled'}
                  {r.kind === 'session'
                    ? ` · ${clockTime(r.session.clockIn)} – ${r.session.clockOut ? clockTime(r.session.clockOut) : 'open'}`
                    : ''}
                </p>
                {r.kind === 'missed' ? (
                  <p>
                    <Badge tone="red">Missed</Badge>
                    <span className="ml-2 text-stone-600">{hoursText(shiftMinutes(r.shift))} not worked (unpaid)</span>
                  </p>
                ) : (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Late session={r.session} />
                    <span className="text-xs">
                      Breaks: <Breaks session={r.session} />
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ul>

          {rows.length > shown ? (
            <div className="border-t border-stone-100 px-4 py-3 sm:px-5">
              <button type="button" className="btn-secondary w-full sm:w-auto" onClick={() => setShown((n) => n + pageSize)}>
                Show more ({rows.length - shown} older)
              </button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

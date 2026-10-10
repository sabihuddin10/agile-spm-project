'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Role, Shift, User } from '@/types';
import { staffApi } from '@/lib/api';
import { SHIFT_STATUS, addDaysISO, errorMessage, formatDate, localDateISO } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/toast';
import { ShiftForm } from '@/components/staff/shift-form';
import { ROLE_META, formatHours, mondayOf, parseISODate, roleRank } from '@/components/staff/role-meta';

interface Row {
  id: string;
  name: string;
  role: Role | null;
  active: boolean;
}

type FormState = { shift?: Shift; userId?: string; date?: string } | null;

const shortDate = (date: string, withYear = false) =>
  parseISODate(date).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(withYear ? { year: 'numeric' } : {}),
  });

function ShiftChip({ shift, onClick, showName = false }: { shift: Shift; onClick: () => void; showName?: boolean }) {
  const status = SHIFT_STATUS[shift.status];
  return (
    <button
      type="button"
      onClick={onClick}
      title={shift.notes || undefined}
      aria-label={`Edit ${shift.userName}'s shift ${shift.start} to ${shift.end}, ${status.label}`}
      className="block w-full rounded-full text-left focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1"
    >
      <Badge tone={status.tone} className="w-full justify-center whitespace-nowrap">
        {showName ? `${shift.userName} · ` : ''}
        {shift.start}–{shift.end}
        {shift.notes ? <span aria-hidden="true">•</span> : null}
      </Badge>
    </button>
  );
}

/**
 * Weekly rota (US9.3): Mon–Sun grid of shifts per staff member with week
 * navigation; managers add, reschedule, mark completed/missed or delete shifts.
 */
export function ShiftPlanner({ roster }: { roster: User[] }) {
  const toast = useToast();
  const [weekStart, setWeekStart] = useState(() => localDateISO(mondayOf()));
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(null);
  const requestId = useRef(0);

  const today = localDateISO();
  const thisWeek = localDateISO(mondayOf());
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysISO(i, parseISODate(weekStart))), [weekStart]);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const res = await staffApi.shifts({ from: days[0], to: days[6] });
      if (id === requestId.current) setShifts(res.shifts);
    } catch (err) {
      if (id === requestId.current) toast(errorMessage(err), 'error');
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [days, toast]);

  useEffect(() => {
    load();
  }, [load]);

  // Rows: every active staff member, plus anyone who still has shifts this week
  // (suspended, re-roled or removed accounts).
  const rows = useMemo<Row[]>(() => {
    const map = new Map<string, Row>();
    for (const u of roster) if (u.active) map.set(u.id, { id: u.id, name: u.name, role: u.role, active: true });
    for (const s of shifts) {
      if (map.has(s.userId)) continue;
      const u = roster.find((x) => x.id === s.userId);
      map.set(s.userId, { id: s.userId, name: s.userName, role: s.role, active: Boolean(u?.active) });
    }
    return Array.from(map.values()).sort((a, b) => roleRank(a.role) - roleRank(b.role) || a.name.localeCompare(b.name));
  }, [roster, shifts]);

  const byCell = useMemo(() => {
    const map = new Map<string, Shift[]>();
    for (const s of shifts) {
      const key = `${s.userId}|${s.date}`;
      map.set(key, [...(map.get(key) ?? []), s]);
    }
    return map;
  }, [shifts]);

  const hoursFor = (userId: string) =>
    shifts.filter((s) => s.userId === userId && s.status !== 'missed').reduce((sum, s) => sum + s.hours, 0);
  const dayShifts = (day: string) => shifts.filter((s) => s.date === day);
  const totalHours = shifts.filter((s) => s.status !== 'missed').reduce((sum, s) => sum + s.hours, 0);

  const shiftWeek = (weeks: number) => setWeekStart((w) => addDaysISO(weeks * 7, parseISODate(w)));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <button type="button" className="btn-secondary h-9 w-9 shrink-0 p-0 lg:h-9 lg:min-h-[36px] lg:px-0" onClick={() => shiftWeek(-1)} aria-label="Previous week">
            ‹
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setWeekStart(thisWeek)}
            disabled={weekStart === thisWeek}
          >
            This week
          </button>
          <button type="button" className="btn-secondary h-9 w-9 shrink-0 p-0 lg:h-9 lg:min-h-[36px] lg:px-0" onClick={() => shiftWeek(1)} aria-label="Next week">
            ›
          </button>
        </div>
        <p className="font-semibold text-stone-800" aria-live="polite">
          {shortDate(days[0])} – {shortDate(days[6], true)}
        </p>
        <p className="text-sm text-stone-500">
          · {shifts.length} shift{shifts.length === 1 ? '' : 's'}, {formatHours(totalHours)}
        </p>
        <button type="button" className="btn-primary ml-auto" onClick={() => setForm({ date: days.includes(today) ? today : days[0] })}>
          + Add shift
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
        {Object.values(SHIFT_STATUS).map((s) => (
          <Badge key={s.label} tone={s.tone}>
            {s.label}
          </Badge>
        ))}
        <span>Click a shift to edit it or mark it completed / missed. • = has notes.</span>
      </div>

      {loading && shifts.length === 0 ? (
        <Card>
          <Spinner label="Loading rota…" />
        </Card>
      ) : (
        <>
          {/* Desktop / tablet: staff × day grid */}
          <Card className={`hidden overflow-hidden p-0 md:block ${loading ? 'opacity-60' : ''}`}>
            <div className="overflow-x-auto">
              <table className="table-base min-w-[880px] table-fixed">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 w-44 bg-white">Staff</th>
                    {days.map((day) => (
                      <th key={day} className={`text-center ${day === today ? 'bg-brand-50 text-brand-700' : ''}`}>
                        {formatDate(day)}
                      </th>
                    ))}
                    <th className="w-16 text-right">Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td className="sticky left-0 z-10 bg-white">
                        <p className={`truncate font-medium ${row.active ? 'text-stone-800' : 'text-stone-500'}`}>{row.name}</p>
                        <p className="text-xs text-stone-500">
                          {row.role ? ROLE_META[row.role].label : 'Former staff'}
                          {!row.active ? ' · inactive' : ''}
                        </p>
                      </td>
                      {days.map((day) => {
                        const cell = byCell.get(`${row.id}|${day}`) ?? [];
                        return (
                          <td key={day} className={`group !px-2 align-top ${day === today ? 'bg-brand-50/40' : ''}`}>
                            <div className="space-y-1">
                              {cell.map((s) => (
                                <ShiftChip key={s.id} shift={s} onClick={() => setForm({ shift: s })} />
                              ))}
                              {row.active ? (
                                <button
                                  type="button"
                                  onClick={() => setForm({ userId: row.id, date: day })}
                                  aria-label={`Add shift for ${row.name} on ${formatDate(day)}`}
                                  className="flex h-6 w-full items-center justify-center rounded-md text-stone-400 opacity-0 transition hover:bg-stone-100 hover:text-stone-600 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-brand-500 group-hover:opacity-100"
                                >
                                  +
                                </button>
                              ) : null}
                            </div>
                          </td>
                        );
                      })}
                      <td className="text-right font-medium tabular-nums text-stone-700">{formatHours(hoursFor(row.id))}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-stone-50 text-xs text-stone-500">
                    <td className="sticky left-0 z-10 bg-stone-50 font-semibold uppercase tracking-wide">On shift</td>
                    {days.map((day) => {
                      const list = dayShifts(day);
                      return (
                        <td key={day} className="text-center">
                          {list.length ? `${new Set(list.map((s) => s.userId)).size} staff` : '—'}
                        </td>
                      );
                    })}
                    <td className="text-right font-semibold tabular-nums">{formatHours(totalHours)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          {/* Mobile: one card per day */}
          <div className={`space-y-3 md:hidden ${loading ? 'opacity-60' : ''}`}>
            {days.map((day) => {
              const list = dayShifts(day);
              return (
                <Card key={day} className={`p-3.5 sm:p-4 ${day === today ? 'border-brand-300 ring-1 ring-brand-200' : ''}`}>
                  <div className="mb-1.5 flex items-center justify-between gap-2 sm:mb-2">
                    <p className="text-sm font-semibold text-stone-800 sm:text-base">
                      {formatDate(day)}
                      {day === today ? <Badge tone="brand" className="ml-2">Today</Badge> : null}
                    </p>
                    <button
                      type="button"
                      className="btn-sm btn-ghost"
                      onClick={() => setForm({ date: day })}
                      aria-label={`Add shift on ${formatDate(day)}`}
                    >
                      + Add
                    </button>
                  </div>
                  {list.length === 0 ? (
                    <p className="text-sm text-stone-500">No shifts</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {list.map((s) => (
                        <li key={s.id}>
                          <ShiftChip shift={s} onClick={() => setForm({ shift: s })} showName />
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}

      {form ? (
        <ShiftForm
          shift={form.shift}
          roster={roster}
          defaults={{ userId: form.userId, date: form.date }}
          onClose={() => setForm(null)}
          onSaved={load}
        />
      ) : null}
    </div>
  );
}

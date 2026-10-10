import type { AttendanceState, PresenceEntry } from '@/types';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { ROLE_META } from '@/components/staff/role-meta';
import { STATE_META, clockTime } from '@/components/workforce/workforce-format';

const ORDER: AttendanceState[] = ['working', 'on_break', 'off'];

function sinceText(p: PresenceEntry): string {
  if (!p.since) return p.state === 'off' ? 'Not in yet' : '';
  if (p.state === 'off') return `Left at ${clockTime(p.since)}`;
  return `since ${clockTime(p.since)}`;
}

function Person({ p, isSelf }: { p: PresenceEntry; isSelf: boolean }) {
  const meta = STATE_META[p.state];
  return (
    <li className="flex items-start gap-3 py-2.5">
      <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${meta.dot}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 sm:gap-x-2">
          <span className="text-sm font-medium text-stone-900 sm:text-base">{p.name}</span>
          {isSelf ? <span className="text-xs text-stone-500">(you)</span> : null}
          <Badge tone={ROLE_META[p.role].tone}>{ROLE_META[p.role].label}</Badge>
        </p>
        <p className="text-xs text-stone-600 sm:text-sm">
          <span className="font-medium">{meta.label}</span>
          {sinceText(p) ? <span> · {sinceText(p)}</span> : null}
        </p>
        <p className="text-xs tabular-nums text-stone-500">
          {p.todayShift ? `Shift today ${p.todayShift.start}–${p.todayShift.end}` : 'No shift today'}
        </p>
      </div>
    </li>
  );
}

/**
 * Who is in right now — working, on a break or off — with since-times and
 * today's shift. `board` lays the three states out side by side on wide screens.
 */
export function PresenceList({
  people,
  selfId,
  title = 'Colleagues now',
  subtitle,
  variant = 'list',
}: {
  people: PresenceEntry[];
  selfId?: string;
  title?: string;
  subtitle?: string;
  variant?: 'list' | 'board';
}) {
  const groups = ORDER.map((state) => ({ state, list: people.filter((p) => p.state === state).sort((a, b) => a.name.localeCompare(b.name)) }));
  const counts = groups.map((g) => `${g.list.length} ${STATE_META[g.state].label.toLowerCase()}`).join(' · ');

  return (
    <section className="card p-3.5 sm:p-5" aria-labelledby={`presence-${variant}-heading`}>
      <div className="mb-2">
        <h2 id={`presence-${variant}-heading`} className="text-base font-semibold sm:text-lg">
          {title}
        </h2>
        <p className="mt-0.5 text-sm text-stone-500">{subtitle ?? counts}</p>
      </div>
      {people.length === 0 ? (
        <EmptyState title="Nobody to show" />
      ) : variant === 'board' ? (
        <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-3">
          {groups.map((g) => (
            <div key={g.state} className="min-w-0">
              <h3 className="flex items-center gap-2 border-b border-stone-200 pb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">
                <span className={`h-2 w-2 rounded-full ${STATE_META[g.state].dot}`} aria-hidden="true" />
                {STATE_META[g.state].label} ({g.list.length})
              </h3>
              {g.list.length ? (
                <ul className="divide-y divide-stone-100" aria-label={STATE_META[g.state].label}>
                  {g.list.map((p) => (
                    <Person key={p.userId} p={p} isSelf={p.userId === selfId} />
                  ))}
                </ul>
              ) : (
                <p className="py-3 text-sm text-stone-500">Nobody</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <ul className="divide-y divide-stone-100">
          {groups.flatMap((g) => g.list).map((p) => (
            <Person key={p.userId} p={p} isSelf={p.userId === selfId} />
          ))}
        </ul>
      )}
    </section>
  );
}

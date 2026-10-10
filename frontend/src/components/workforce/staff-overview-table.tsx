import type { WorkforceOverview, WorkforceOverviewRow } from '@/types';
import { money } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { ROLE_META } from '@/components/staff/role-meta';
import { ProgressRing, ringSpecs } from '@/components/workforce/progress-ring';
import { STATE_META, hoursText } from '@/components/workforce/workforce-format';

function MiniRings({ row }: { row: WorkforceOverviewRow }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {ringSpecs(row.summary).map((s) => (
        <ProgressRing key={s.key} value={s.value} max={s.max} size={30} stroke={4} tone={s.tone} ariaLabel={`${row.user.name} — ${s.ariaLabel}`} />
      ))}
    </span>
  );
}

function State({ row }: { row: WorkforceOverviewRow }) {
  const meta = STATE_META[row.state];
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-stone-700">
      <span className={`h-2 w-2 rounded-full ${meta.dot}`} aria-hidden="true" />
      {meta.label}
    </span>
  );
}

/**
 * One row per person: live state, mini progress rings, hours and lateness;
 * admins also see wage, tips, bonuses and net pay. Totals row at the bottom.
 * Selecting a name opens that person's drill-down.
 */
export function StaffOverviewTable({
  overview,
  showPay,
  onSelect,
}: {
  overview: WorkforceOverview;
  showPay: boolean;
  onSelect: (userId: string) => void;
}) {
  const { rows, totals } = overview;
  const scheduled = rows.reduce((s, r) => s + r.summary.scheduledMinutes, 0);
  const sum = (pick: (r: WorkforceOverviewRow) => number) => rows.reduce((s, r) => s + pick(r), 0);

  return (
    <section className="card !p-0" aria-labelledby="staff-table-heading">
      <div className="px-5 pb-3 pt-5">
        <h2 id="staff-table-heading" className="text-lg font-semibold">
          Team
        </h2>
        <p className="mt-0.5 text-sm text-stone-500">Select a person to see their hours, sessions{showPay ? ' and pay' : ''}.</p>
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No staff to show" />
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="table-base">
              <thead>
                <tr>
                  <th scope="col">Person</th>
                  <th scope="col">Now</th>
                  <th scope="col">Progress</th>
                  <th scope="col" className="text-right">Hours</th>
                  <th scope="col" className="text-right">Late</th>
                  {showPay ? (
                    <>
                      <th scope="col" className="text-right">Wage</th>
                      <th scope="col" className="text-right">Tips</th>
                      <th scope="col" className="text-right">Bonuses</th>
                      <th scope="col" className="text-right">Net pay</th>
                    </>
                  ) : null}
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {rows.map((r) => (
                  <tr key={r.user.id} className="hover:bg-stone-50">
                    <td>
                      <button type="button" className="text-left font-medium text-stone-900 hover:text-brand-700 hover:underline" onClick={() => onSelect(r.user.id)}>
                        {r.user.name}
                      </button>
                      <div>
                        <Badge tone={ROLE_META[r.user.role].tone}>{ROLE_META[r.user.role].label}</Badge>
                      </div>
                    </td>
                    <td>
                      <State row={r} />
                    </td>
                    <td>
                      <MiniRings row={r} />
                    </td>
                    <td className="text-right">
                      {hoursText(r.summary.paidMinutes)}
                      <span className="text-stone-500"> / {hoursText(r.summary.scheduledMinutes)}</span>
                    </td>
                    <td className="text-right">{r.summary.lateCount}</td>
                    {showPay ? (
                      <>
                        <td className="text-right">{r.pay ? money(r.pay.hourlyWage) : '—'}</td>
                        <td className="text-right">{r.pay ? money(r.pay.tips) : '—'}</td>
                        <td className="text-right">{r.pay ? money(r.pay.bonusTotal) : '—'}</td>
                        <td className="text-right font-semibold">{r.pay ? money(r.pay.net) : '—'}</td>
                      </>
                    ) : null}
                  </tr>
                ))}
              </tbody>
              <tfoot className="tabular-nums">
                <tr className="bg-stone-50 font-semibold">
                  <th scope="row" className="!text-sm !normal-case !tracking-normal text-stone-800" colSpan={3}>
                    Total ({rows.length})
                  </th>
                  <td className="text-right">
                    {hoursText(totals.paidMinutes)}
                    <span className="font-normal text-stone-500"> / {hoursText(scheduled)}</span>
                  </td>
                  <td className="text-right">{totals.lateCount}</td>
                  {showPay ? (
                    <>
                      <td />
                      <td className="text-right">{money(sum((r) => r.pay?.tips ?? 0))}</td>
                      <td className="text-right">{money(sum((r) => r.pay?.bonusTotal ?? 0))}</td>
                      <td className="text-right">{money(totals.payroll ?? 0)}</td>
                    </>
                  ) : null}
                </tr>
              </tfoot>
            </table>
          </div>

          <ul className="divide-y divide-stone-100 border-t border-stone-100 md:hidden">
            {rows.map((r) => (
              <li key={r.user.id}>
                <button type="button" onClick={() => onSelect(r.user.id)} className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left">
                  <div className="min-w-0 space-y-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-stone-900">{r.user.name}</span>
                      <Badge tone={ROLE_META[r.user.role].tone}>{ROLE_META[r.user.role].label}</Badge>
                    </p>
                    <State row={r} />
                    <p className="text-xs tabular-nums text-stone-500">
                      {hoursText(r.summary.paidMinutes)} of {hoursText(r.summary.scheduledMinutes)} · {r.summary.lateCount} late
                    </p>
                  </div>
                  {showPay && r.pay ? <p className="shrink-0 font-semibold tabular-nums">{money(r.pay.net)}</p> : null}
                </button>
              </li>
            ))}
            <li className="flex items-center justify-between gap-3 bg-stone-50 px-4 py-3 text-sm font-semibold">
              <span>
                Total · {hoursText(totals.paidMinutes)} · {totals.lateCount} late
              </span>
              {showPay && totals.payroll !== null ? <span className="tabular-nums">{money(totals.payroll)}</span> : null}
            </li>
          </ul>
        </>
      )}
    </section>
  );
}

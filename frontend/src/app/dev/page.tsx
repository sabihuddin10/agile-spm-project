'use client';

import { SPRINTS, BACKLOG_SUMMARY, TEAM_ROSTER } from '@/data/backlog';
import { DevShell } from '@/components/layout/dev-shell';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SprintCard } from '@/components/scrum/sprint-card';
import { useAuth } from '@/context/auth-context';

export default function ScrumBoardPage() {
  const { user, loading } = useAuth();
  const delivered = SPRINTS.filter((s) => s.status === 'done');
  const planned = SPRINTS.filter((s) => s.status === 'planned');

  if (loading) return null;
  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50">
        <p className="text-sm text-stone-500">
          Please <a className="text-brand-600 underline" href="/login">sign in</a> to view the development tracker.
        </p>
      </div>
    );
  }

  return (
    <DevShell>
      <PageHeader
        title="Scrum board"
        subtitle="Product Backlog · 10 modules · 49 stories · 217 story points. Source: Product_Backlog.docx & Sprint_Backlogs.docx"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total stories" value={String(BACKLOG_SUMMARY.totalStories)} />
        <StatCard label="Total points" value={String(BACKLOG_SUMMARY.totalPoints)} />
        <StatCard label="Delivered" value={`${BACKLOG_SUMMARY.donePoints} pts`} tone="emerald" />
        <StatCard label="Planned velocity" value={`${BACKLOG_SUMMARY.averageVelocity}/sprint`} />
      </div>

      <div className="mt-6 rounded-xl border border-stone-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold">Project burn-up</p>
            <p className="text-sm text-stone-500">
              Cumulative planned (217 pts) vs cumulative completed.
            </p>
          </div>
          <div className="flex items-center gap-5 text-xs font-medium">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-stone-300" /> Planned
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Completed
            </span>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {SPRINTS.map((s, i) => {
            const cumPlanned = SPRINTS.slice(0, i + 1).reduce(
              (acc, x) => acc + x.stories.reduce((p, st) => p + st.points, 0),
              0,
            );
            const cumDone = SPRINTS.slice(0, i + 1)
              .filter((x) => x.status === 'done')
              .reduce((acc, x) => acc + x.stories.reduce((p, st) => p + st.points, 0), 0);
            const pct = Math.round((cumDone / cumPlanned) * 100);
            return (
              <div key={s.sprint} className="flex items-center gap-3">
                <span className="w-10 shrink-0 text-xs font-medium text-stone-400">S{s.sprint}</span>
                <div className="relative h-6 flex-1 overflow-hidden rounded bg-stone-100">
                  <div
                    className="absolute inset-y-0 left-0 bg-stone-300/70"
                    style={{ width: `${(cumPlanned / 217) * 100}%` }}
                  />
                  <div
                    className="absolute inset-y-0 left-0 bg-emerald-500"
                    style={{ width: `${(cumDone / 217) * 100}%` }}
                  />
                </div>
                <span className="w-16 shrink-0 text-right text-xs text-stone-500">
                  {cumDone}/{cumPlanned}
                </span>
                <span className="w-10 shrink-0 text-right text-xs font-semibold text-emerald-600">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-8">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-lg font-bold">Sprint backlogs</h2>
          <Badge tone="emerald">{delivered.length} delivered</Badge>
          <Badge tone="stone">{planned.length} planned</Badge>
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          {SPRINTS.map((s) => (
            <SprintCard key={s.sprint} sprint={s} />
          ))}
        </div>
      </div>

      <Card className="mt-8">
        <h2 className="mb-3 font-semibold">Team roster</h2>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Member</th>
                <th>Primary role</th>
                <th>Module lead(s)</th>
              </tr>
            </thead>
            <tbody>
              {TEAM_ROSTER.map((m) => (
                <tr key={m.id}>
                  <td className="font-mono font-semibold">{m.id}</td>
                  <td>{m.role}</td>
                  <td className="text-stone-600">{m.moduleLead}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </DevShell>
  );
}

function StatCard({
  label,
  value,
  tone = 'stone',
}: {
  label: string;
  value: string;
  tone?: 'stone' | 'emerald';
}) {
  return (
    <Card>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${tone === 'emerald' ? 'text-emerald-600' : 'text-stone-800'}`}>
        {value}
      </p>
    </Card>
  );
}
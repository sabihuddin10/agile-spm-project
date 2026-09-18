'use client';

import { useState } from 'react';
import type { SprintBacklog, Story } from '@/data/backlog';
import { Badge } from '@/components/ui/badge';

export function SprintCard({ sprint }: { sprint: SprintBacklog }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const done = sprint.status === 'done';
  const total = sprint.stories.reduce((sum, s) => sum + s.points, 0);

  return (
    <div className={`rounded-xl border bg-white shadow-sm transition ${done ? 'border-emerald-200' : 'border-stone-200'}`}>
      <div className="flex items-start justify-between gap-3 border-b border-stone-100 px-5 py-4">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
              done ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-500'
            }`}
          >
            S{sprint.sprint}
          </div>
          <div>
            <p className="font-semibold">{sprint.module}</p>
            <p className="text-xs text-stone-500">
              {sprint.goal}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge tone={sprint.priority === 'Must' ? 'red' : sprint.priority === 'Should' ? 'amber' : 'stone'}>
            {sprint.priority}
          </Badge>
          <Badge tone={done ? 'emerald' : 'stone'}>{done ? 'Delivered' : 'Planned'}</Badge>
        </div>
      </div>

      <div className="px-5 py-3 text-xs text-stone-500">
        Lead: <span className="font-semibold">{sprint.lead}</span> · Stakeholders:{' '}
        {sprint.stakeholders.join(', ')} · <span className="font-semibold">{total} pts</span> ·{' '}
        {sprint.stories.length} stories
      </div>

      <ul className="divide-y divide-stone-50 px-2 pb-2">
        {sprint.stories.map((story) => (
          <StoryRow
            key={story.id}
            story={story}
            done={done}
            expanded={expanded === story.id}
            onToggle={() => setExpanded(expanded === story.id ? null : story.id)}
          />
        ))}
      </ul>
    </div>
  );
}

function StoryRow({
  story,
  done,
  expanded,
  onToggle,
}: {
  story: Story;
  done: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <li>
      <button onClick={onToggle} className="flex w-full items-start gap-3 px-3 py-3 text-left hover:bg-stone-50 rounded-lg">
        <span
          className={`mt-0.5 flex h-5 shrink-0 items-center justify-center rounded ${done ? 'bg-emerald-100' : 'bg-stone-100'}`}
        >
          <svg
            className={`h-3.5 w-3.5 ${done ? 'text-emerald-600' : 'text-stone-400'}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </span>
        <span className="w-16 shrink-0 pt-0.5 font-mono text-xs font-semibold text-stone-400">
          {story.id}
        </span>
        <span className="flex-1 text-sm text-stone-700">{story.text}</span>
        <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-xs font-semibold text-stone-600">
          {story.points} pts
        </span>
      </button>
      {expanded ? (
        <div className="px-4 pb-3 pl-[4.5rem]">
          {story.acceptanceCriteria.length > 0 ? (
            <>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-stone-400">
                Acceptance criteria
              </p>
              <ul className="space-y-1">
                {story.acceptanceCriteria.map((ac, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-stone-600">
                    <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-stone-300" />
                    {ac}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-xs text-stone-400">
              Acceptance criteria to be confirmed during Sprint {story.id.slice(2, 3)} planning (Backlog Refinement).
            </p>
          )}
        </div>
      ) : null}
    </li>
  );
}
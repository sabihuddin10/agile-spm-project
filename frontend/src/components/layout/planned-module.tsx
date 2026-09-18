import { StaffLayout } from '@/components/layout/staff-layout';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function PlannedModule({
  sprint,
  title,
  goal,
  stories,
}: {
  sprint: number;
  title: string;
  goal: string;
  stories: string[];
}) {
  return (
    <StaffLayout>
      <div className="mb-6 flex items-center gap-3">
        <Badge tone="stone">Sprint {sprint} · Planned</Badge>
        <h1 className="text-2xl font-bold">{title}</h1>
      </div>

      <Card>
        <p className="text-sm text-stone-600">{goal}</p>
        <div className="mt-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">
            Committed stories (from Product Backlog)
          </p>
          <ul className="space-y-2">
            {stories.map((story) => (
              <li key={story} className="flex items-start gap-2 text-sm text-stone-700">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-stone-300" />
                {story}
              </li>
            ))}
          </ul>
        </div>
        <p className="mt-5 rounded-lg bg-stone-50 px-4 py-3 text-sm text-stone-500">
          This module is scheduled for Sprint {sprint} in the 10-week Scrum plan. Its API endpoints,
          UI, and acceptance criteria will land in that increment.
        </p>
      </Card>
    </StaffLayout>
  );
}
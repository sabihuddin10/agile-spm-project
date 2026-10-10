import type { StaffRole } from '@/types';
import { Card, CardHeader } from '@/components/ui/card';
import { ROLE_CAPABILITIES, ROLE_META } from '@/components/staff/role-meta';

function Mark({ allowed }: { allowed: boolean }) {
  return (
    <svg
      className={`mt-0.5 h-4 w-4 shrink-0 ${allowed ? 'text-emerald-600' : 'text-stone-400'}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={allowed ? 'M4.5 12.75l6 6 9-13.5' : 'M6 18L18 6M6 6l12 12'} />
    </svg>
  );
}

/** What the signed-in staff member's role allows, from ROLE_CAPABILITIES (mirrors the README table). */
export function RoleCapabilities({ role }: { role: StaffRole }) {
  const { can, cannot } = ROLE_CAPABILITIES[role];
  const label = ROLE_META[role].label.toLowerCase();
  return (
    <Card>
      <CardHeader title="What your role can do" subtitle={`Access for the ${label} role. An admin can change your role.`} />
      <section aria-labelledby="caps-can">
        <h3 id="caps-can" className="text-xs font-semibold uppercase tracking-wide text-stone-500">
          You can
        </h3>
        <ul className="mt-2 space-y-1.5 text-sm text-stone-700">
          {can.map((item) => (
            <li key={item} className="flex gap-2">
              <Mark allowed />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="caps-cannot" className="mt-4 border-t border-stone-100 pt-3.5 sm:mt-5 sm:pt-4">
        <h3 id="caps-cannot" className="text-xs font-semibold uppercase tracking-wide text-stone-500">
          You can&apos;t
        </h3>
        <ul className="mt-2 space-y-1.5 text-sm text-stone-500">
          {cannot.map((item) => (
            <li key={item} className="flex gap-2">
              <Mark allowed={false} />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>
    </Card>
  );
}

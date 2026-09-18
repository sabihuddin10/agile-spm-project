'use client';

import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { StaffLayout } from '@/components/layout/staff-layout';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const ROLE_INTRO: Record<string, { title: string; desc: string; tone: 'brand' | 'blue' | 'emerald' | 'amber' | 'red' }> = {
  waiter: { title: 'Floor operations', desc: 'Serve guests: customer ledger, menu access, and order management (Sprint 3).', tone: 'blue' },
  chef: { title: 'Kitchen display', desc: 'Keep the menu accurate and prepare upcoming Kitchen Display System (Sprint 4).', tone: 'emerald' },
  manager: { title: 'Operations oversight', desc: 'Manage customers, menu, and staff. Billing, tables, reservations and analytics arrive in later sprints.', tone: 'amber' },
  admin: { title: 'System administration', desc: 'Full access including RBAC and user management across all five roles.', tone: 'red' },
};

const CARD_LINKS = [
  { href: '/staff/orders', label: 'Orders', role: ['waiter', 'manager', 'admin'] as const, sprint: 'Sprint 3' },
  { href: '/staff/kitchen', label: 'Kitchen (KDS)', role: ['chef', 'manager', 'admin'] as const, sprint: 'Sprint 4' },
  { href: '/staff/billing', label: 'Billing', role: ['waiter', 'manager', 'admin'] as const, sprint: 'Sprint 5' },
  { href: '/staff/tables', label: 'Tables', role: ['waiter', 'manager', 'admin'] as const, sprint: 'Sprint 6' },
  { href: '/staff/reservations', label: 'Reservations', role: ['waiter', 'manager', 'admin'] as const, sprint: 'Sprint 7' },
  { href: '/staff/inventory', label: 'Inventory', role: ['chef', 'manager', 'admin'] as const, sprint: 'Sprint 8' },
  { href: '/staff/users', label: 'Staff & roles', role: ['admin'] as const, sprint: 'Sprint 9' },
  { href: '/staff/analytics', label: 'Analytics', role: ['manager', 'admin'] as const, sprint: 'Sprint 10' },
  { href: '/staff/customers', label: 'Customer ledger', role: ['waiter', 'manager', 'admin'] as const, sprint: 'Sprint 1' },
  { href: '/staff/menu', label: 'Menu management', role: ['chef', 'manager', 'admin'] as const, sprint: 'Sprint 2' },
];

const RANK: Record<string, number> = { customer: 0, waiter: 1, chef: 2, manager: 3, admin: 4 };

export default function DashboardPage() {
  const { user } = useAuth();
  if (!user || user.role === 'customer') return null;

  const intro = ROLE_INTRO[user.role] ?? ROLE_INTRO.waiter;
  const links = CARD_LINKS.filter((l) => Math.max(...l.role.map((r) => RANK[r])) <= RANK[user.role]);

  return (
    <StaffLayout>
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <Badge tone={intro.tone}>{user.role}</Badge>
          <h1 className="text-2xl font-bold">Welcome back, {user.name.split(' ')[0]}</h1>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-stone-500">{intro.desc}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {links.map((link) => (
          <Link key={link.href + link.label} href={link.href} className="group">
            <Card className="transition group-hover:border-brand-300 group-hover:shadow-md">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                {link.sprint}
              </p>
              <p className="mt-2 font-semibold text-stone-800 group-hover:text-brand-700">
                {link.label}
              </p>
              <p className="mt-1 text-xs text-stone-500">Open module →</p>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="mt-6">
        <h2 className="font-semibold">Sprint progress</h2>
        <p className="mt-1 text-sm text-stone-500">
          All 10 modules are now live with in-memory data. Ordering, kitchen, billing, tables,
          reservations, inventory, staff roles, and analytics are implemented.
        </p>
        <div className="mt-4 flex gap-1.5">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((s) => (
            <div
              key={s}
              className="flex-1 rounded py-1.5 text-center text-[11px] font-medium bg-emerald-100 text-emerald-700"
              title={`Sprint ${s} delivered`}
            >
              S{s}
            </div>
          ))}
        </div>
      </Card>
    </StaffLayout>
  );
}
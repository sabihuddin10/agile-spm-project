'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import type { Role } from '@/types';
import { Badge } from '@/components/ui/badge';

interface NavItem {
  href: string;
  label: string;
  icon: string;
  roles: Role[];
  plannedSprint?: number;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/staff', label: 'Overview', icon: 'grid', roles: ['waiter', 'chef', 'manager', 'admin'] },
  { href: '/staff/orders', label: 'Orders', icon: 'receipt', roles: ['waiter', 'manager', 'admin'] },
  { href: '/staff/kitchen', label: 'Kitchen (KDS)', icon: 'fire', roles: ['chef', 'manager', 'admin'] },
  { href: '/staff/billing', label: 'Billing', icon: 'cash', roles: ['waiter', 'manager', 'admin'] },
  { href: '/staff/tables', label: 'Tables', icon: 'grid', roles: ['waiter', 'manager', 'admin'] },
  { href: '/staff/reservations', label: 'Reservations', icon: 'calendar', roles: ['waiter', 'manager', 'admin'] },
  { href: '/staff/customers', label: 'Customers', icon: 'users', roles: ['waiter', 'manager', 'admin'] },
  { href: '/staff/users', label: 'Staff & roles', icon: 'shield', roles: ['admin'] },
  { href: '/staff/inventory', label: 'Inventory', icon: 'box', roles: ['chef', 'manager', 'admin'] },
  { href: '/staff/menu', label: 'Menu', icon: 'book', roles: ['waiter', 'chef', 'manager', 'admin'] },
  { href: '/staff/analytics', label: 'Analytics', icon: 'chart', roles: ['manager', 'admin'] },
];

const RANK: Record<Role, number> = { customer: 0, waiter: 1, chef: 2, manager: 3, admin: 4 };

const ICONS: Record<string, string> = {
  grid: 'M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z',
  users: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z',
  shield: 'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z',
  book: 'M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25',
  receipt: 'M9 14.25l6 0M9 9.75L12 9.75M19.5 21l-1.5-1.5-1.5 1.5L15 19.5l-1.5 1.5-1.5-1.5L10.5 21l-1.5-1.5-1.5 1.5L6 19.5 4.5 21V5.25A2.25 2.25 0 016.75 3h10.5a2.25 2.25 0 012.25 2.25V21z',
  fire: 'M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48zM14.25 18a3.75 3.75 0 00.75-3M4.5 10.5a1.5 1.5 0 013 0v3a1.5 1.5 0 01-3 0v-3zm12 6a1.5 1.5 0 013 0v3a1.5 1.5 0 01-3 0v-3z',
  cash: 'M6 5.25A3.75 3.75 0 002.25 9v6A3.75 3.75 0 006 18.75h12A3.75 3.75 0 0021.75 15V9A3.75 3.75 0 0018 5.25H6zM6 2.25h12A5.25 5.25 0 0123.25 7.5v9a5.25 5.25 0 01-5.25 5.25H6A5.25 5.25 0 01.75 16.5v-9A5.25 5.25 0 016 2.25zm3.75 9a2.25 2.25 0 114.5 0 2.25 2.25 0 01-4.5 0z',
  calendar: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5',
  box: 'M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9',
  chart: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z',
};

export function StaffShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  if (!user) return null;

  const items = NAV_ITEMS.filter((item) => {
    const min = Math.max(...item.roles.map((r) => RANK[r]));
    return RANK[user.role] >= min;
  });

  const initials = user.name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-stone-200 bg-white">
        <div className="flex items-center gap-3 border-b border-stone-200 px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white font-bold">
            RO
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">Staff console</p>
            <p className="text-xs text-stone-500">Restaurant operations</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-0.5">
            {items.map((item) => {
              const active = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                      active
                        ? 'bg-brand-50 font-medium text-brand-700'
                        : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                    }`}
                  >
                    <svg
                      className="h-[18px] w-[18px] shrink-0 text-stone-400 group-hover:text-stone-600"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.5}
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d={ICONS[item.icon]} />
                    </svg>
                    <span className="flex-1">{item.label}</span>
                    {item.plannedSprint ? (
                      <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-stone-400">
                        S{item.plannedSprint}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="mt-6 border-t border-stone-200 pt-4">
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-stone-400">
              Other zones
            </p>
            <Link
              href="/dev"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-stone-600 hover:bg-stone-100 hover:text-stone-900"
            >
              <svg className="h-[18px] w-[18px] text-stone-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12h6m-6 4h6M9 8h6M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z"
                />
              </svg>
              Dev tracker
            </Link>
            <Link
              href="/"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-stone-600 hover:bg-stone-100 hover:text-stone-900"
            >
              <svg className="h-[18px] w-[18px] text-stone-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75"
                />
              </svg>
              Public site
            </Link>
          </div>
        </nav>

        <div className="border-t border-stone-200 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <Badge tone={user.role === 'admin' ? 'brand' : user.role === 'manager' ? 'blue' : 'stone'}>
                {user.role}
              </Badge>
            </div>
            <button
              onClick={() => {
                logout();
                router.push('/login');
              }}
              className="btn-ghost !px-2 !py-1 text-xs"
              title="Sign out"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"
                />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      <main className="ml-64 flex-1 px-8 py-8">{children}</main>
    </div>
  );
}
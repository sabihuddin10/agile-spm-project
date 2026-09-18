'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { Badge } from '@/components/ui/badge';

export function DevShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  if (!user) return null;

  const initials = user.name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const isDevActive = pathname === '/dev';

  return (
    <div className="flex min-h-screen flex-col bg-stone-50">
      <header className="sticky top-0 z-40 border-b border-stone-200 bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded bg-indigo-600 text-[11px] font-bold text-white">
              RO
            </div>
            <span className="text-sm font-semibold text-stone-900">Dev tracker</span>
          </div>

          <nav className="flex items-center gap-1">
            <Link
              href="/dev"
              className={`rounded-md px-3 py-1.5 text-sm ${
                isDevActive
                  ? 'bg-indigo-50 font-medium text-indigo-700'
                  : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
              }`}
            >
              Backlog & Board
            </Link>
            {['waiter', 'chef', 'manager', 'admin'].includes(user.role) && (
              <Link
                href="/staff"
                className="rounded-md px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-100 hover:text-stone-900"
              >
                Staff console
              </Link>
            )}
            <Link
              href="/"
              className="rounded-md px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-100 hover:text-stone-900"
            >
              Public site
            </Link>
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
              {initials}
            </div>
            <span className="hidden text-sm text-stone-600 sm:block">{user.name}</span>
            <Badge tone="blue">{user.role}</Badge>
            <button
              onClick={() => {
                logout();
                router.push('/login');
              }}
              className="rounded-md px-2 py-1 text-xs text-stone-500 hover:bg-stone-100 hover:text-stone-900"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
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
        <div className="mx-auto flex min-h-14 max-w-6xl flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2 sm:px-6">
          <div className="order-1 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded bg-indigo-600 text-xs font-bold text-white">
              RO
            </div>
            <span className="text-sm font-semibold text-stone-900">Dev tracker</span>
          </div>

          {/* Phones: the nav drops to its own row so the user menu stays on screen. */}
          <nav className="order-3 -mx-1 flex w-full items-center gap-1 overflow-x-auto sm:order-2 sm:mx-0 sm:w-auto">
            <Link
              href="/dev"
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm ${
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
                className="whitespace-nowrap rounded-md px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-100 hover:text-stone-900"
              >
                Staff console
              </Link>
            )}
            <Link
              href="/"
              className="whitespace-nowrap rounded-md px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-100 hover:text-stone-900"
            >
              Public site
            </Link>
          </nav>

          <div className="order-2 ml-auto flex items-center gap-3 sm:order-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
              {initials}
            </div>
            <span className="hidden text-sm text-stone-600 sm:block">{user.name}</span>
            <Badge tone="blue" className="hidden sm:inline-flex">{user.role}</Badge>
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
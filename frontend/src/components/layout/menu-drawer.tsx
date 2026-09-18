'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/auth-context';

export function MenuDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  if (!open) return null;

  const linkClass = (href: string) =>
    `flex items-center justify-between rounded-pill px-4 py-3 text-[15px] font-medium transition ${
      pathname === href ? 'bg-ember/10 text-ember' : 'text-bone hover:bg-char-raised hover:text-bone'
    }`;

  const groupTitle = 'px-4 pb-1 pt-5 text-[11px] font-extrabold uppercase tracking-[0.18em] text-bone-faint';

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="fade-in absolute inset-0 bg-char-deep/70 backdrop-blur-sm" onClick={onClose} />
      <div className="drawer-in-left relative z-10 flex h-full w-[320px] flex-col bg-char-raised shadow-ember">
        <div className="flex items-center justify-between border-b border-char-hairline px-5 py-4">
          <p className="font-display text-base font-extrabold tracking-tight text-bone">
            Plate &amp; Flame
          </p>
          <button
            onClick={onClose}
            className="rounded-pill border border-char-hairline p-1.5 text-bone-faint transition hover:bg-char-deep hover:text-bone"
            aria-label="Close menu"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-6">
          <p className={groupTitle}>Order</p>
          <Link href="/" onClick={onClose} className={linkClass('/')}>
            Home
          </Link>
          <Link href="/menu" onClick={onClose} className={linkClass('/menu')}>
            Full menu
          </Link>
          <Link href="/book" onClick={onClose} className={linkClass('/book')}>
            Book a table
          </Link>

          <p className={groupTitle}>Account</p>
          {user ? (
            <>
              <Link href="/account" onClick={onClose} className={linkClass('/account')}>
                My account
              </Link>
              <button
                type="button"
                onClick={() => {
                  logout();
                  onClose();
                }}
                className="flex w-full items-center justify-between rounded-pill px-4 py-3 text-left text-[15px] font-medium text-bone-faint transition hover:bg-char-raised hover:text-bone"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                onClick={onClose}
                className="flex items-center rounded-pill bg-ember px-4 py-3 text-[15px] font-extrabold text-bone"
              >
                Sign in
              </Link>
              <Link href="/register" onClick={onClose} className={linkClass('/register')}>
                Create an account
              </Link>
            </>
          )}

          {user && ['waiter', 'chef', 'manager', 'admin'].includes(user.role) ? (
            <>
              <p className={groupTitle}>Staff</p>
              <Link
                href="/staff"
                onClick={onClose}
                className="flex items-center justify-between rounded-pill px-4 py-3 text-[15px] font-medium text-bone transition hover:bg-char-raised hover:text-bone"
              >
                Staff console
              </Link>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

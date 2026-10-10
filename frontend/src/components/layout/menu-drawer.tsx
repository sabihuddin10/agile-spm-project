'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { isStaff } from '@/lib/permissions';

/** Storefront slide-out navigation for small screens (orders jump to /account#orders). */
export function MenuDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const staff = isStaff(user?.role);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const linkClass = (href: string) =>
    `flex items-center justify-between rounded-pill px-4 py-2.5 text-sm font-medium transition ${
      pathname === href ? 'bg-ember/10 text-ember' : 'text-bone hover:bg-char-deep hover:text-bone'
    }`;

  const groupTitle = 'px-4 pb-1 pt-5 text-xs font-extrabold uppercase tracking-[0.18em] text-bone-faint';

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Site menu">
      <div className="fade-in absolute inset-0 bg-char-deep/70 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="drawer-in-left relative z-10 flex h-full w-[min(320px,85vw)] flex-col bg-char-raised shadow-ember">
        <div className="flex items-center justify-between border-b border-char-hairline px-5 py-4">
          <p className="font-display text-base font-extrabold tracking-tight text-bone">Plate &amp; Flame</p>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-pill border border-char-hairline text-bone-faint transition hover:bg-char-deep hover:text-bone"
            aria-label="Close menu"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4" aria-hidden="true">
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-6" aria-label="Site">
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
              {staff ? (
                <Link href="/staff" onClick={onClose} className={linkClass('/staff')}>
                  Staff console
                </Link>
              ) : (
                <>
                  <Link href="/account#orders" onClick={onClose} className={linkClass('/account#orders')}>
                    My orders
                  </Link>
                  <Link href="/account" onClick={onClose} className={linkClass('/account')}>
                    My account
                  </Link>
                </>
              )}
              <button
                type="button"
                onClick={() => {
                  logout();
                  onClose();
                }}
                className="flex w-full items-center justify-between rounded-pill px-4 py-2.5 text-left text-sm font-medium text-bone-faint transition hover:bg-char-deep hover:text-bone"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                onClick={onClose}
                className="flex items-center rounded-pill bg-ember px-4 py-2.5 text-sm font-bold text-bone"
              >
                Sign in
              </Link>
              <Link href="/register" onClick={onClose} className={linkClass('/register')}>
                Create an account
              </Link>
            </>
          )}

          <p className={groupTitle}>Restaurant</p>
          <Link href="/careers" onClick={onClose} className={linkClass('/careers')}>
            Careers
          </Link>
        </nav>
      </div>
    </div>
  );
}

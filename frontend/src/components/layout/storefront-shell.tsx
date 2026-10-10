'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useCart } from '@/context/cart-context';
import { CartDrawer } from '@/components/menu/cart-drawer';
import { MenuDrawer } from '@/components/layout/menu-drawer';
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav';
import { NotificationBell } from '@/components/layout/notification-bell';
import { FlameMark } from '@/components/storefront/flame-mark';
import { isStaff } from '@/lib/permissions';

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-[18px] w-[18px]" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path strokeLinecap="round" d="m20 20-3.5-3.5" />
    </svg>
  );
}

function BagIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12l1 13H5L6 7Z" />
      <path strokeLinecap="round" d="M9 10V6a3 3 0 0 1 6 0v4" />
    </svg>
  );
}

function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <span
      aria-hidden="true"
      className={`flex items-center justify-center rounded-full bg-ember text-bone ${className ?? 'h-7 w-7 text-2xs font-extrabold'}`}
    >
      {initials}
    </span>
  );
}

/**
 * Public storefront frame ("charcoal & ember"): header with cart, notifications
 * for signed-in users and the account menu; cart drawer; mobile nav; footer.
 */
export function StorefrontShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { count, setOpen } = useCart();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const staff = isStaff(user?.role);

  // Close the account menu on an outside click or Escape.
  useEffect(() => {
    if (!profileOpen) return;
    function onDown(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setProfileOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [profileOpen]);

  const navLink = (href: string, label: string) => {
    const active =
      href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href);
    return (
      <Link
        href={href}
        className={`relative px-3 py-1.5 text-sm transition ${
          active
            ? 'text-bone after:absolute after:inset-x-3 after:bottom-0.5 after:h-px after:bg-ember'
            : 'text-bone-dim hover:text-bone'
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <div className="storefront flex min-h-screen flex-col bg-char">
      <header className="sticky top-0 z-[52] border-b border-char-hairline bg-char/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1240px] items-center gap-1.5 px-4 sm:gap-2 sm:px-6 lg:h-16">
          {/* Hamburger — mobile */}
          <button
            onClick={() => setMenuOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-pill text-bone lg:hidden"
            aria-label="Open menu"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5" aria-hidden="true">
              <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <Link href="/" className="mr-2 flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-char-hairline bg-char-raised text-ember">
              <FlameMark />
            </div>
            <div className="hidden sm:block">
              <p className="font-display text-lg font-semibold leading-tight tracking-tight text-bone">
                Plate &amp; Flame
              </p>
              <p className="text-xs leading-tight text-bone-faint">Wood-fired bistro</p>
            </div>
          </Link>

          {/* Location pill */}
          <span className="hidden items-center gap-1.5 rounded-pill border border-char-hairline bg-char-raised px-3 py-1.5 text-xs font-medium text-bone-dim md:flex lg:ml-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-3.5 w-3.5 text-ember-soft" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s-6-5.3-6-10a6 6 0 1 1 12 0c0 4.7-6 10-6 10Z" />
              <circle cx="12" cy="11" r="2" />
            </svg>
            Old Town
          </span>

          {/* Desktop nav */}
          <nav className="ml-4 hidden items-center gap-1 lg:flex">
            {navLink('/', 'Home')}
            {navLink('/menu', 'Menu')}
            {navLink('/book', 'Book a table')}
          </nav>

          <div className="ml-auto flex items-center gap-1.5">
            {/* Search icon */}
            <Link
              href="/menu"
              className="hidden h-9 w-9 items-center justify-center rounded-pill text-bone-dim transition hover:bg-char-raised hover:text-bone md:flex"
              aria-label="Browse the menu"
            >
              <SearchIcon />
            </Link>

            {/* Rightmost on phones so its 20rem panel has room to open leftwards. */}
            {user ? (
              <div className="order-last lg:order-none">
                <NotificationBell variant="dark" />
              </div>
            ) : null}

            {/* Cart icon */}
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="relative flex h-9 w-9 items-center justify-center rounded-pill text-bone-dim transition hover:bg-char-raised hover:text-bone"
              aria-label={`Open your order, ${count} ${count === 1 ? 'item' : 'items'}`}
            >
              <BagIcon />
              {count > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-ember px-1 text-2xs font-bold text-bone">
                  {count}
                </span>
              ) : null}
            </button>

            {user ? (
              <>
                {staff ? (
                  <Link href="/staff" className="hidden rounded-pill border border-char-hairline px-3 py-1.5 text-xs font-semibold text-bone-dim transition hover:text-bone md:block">
                    Staff
                  </Link>
                ) : null}
                <div className="relative" ref={profileRef}>
                  <button
                    type="button"
                    onClick={() => setProfileOpen((v) => !v)}
                    className="flex items-center gap-2 rounded-pill border border-char-hairline bg-char-raised py-1 pl-1 pr-2 transition hover:border-ember/40"
                    aria-label="Account menu"
                    aria-expanded={profileOpen}
                  >
                    <Avatar name={user.name} />
                    <span className="hidden max-w-[90px] truncate text-xs font-medium text-bone sm:block">
                      {user.name.split(' ')[0]}
                    </span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-3 w-3 text-bone-faint" aria-hidden="true">
                      <path strokeLinecap="round" d="m6 9 6 6 6-6" />
                    </svg>
                  </button>
                  {profileOpen ? (
                    <div className="fade-in absolute right-0 top-11 z-50 w-52 overflow-hidden rounded-2xl border border-char-hairline bg-char-raised py-2 shadow-ember">
                      <div className="border-b border-char-hairline px-4 py-2.5">
                        <p className="truncate text-sm font-semibold text-bone">{user.name}</p>
                        <p className="truncate text-xs text-bone-faint">{user.email}</p>
                      </div>
                      {staff ? (
                        <Link
                          href="/staff"
                          onClick={() => setProfileOpen(false)}
                          className="block px-4 py-2.5 text-sm text-bone-dim transition hover:bg-char-deep hover:text-bone"
                        >
                          Staff console
                        </Link>
                      ) : (
                        <>
                          <Link
                            href="/account#orders"
                            onClick={() => setProfileOpen(false)}
                            className="block px-4 py-2.5 text-sm text-bone-dim transition hover:bg-char-deep hover:text-bone"
                          >
                            My orders
                          </Link>
                          <Link
                            href="/account"
                            onClick={() => setProfileOpen(false)}
                            className="block px-4 py-2.5 text-sm text-bone-dim transition hover:bg-char-deep hover:text-bone"
                          >
                            My account
                          </Link>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          logout();
                          setProfileOpen(false);
                        }}
                        className="block w-full px-4 py-2.5 text-left text-sm text-bone-dim transition hover:bg-char-deep hover:text-ember"
                      >
                        Sign out
                      </button>
                    </div>
                  ) : null}
                </div>
              </>
            ) : (
              <div className="hidden items-center gap-2 lg:flex">
                <Link href="/login" className="rounded-pill px-3 py-1.5 text-sm text-bone-dim transition hover:text-bone">
                  Sign in
                </Link>
                <Link
                  href="/register"
                  className="inline-flex h-9 items-center rounded-pill bg-ember px-4 text-sm font-bold text-bone lg:h-10 transition hover:bg-ember-soft"
                >
                  Join
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 pb-24 lg:pb-0">{children}</main>

      <CartDrawer />
      <MenuDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />
      <MobileBottomNav />

      <footer className="hidden border-t border-char-hairline bg-char-deep lg:block">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-10 px-6 py-12 sm:flex-row sm:justify-between sm:gap-16">
          <div className="max-w-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-char-hairline bg-char-raised text-ember">
                <FlameMark />
              </div>
              <p className="font-display text-lg font-semibold tracking-tight text-bone">
                Plate &amp; Flame
              </p>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-bone-dim">
              Wood-fired plates, a short menu that changes with the season, and a kitchen that cooks
              around your allergies. Pick up, dine in, or gather round the grill.
            </p>
          </div>

          <div className="flex gap-12 text-sm sm:gap-16">
            <div className="space-y-2.5">
              <p className="font-medium text-bone">Guests</p>
              <Link href="/menu" className="block text-bone-dim transition hover:text-bone">
                Order online
              </Link>
              <Link href="/book" className="block text-bone-dim transition hover:text-bone">
                Book a table
              </Link>
              <Link href="/register" className="block text-bone-dim transition hover:text-bone">
                Create an account
              </Link>
              <Link href="/careers" className="block text-bone-dim transition hover:text-bone">
                Careers
              </Link>
            </div>
            <div className="space-y-2.5">
              <p className="font-medium text-bone">Visit</p>
              <span className="block text-bone-dim">12 Ember Lane, Old Town</span>
              <span className="block text-bone-dim">Open all week, 12:00–22:00</span>
              <Link href="/login" className="block text-bone-dim transition hover:text-bone">
                Staff sign in
              </Link>
            </div>
            {user && (
              <div className="space-y-2.5">
                <p className="font-medium text-bone">Signed in</p>
                <Link href={staff ? '/staff' : '/account'} className="block text-bone-dim transition hover:text-bone">
                  {user.name}
                </Link>
                <Link href="/dev" className="block text-bone-dim transition hover:text-bone">
                  Project tracker
                </Link>
              </div>
            )}
          </div>
        </div>
        <div className="border-t border-char-hairline/70 py-5">
          <p className="mx-auto max-w-[1240px] px-6 text-xs text-bone-faint">
            Plate &amp; Flame · Wood-fired bistro and restaurant platform
          </p>
        </div>
      </footer>
    </div>
  );
}

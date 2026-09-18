'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useCart } from '@/context/cart-context';
import { CartDrawer } from '@/components/menu/cart-drawer';
import { MenuDrawer } from '@/components/layout/menu-drawer';
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav';
import { useState } from 'react';

function FlameMark({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path
        d="M12 2c4.2 5 6.5 8.2 6.5 11.6A6.5 6.5 0 0 1 5.5 13.4C5.8 10 8 6.9 12 2Z"
        opacity="0.32"
      />
      <path d="M12 7c1.9 3 2.8 4.9 2.8 6.6a2.8 2.8 0 0 1-5.6 0C9.2 11.9 10.1 10 12 7Z" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-[18px] w-[18px]">
      <circle cx="11" cy="11" r="7" />
      <path strokeLinecap="round" d="m20 20-3.5-3.5" />
    </svg>
  );
}

function BagIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
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
      className={`flex items-center justify-center rounded-full bg-ember text-bone ${className ?? 'h-8 w-8 text-xs font-extrabold'}`}
    >
      {initials}
    </span>
  );
}

export function StorefrontShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { count, setOpen } = useCart();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

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
        <div className="mx-auto flex h-16 max-w-[1240px] items-center gap-2 px-4 sm:px-6">
          {/* Hamburger — mobile */}
          <button
            onClick={() => setMenuOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-pill text-bone lg:hidden"
            aria-label="Open menu"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-6 w-6">
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
              <p className="text-[11px] leading-tight text-bone-faint">Wood-fired bistro</p>
            </div>
          </Link>

          {/* Location pill */}
          <button className="hidden items-center gap-1.5 rounded-pill border border-char-hairline bg-char-raised px-3 py-1.5 text-xs font-medium text-bone-dim transition hover:text-bone md:flex lg:ml-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-3.5 w-3.5 text-ember-soft">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s-6-5.3-6-10a6 6 0 1 1 12 0c0 4.7-6 10-6 10Z" />
              <circle cx="12" cy="11" r="2" />
            </svg>
            Old Town
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-3 w-3 text-bone-faint">
              <path strokeLinecap="round" d="m9 6 6 6-6 6" />
            </svg>
          </button>

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
              className="hidden h-10 w-10 items-center justify-center rounded-pill text-bone-dim transition hover:bg-char-raised hover:text-bone md:flex"
              aria-label="Browse the menu"
            >
              <SearchIcon />
            </Link>

            {/* Cart icon */}
            <button
              onClick={() => setOpen(true)}
              className="relative flex h-10 w-10 items-center justify-center rounded-pill text-bone-dim transition hover:bg-char-raised hover:text-bone"
              aria-label={`Open cart, ${count} items`}
            >
              <BagIcon />
              {count > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-ember px-1 text-[10px] font-bold text-bone">
                  {count}
                </span>
              ) : null}
            </button>

            {user ? (
              <>
                {user.role !== 'customer' ? (
                  <Link href="/staff" className="hidden rounded-pill border border-char-hairline px-3 py-1.5 text-xs font-semibold text-bone-dim transition hover:text-bone md:block">
                    Staff
                  </Link>
                ) : null}
                <div className="relative">
                  <button
                    onClick={() => setProfileOpen((v) => !v)}
                    className="flex items-center gap-2 rounded-pill border border-char-hairline bg-char-raised py-1 pl-1 pr-2 transition hover:border-ember/40"
                    aria-label="Account menu"
                  >
                    <Avatar name={user.name} />
                    <span className="hidden max-w-[90px] truncate text-xs font-medium text-bone sm:block">
                      {user.name.split(' ')[0]}
                    </span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-3 w-3 text-bone-faint">
                      <path strokeLinecap="round" d="m6 9 6 6 6-6" />
                    </svg>
                  </button>
                  {profileOpen ? (
                    <div className="fade-in absolute right-0 top-12 w-48 overflow-hidden rounded-2xl border border-char-hairline bg-char-raised py-2 shadow-ember">
                      <div className="border-b border-char-hairline px-4 py-2.5">
                        <p className="truncate text-sm font-semibold text-bone">{user.name}</p>
                        <p className="truncate text-xs text-bone-faint">{user.email}</p>
                      </div>
                      <Link
                        href="/account"
                        onClick={() => setProfileOpen(false)}
                        className="block px-4 py-2.5 text-sm text-bone-dim transition hover:bg-char-deep hover:text-bone"
                      >
                        My account
                      </Link>
                      <button
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
                  className="rounded-pill bg-ember px-4 py-1.5 text-sm font-bold text-bone transition hover:bg-ember-soft"
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
                <Link href="/account" className="block text-bone-dim transition hover:text-bone">
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

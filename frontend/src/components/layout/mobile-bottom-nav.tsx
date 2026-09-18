'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/auth-context';

interface BottomNavItem {
  label: string;
  href?: string;
  icon: React.ReactNode;
}

function IconHome() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-[22px] w-[22px]">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-8.5Z" />
    </svg>
  );
}

function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-[22px] w-[22px]">
      <circle cx="11" cy="11" r="7" />
      <path strokeLinecap="round" d="m20 20-3.5-3.5" />
    </svg>
  );
}

function IconOrders() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-[22px] w-[22px]">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 5h16M4 12h10M4 19h14" />
    </svg>
  );
}

function IconProfile() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-[22px] w-[22px]">
      <circle cx="12" cy="8" r="3.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 20c1.4-3 4-4.5 7-4.5s5.6 1.5 7 4.5" />
    </svg>
  );
}

export function MobileBottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();

  const items: BottomNavItem[] = [
    { label: 'Home', href: '/', icon: <IconHome /> },
    { label: 'Search', href: '/menu', icon: <IconSearch /> },
    { label: 'Orders', href: user ? '/account' : '/login', icon: <IconOrders /> },
    { label: 'Profile', href: user ? '/account' : '/login', icon: <IconProfile /> },
  ];

  const isActive = (h?: string) => h === '/' ? pathname === '/' : !!h && pathname.startsWith(h);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[55] border-t border-char-hairline bg-char-raised/95 backdrop-blur lg:hidden">
      <div className="mx-auto grid max-w-md grid-cols-4">
        {items.map((item) => {
          const active = isActive(item.href);
          if (!item.href) return null;
          return (
            <Link
              key={item.label}
              href={item.href}
              className="flex flex-col items-center gap-1 py-2.5"
            >
              <span className={active ? 'text-ember' : 'text-bone-faint'}>{item.icon}</span>
              <span className={`text-[11px] font-medium ${active ? 'text-ember' : 'text-bone-faint'}`}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

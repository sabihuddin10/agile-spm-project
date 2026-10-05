import Link from 'next/link';
import type { Role } from '@/types';
import { canAccess, type Section } from '@/lib/permissions';

const SECTION_LINKS: { section: Section; href: string; label: string; description: string }[] = [
  { section: 'orders', href: '/staff/orders', label: 'Orders', description: 'Take, confirm and serve dine-in and online orders.' },
  { section: 'kitchen', href: '/staff/kitchen', label: 'Kitchen (KDS)', description: 'Work the cooking queue and call dishes ready.' },
  { section: 'tables', href: '/staff/tables', label: 'Floor plan', description: 'Table status, seating and waiter assignments.' },
  { section: 'reservations', href: '/staff/reservations', label: 'Reservations', description: 'Confirm bookings, seat guests, mark no-shows.' },
  { section: 'billing', href: '/staff/billing', label: 'Billing', description: 'Settle bills, split payments, tips and receipts.' },
  { section: 'customers', href: '/staff/customers', label: 'Customers', description: 'Guest ledger, preferences, allergies and history.' },
  { section: 'menu', href: '/staff/menu', label: 'Menu', description: 'Dishes, categories, modifiers and availability.' },
  { section: 'inventory', href: '/staff/inventory', label: 'Inventory', description: 'Stock levels, adjustments and purchase orders.' },
  { section: 'staff', href: '/staff/users', label: 'Staff management', description: 'Applications, rota, roles and performance.' },
  { section: 'analytics', href: '/staff/analytics', label: 'Analytics', description: 'Sales trends, top dishes, peak hours, no-shows.' },
  { section: 'schedule', href: '/staff/schedule', label: 'My schedule', description: 'Your upcoming and past shifts.' },
  { section: 'settings', href: '/staff/settings', label: 'Settings', description: 'Restaurant details, tax, service charge, hours.' },
];

/** Shortcut grid of every staff section the signed-in role can open (RBAC via canAccess). */
export function QuickLinks({ role }: { role: Role }) {
  const links = SECTION_LINKS.filter((l) => canAccess(role, l.section));
  return (
    <section aria-labelledby="quick-links-heading" className="card">
      <h2 id="quick-links-heading" className="text-base font-semibold text-stone-900">
        Quick links
      </h2>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="group block h-full rounded-lg border border-stone-200 px-3 py-2.5 transition hover:border-brand-300 hover:bg-brand-50/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <p className="text-sm font-medium text-stone-800 group-hover:text-brand-700">
                {l.label} <span aria-hidden="true" className="text-stone-300 group-hover:text-brand-500">→</span>
              </p>
              <p className="mt-0.5 text-xs text-stone-500">{l.description}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

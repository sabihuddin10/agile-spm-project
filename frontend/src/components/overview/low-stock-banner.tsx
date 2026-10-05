import Link from 'next/link';
import type { InventoryItem } from '@/types';

/**
 * US8.4 — low-stock alert: lists every ingredient at or below its reorder level
 * and links to the inventory screen. Renders nothing when stock is healthy.
 */
export function LowStockBanner({ items }: { items: InventoryItem[] }) {
  const low = items.filter((i) => i.lowStock).sort((a, b) => a.stock / (a.reorderLevel || 1) - b.stock / (b.reorderLevel || 1));
  if (low.length === 0) return null;

  return (
    <section
      aria-labelledby="low-stock-heading"
      className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-start"
    >
      <svg className="h-5 w-5 shrink-0 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
        />
      </svg>
      <div className="min-w-0 flex-1">
        <h2 id="low-stock-heading" className="text-sm font-semibold text-red-800">
          Low stock: {low.length} ingredient{low.length === 1 ? ' is' : 's are'} at or below the reorder level
        </h2>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {low.map((i) => (
            <li key={i.id} className="rounded-full border border-red-200 bg-white px-2.5 py-0.5 text-xs text-stone-700">
              <span className="font-medium text-stone-900">{i.name}</span> — {i.stock} {i.unit}{' '}
              <span className="text-stone-500">
                (reorder at {i.reorderLevel})
              </span>
            </li>
          ))}
        </ul>
      </div>
      <Link href="/staff/inventory" className="btn-secondary shrink-0 !border-red-200 !text-red-700 hover:!bg-red-100">
        Review inventory
      </Link>
    </section>
  );
}

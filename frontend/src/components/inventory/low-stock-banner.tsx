'use client';

import type { InventoryItem } from '@/types';
import { qty } from './helpers';

/**
 * Prominent low-stock alert (US8.4): how many ingredients are at/below their
 * reorder level, which ones, and a jump to the reorder form for managers.
 */
export function LowStockBanner({
  items,
  nearCount,
  canReorder,
  onOpenReorder,
}: {
  /** Ingredients at or below their reorder level. */
  items: InventoryItem[];
  nearCount: number;
  canReorder: boolean;
  onOpenReorder: () => void;
}) {
  if (items.length === 0) {
    return (
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        <span aria-hidden="true">✓</span>
        <span className="font-medium">All ingredients are above their reorder levels.</span>
        {nearCount > 0 ? (
          <span className="text-emerald-700">
            {nearCount} {nearCount === 1 ? 'is' : 'are'} getting close — see the “Near” filter.
          </span>
        ) : null}
      </div>
    );
  }

  const shown = items.slice(0, 6);
  return (
    <div
      role="alert"
      className="mb-4 flex flex-col gap-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3 sm:flex-row sm:items-center"
    >
      <div className="flex items-start gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-600 text-base font-bold text-white"
          aria-hidden="true"
        >
          {items.length}
        </span>
        <div className="text-sm">
          <p className="font-semibold text-red-800">
            {items.length} ingredient{items.length === 1 ? ' is' : 's are'} at or below reorder level
          </p>
          <p className="mt-0.5 text-red-700">
            {shown.map((i, idx) => (
              <span key={i.id}>
                {idx > 0 ? ', ' : ''}
                <span className="font-medium">{i.name}</span>{' '}
                <span className="text-red-600/80">
                  ({qty(i.stock)}/{qty(i.reorderLevel)} {i.unit})
                </span>
              </span>
            ))}
            {items.length > shown.length ? ` and ${items.length - shown.length} more` : ''}
            {nearCount > 0 ? <span className="text-red-600/80"> · {nearCount} more near reorder</span> : null}
          </p>
        </div>
      </div>
      {canReorder ? (
        <button type="button" className="btn-danger shrink-0 sm:ml-auto" onClick={onOpenReorder}>
          Open reorder form →
        </button>
      ) : (
        <p className="shrink-0 text-xs text-red-700 sm:ml-auto sm:max-w-[14rem]">
          Managers have been alerted and can raise a supplier reorder.
        </p>
      )}
    </div>
  );
}

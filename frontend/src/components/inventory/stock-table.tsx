'use client';

import { useMemo, useState } from 'react';
import type { InventoryItem, StockHealth } from '@/types';
import { money } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { HEALTH, qty } from './helpers';

type HealthFilter = 'all' | Exclude<StockHealth, 'ok'>;

const BAR: Record<StockHealth, string> = { ok: 'bg-emerald-500', near: 'bg-amber-500', low: 'bg-red-500' };

/**
 * Ingredient stock table with search and health filter (US8.1): stock vs
 * reorder level, cost, supplier, health badge and the dishes that use each
 * ingredient. Actions appear only for permitted roles.
 */
export function StockTable({
  items,
  canAdjust,
  canManage,
  busyId,
  onAdjust,
  onEdit,
  onDelete,
  onHistory,
}: {
  items: InventoryItem[];
  canAdjust: boolean;
  canManage: boolean;
  busyId?: string | null;
  onAdjust: (item: InventoryItem) => void;
  onEdit: (item: InventoryItem) => void;
  onDelete: (item: InventoryItem) => void;
  onHistory: (item: InventoryItem) => void;
}) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<HealthFilter>('all');

  const counts = useMemo(
    () => ({
      all: items.length,
      low: items.filter((i) => i.health === 'low').length,
      near: items.filter((i) => i.health === 'near').length,
    }),
    [items],
  );

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter((i) => filter === 'all' || i.health === filter)
      .filter((i) => !q || [i.name, i.category, i.supplier, ...i.usedBy].some((s) => s.toLowerCase().includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items, filter, search]);

  const filters: { id: HealthFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'low', label: 'Low' },
    { id: 'near', label: 'Near' },
  ];

  return (
    <div>
      <div className="flex flex-col gap-3 border-b border-stone-100 p-4 sm:flex-row sm:items-center">
        <input
          type="search"
          className="input sm:max-w-xs"
          placeholder="Search ingredient, category, supplier, dish…"
          aria-label="Search ingredients"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex gap-1.5" role="group" aria-label="Filter by stock health">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                filter === f.id
                  ? f.id === 'low'
                    ? 'border-red-300 bg-red-50 text-red-700'
                    : f.id === 'near'
                      ? 'border-amber-300 bg-amber-50 text-amber-700'
                      : 'border-brand-300 bg-brand-50 text-brand-700'
                  : 'border-stone-200 bg-white text-stone-500 hover:bg-stone-50'
              }`}
            >
              {f.label} <span className="opacity-70">({counts[f.id]})</span>
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="py-12 text-center text-sm text-stone-400">No ingredients match.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table-base min-w-[980px]">
            <thead>
              <tr>
                <th>Ingredient</th>
                <th>Category</th>
                <th>In stock</th>
                <th>Reorder at</th>
                <th>Cost / unit</th>
                <th>Supplier</th>
                <th>Health</th>
                <th>Used in</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((item) => {
                const fill = item.reorderLevel > 0 ? Math.min(100, (item.stock / (item.reorderLevel * 2)) * 100) : 100;
                const busy = busyId === item.id;
                return (
                  <tr
                    key={item.id}
                    className={item.health === 'low' ? 'bg-red-50/50' : item.health === 'near' ? 'bg-amber-50/40' : ''}
                  >
                    <td className="font-medium text-stone-800">{item.name}</td>
                    <td className="text-stone-500">{item.category}</td>
                    <td>
                      <span className="font-semibold">
                        {qty(item.stock)} {item.unit}
                      </span>
                      <span className="mt-1 block h-1 w-20 overflow-hidden rounded-full bg-stone-200" aria-hidden="true">
                        <span className={`block h-full ${BAR[item.health]}`} style={{ width: `${fill}%` }} />
                      </span>
                    </td>
                    <td className="text-stone-500">
                      {qty(item.reorderLevel)} {item.unit}
                    </td>
                    <td className="text-stone-500">{money(item.costPerUnit)}</td>
                    <td className="text-stone-500">{item.supplier || '—'}</td>
                    <td>
                      <Badge tone={HEALTH[item.health].tone}>{HEALTH[item.health].label}</Badge>
                    </td>
                    <td className="max-w-[200px] text-xs text-stone-500" title={item.usedBy.join(', ')}>
                      {item.usedBy.length === 0 ? (
                        <span className="text-stone-300">Not in any recipe</span>
                      ) : (
                        <>
                          {item.usedBy.slice(0, 2).join(', ')}
                          {item.usedBy.length > 2 ? <span className="text-stone-400"> +{item.usedBy.length - 2} more</span> : null}
                        </>
                      )}
                    </td>
                    <td>
                      <div className="flex justify-end gap-1">
                        {canAdjust ? (
                          <button
                            className="btn-secondary !px-2.5 !py-1 text-xs"
                            disabled={busy}
                            onClick={() => onAdjust(item)}
                          >
                            Adjust
                          </button>
                        ) : null}
                        <button
                          className="btn-ghost !px-2 !py-1 text-xs"
                          onClick={() => onHistory(item)}
                          aria-label={`Stock history for ${item.name}`}
                        >
                          History
                        </button>
                        {canManage ? (
                          <>
                            <button className="btn-ghost !px-2 !py-1 text-xs" disabled={busy} onClick={() => onEdit(item)}>
                              Edit
                            </button>
                            <button
                              className="btn-ghost !px-2 !py-1 text-xs text-red-600 hover:bg-red-50"
                              disabled={busy}
                              onClick={() => onDelete(item)}
                            >
                              Delete
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

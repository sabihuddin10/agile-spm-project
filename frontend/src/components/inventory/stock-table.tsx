'use client';

import { useMemo, useState } from 'react';
import type { InventoryItem, StockHealth } from '@/types';
import { money } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { HEALTH, qty } from './helpers';

type HealthFilter = 'all' | Exclude<StockHealth, 'ok'>;

const BAR: Record<StockHealth, string> = { ok: 'bg-emerald-500', near: 'bg-amber-500', low: 'bg-red-500' };
const ROW_TINT: Record<StockHealth, string> = { ok: '', near: 'bg-amber-50/40', low: 'bg-red-50/50' };

function StockBar({ item }: { item: InventoryItem }) {
  const fill = item.reorderLevel > 0 ? Math.min(100, (item.stock / (item.reorderLevel * 2)) * 100) : 100;
  return (
    <span className="mt-1 block h-1 w-20 overflow-hidden rounded-full bg-stone-200" aria-hidden="true">
      <span className={`block h-full ${BAR[item.health]}`} style={{ width: `${fill}%` }} />
    </span>
  );
}

function UsedBy({ item }: { item: InventoryItem }) {
  if (item.usedBy.length === 0) return <span>Not in any recipe</span>;
  return (
    <>
      {item.usedBy.slice(0, 2).join(', ')}
      {item.usedBy.length > 2 ? <span> +{item.usedBy.length - 2} more</span> : null}
    </>
  );
}

/**
 * Ingredient stock list with search and health filter (US8.1): stock vs
 * reorder level, cost, supplier, health badge and the dishes that use each
 * ingredient. A table from md up, stacked cards on phones and small tablets.
 * Actions appear only for permitted roles.
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
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by stock health">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                filter === f.id
                  ? f.id === 'low'
                    ? 'border-red-300 bg-red-50 text-red-700'
                    : f.id === 'near'
                      ? 'border-amber-300 bg-amber-50 text-amber-700'
                      : 'border-brand-300 bg-brand-50 text-brand-700'
                  : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
              }`}
            >
              {f.label} <span className="opacity-70">({counts[f.id]})</span>
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="py-12 text-center text-sm text-stone-500">No ingredients match.</p>
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden overflow-x-auto md:block">
            <table className="table-base min-w-[980px]">
              <thead>
                <tr>
                  <th>Ingredient</th>
                  <th>Category</th>
                  <th>In stock</th>
                  <th>Reorder at</th>
                  <th className="text-right">Cost / unit</th>
                  <th>Supplier</th>
                  <th>Health</th>
                  <th>Used in</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((item) => {
                  const busy = busyId === item.id;
                  return (
                    <tr key={item.id} className={ROW_TINT[item.health]}>
                      <td className="font-medium text-stone-800">{item.name}</td>
                      <td className="text-stone-500">{item.category}</td>
                      <td>
                        <span className="font-semibold tabular-nums">
                          {qty(item.stock)} {item.unit}
                        </span>
                        <StockBar item={item} />
                      </td>
                      <td className="tabular-nums text-stone-500">
                        {qty(item.reorderLevel)} {item.unit}
                      </td>
                      <td className="text-right tabular-nums text-stone-500">{money(item.costPerUnit)}</td>
                      <td className="text-stone-500">{item.supplier || '—'}</td>
                      <td>
                        <Badge tone={HEALTH[item.health].tone}>{HEALTH[item.health].label}</Badge>
                      </td>
                      <td className="max-w-[200px] text-xs text-stone-500" title={item.usedBy.join(', ')}>
                        <UsedBy item={item} />
                      </td>
                      <td>
                        <div className="flex justify-end gap-1">
                          {canAdjust ? (
                            <button
                              type="button"
                              className="btn-sm btn-secondary"
                              disabled={busy}
                              onClick={() => onAdjust(item)}
                              aria-label={`Adjust ${item.name}`}
                            >
                              Adjust
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="btn-sm btn-ghost"
                            onClick={() => onHistory(item)}
                            aria-label={`Stock history for ${item.name}`}
                          >
                            History
                          </button>
                          {canManage ? (
                            <>
                              <button
                                type="button"
                                className="btn-sm btn-ghost"
                                disabled={busy}
                                onClick={() => onEdit(item)}
                                aria-label={`Edit ${item.name}`}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="btn-sm btn-ghost text-red-600 hover:bg-red-50"
                                disabled={busy}
                                onClick={() => onDelete(item)}
                                aria-label={`Delete ${item.name}`}
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

          {/* Phones and small tablets */}
          <ul className="divide-y divide-stone-100 md:hidden" aria-label="Ingredients">
            {shown.map((item) => {
              const busy = busyId === item.id;
              return (
                <li key={item.id} className={`space-y-3 px-4 py-4 ${ROW_TINT[item.health]}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-stone-900">{item.name}</p>
                      <p className="text-xs text-stone-500">
                        {item.category}
                        {item.supplier ? ` · ${item.supplier}` : ''}
                      </p>
                    </div>
                    <Badge tone={HEALTH[item.health].tone}>{HEALTH[item.health].label}</Badge>
                  </div>
                  <div className="flex items-end justify-between gap-3 text-sm">
                    <div>
                      <span className="font-semibold tabular-nums">
                        {qty(item.stock)} {item.unit}
                      </span>
                      <StockBar item={item} />
                    </div>
                    <p className="text-right text-xs tabular-nums text-stone-500">
                      Reorder at {qty(item.reorderLevel)} {item.unit}
                      <span className="block">
                        {money(item.costPerUnit)} / {item.unit}
                      </span>
                    </p>
                  </div>
                  <p className="text-xs text-stone-500">
                    <UsedBy item={item} />
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {canAdjust ? (
                      <button
                        type="button"
                        className="btn-sm btn-secondary w-full"
                        disabled={busy}
                        onClick={() => onAdjust(item)}
                        aria-label={`Adjust ${item.name}`}
                      >
                        Adjust
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="btn-sm btn-secondary w-full"
                      onClick={() => onHistory(item)}
                      aria-label={`Stock history for ${item.name}`}
                    >
                      History
                    </button>
                    {canManage ? (
                      <>
                        <button
                          type="button"
                          className="btn-sm btn-secondary w-full"
                          disabled={busy}
                          onClick={() => onEdit(item)}
                          aria-label={`Edit ${item.name}`}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn-sm btn-secondary w-full text-red-600 hover:bg-red-50"
                          disabled={busy}
                          onClick={() => onDelete(item)}
                          aria-label={`Delete ${item.name}`}
                        >
                          Delete
                        </button>
                      </>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

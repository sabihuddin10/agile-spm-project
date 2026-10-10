'use client';

import type { InventoryItem, StockMovement } from '@/types';
import { formatDateTime, timeAgo } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { MOVEMENT_REASON, movementLabel, qty, signedQty } from './helpers';

/**
 * Stock movement log (US8.3 evidence): every sale deduction, restock, wastage
 * and stock count with the resulting stock level. Optionally filtered to one
 * ingredient.
 */
export function StockMovements({
  movements,
  inventory,
  inventoryId,
  onFilterChange,
  loading,
}: {
  movements: StockMovement[];
  inventory: InventoryItem[];
  /** '' = all ingredients. */
  inventoryId: string;
  onFilterChange: (inventoryId: string) => void;
  loading?: boolean;
}) {
  const saleCount = movements.filter((m) => m.reason === 'sale').length;

  return (
    <div>
      <div className="flex flex-col gap-3 border-b border-stone-100 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-semibold text-stone-800">Stock movements</h2>
          <p className="mt-0.5 max-w-2xl text-sm text-stone-500">
            Closing an order (served + paid) deducts each dish&apos;s recipe automatically — those rows show as{' '}
            <span className="font-medium text-brand-700">Sale #order</span>. Deliveries, wastage, stock counts and
            received purchase orders are logged here too.
          </p>
        </div>
        <select
          className="input sm:w-56"
          aria-label="Filter movements by ingredient"
          value={inventoryId}
          onChange={(e) => onFilterChange(e.target.value)}
        >
          <option value="">All ingredients</option>
          {[...inventory]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
        </select>
      </div>

      {loading && movements.length === 0 ? (
        <Spinner label="Loading movements…" />
      ) : movements.length === 0 ? (
        <p className="px-4 py-12 text-center text-sm text-stone-500">
          No stock movements yet. Once an order is served and paid it closes and its recipes are deducted; stock
          adjustments and received purchase orders appear here too.
        </p>
      ) : (
        <>
          {/* Phones */}
          <ul className="divide-y divide-stone-100 sm:hidden" aria-label="Stock movements">
            {movements.map((m) => (
              // Name, reason and time on the left; change over stock-after on the right.
              <li key={m.id} className="flex items-start gap-2.5 px-3.5 py-2.5">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-sm font-medium text-stone-800">{m.name}</p>
                    <Badge tone={MOVEMENT_REASON[m.reason]?.tone ?? 'stone'}>{movementLabel(m)}</Badge>
                  </div>
                  <p className="text-xs text-stone-500">
                    {formatDateTime(m.at)} · {timeAgo(m.at)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <p
                    className={`text-sm font-semibold tabular-nums ${m.delta >= 0 ? 'text-emerald-700' : 'text-red-600'}`}
                  >
                    {signedQty(m.delta, m.unit)}
                  </p>
                  <span className="text-xs tabular-nums text-stone-500">
                    {qty(m.stockAfter)} {m.unit} after
                  </span>
                </div>
              </li>
            ))}
          </ul>

          <div className="hidden overflow-x-auto sm:block">
            <table className="table-base min-w-[640px]">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Ingredient</th>
                  <th className="text-right">Change</th>
                  <th>Reason</th>
                  <th className="text-right">Stock after</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id}>
                    <td className="whitespace-nowrap">
                      <span className="block text-stone-700">{formatDateTime(m.at)}</span>
                      <span className="block text-xs text-stone-500">{timeAgo(m.at)}</span>
                    </td>
                    <td className="font-medium text-stone-800">{m.name}</td>
                    <td
                      className={`whitespace-nowrap text-right font-semibold tabular-nums ${
                        m.delta >= 0 ? 'text-emerald-700' : 'text-red-600'
                      }`}
                    >
                      {signedQty(m.delta, m.unit)}
                    </td>
                    <td>
                      <Badge tone={MOVEMENT_REASON[m.reason]?.tone ?? 'stone'}>{movementLabel(m)}</Badge>
                    </td>
                    <td className="whitespace-nowrap text-right tabular-nums text-stone-600">
                      {qty(m.stockAfter)} {m.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-4 py-3 text-xs text-stone-500">
            Showing the latest {movements.length} movement{movements.length === 1 ? '' : 's'}
            {saleCount ? ` · ${saleCount} from order sales` : ''}. Refreshes every 10 seconds.
          </p>
        </>
      )}
    </div>
  );
}

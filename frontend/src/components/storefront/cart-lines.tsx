'use client';

import type { CartLine } from '@/context/cart-context';
import { QtyStepper } from '@/components/storefront/qty-stepper';
import { priceSelections, unitPriceFor } from '@/lib/menu';
import { modifierText, money } from '@/lib/format';

/** Unit price and line total for a cart line, in exact cents (base + modifier deltas). */
export function linePricing(line: CartLine): { unit: number; total: number } {
  const unit = unitPriceFor(line.item, line.modifiers);
  return { unit, total: (Math.round(unit * 100) * line.qty) / 100 };
}

/**
 * Cart lines with their chosen options and price deltas, per-line quantity
 * controls and correct line totals (US2.3).
 */
export function CartLines({
  lines,
  onQty,
  onRemove,
  flagged = [],
  disabled = false,
}: {
  lines: CartLine[];
  onQty: (key: string, delta: number) => void;
  onRemove?: (key: string) => void;
  /** Line keys the server rejected (e.g. the dish just sold out). */
  flagged?: string[];
  disabled?: boolean;
}) {
  return (
    <ul className="divide-y divide-char-hairline">
      {lines.map((l) => {
        const { unit, total } = linePricing(l);
        const options = modifierText(priceSelections(l.item, l.modifiers));
        const isFlagged = flagged.includes(l.key);
        return (
          <li key={l.key} className="flex items-start gap-2.5 py-2.5 sm:gap-3 sm:py-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-bone">{l.item.name}</p>
              {options ? <p className="mt-0.5 text-xs leading-relaxed text-bone-dim">{options}</p> : null}
              <p className="mt-1 text-xs text-bone-faint">{money(unit)} each</p>
              {isFlagged ? (
                <p className="mt-1.5 text-xs font-medium text-red-300">
                  No longer available — remove it to continue.
                  {onRemove ? (
                    <button
                      type="button"
                      className="ml-2 underline underline-offset-2 hover:text-red-200"
                      onClick={() => onRemove(l.key)}
                    >
                      Remove
                    </button>
                  ) : null}
                </p>
              ) : null}
            </div>
            {/* Line total over the stepper on the right, so the row never wraps onto a second line. */}
            <div className="flex shrink-0 flex-col items-end gap-1 sm:gap-1.5">
              <span className="text-sm font-semibold text-bone">{money(total)}</span>
              <QtyStepper
                size="sm"
                value={l.qty}
                itemName={l.item.name}
                onDecrement={() => onQty(l.key, -1)}
                onIncrement={() => onQty(l.key, 1)}
                disabled={disabled}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

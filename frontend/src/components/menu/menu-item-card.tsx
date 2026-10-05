'use client';

import { useState } from 'react';
import type { MenuItem, ModifierSelection } from '@/types';
import { allergyConflicts, defaultSelections } from '@/lib/menu';
import { money } from '@/lib/format';
import { AllergyWarning, ItemOptionsModal } from '@/components/storefront/item-options-modal';

/**
 * A dish on the public menu. Shows dietary tags and allergens, flags allergens
 * on the signed-in customer's allergy list (US2.4), shows why an item is out of
 * stock and blocks adding it (US2.5), and opens the options dialog for dishes
 * with modifiers (US2.3).
 */
export function MenuItemCard({
  item,
  onAdd,
  canOrder = false,
  allergies,
}: {
  item: MenuItem;
  /** Add to the cart; for users who cannot order this explains why. */
  onAdd: (item: MenuItem, modifiers: ModifierSelection[], qty: number) => boolean | void;
  /** Signed-in customer — only then does the options dialog open. */
  canOrder?: boolean;
  /** The signed-in customer's recorded allergies. */
  allergies?: string[];
}) {
  const [choosing, setChoosing] = useState(false);
  const unavailable = !item.available;
  const conflicts = allergyConflicts(item, allergies);
  const conflictSet = new Set(conflicts.map((c) => c.toLowerCase()));
  const hasOptions = item.modifiers.length > 0;

  function handleAdd() {
    if (unavailable) return;
    if (hasOptions && canOrder) setChoosing(true);
    else onAdd(item, defaultSelections(item), 1);
  }

  function confirmAdd(modifiers: ModifierSelection[], qty: number) {
    if (onAdd(item, modifiers, qty) !== false) setChoosing(false);
  }

  return (
    <div className={`card flex flex-col ${conflicts.length > 0 ? '!border-red-400/40' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-xl font-semibold tracking-tight text-bone">{item.name}</h3>
        <span className="shrink-0 text-right font-medium text-ember-soft">
          {money(item.price)}
          {hasOptions && item.modifiers.some((g) => g.options.some((o) => o.priceDelta > 0)) ? (
            <span className="block text-[11px] font-normal text-bone-faint">options available</span>
          ) : null}
        </span>
      </div>

      <p className="mt-1.5 line-clamp-2 flex-1 text-sm leading-relaxed text-bone-dim">{item.description}</p>

      {conflicts.length > 0 ? (
        <div className="mt-3">
          <AllergyWarning conflicts={conflicts} compact />
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        {item.dietaryTags.map((t) => (
          <span key={t} className="chip chip-diet">
            {t}
          </span>
        ))}
        {item.allergens.map((a) => (
          <span
            key={a}
            className={`chip ${conflictSet.has(a.toLowerCase()) ? 'border-red-400/40 bg-red-500/15 text-red-200' : 'chip-allergen'}`}
            title={`Contains ${a}`}
          >
            {a}
          </span>
        ))}
        {unavailable ? <span className="chip chip-muted">{item.outOfStockReason || 'Unavailable'}</span> : null}
      </div>

      <button
        type="button"
        disabled={unavailable}
        title={unavailable ? item.outOfStockReason || 'Temporarily unavailable' : undefined}
        onClick={handleAdd}
        className="btn-primary mt-5 w-full !py-2 text-sm disabled:opacity-40"
        aria-label={unavailable ? `${item.name} is unavailable` : `Add ${item.name} to order`}
      >
        {unavailable ? 'Unavailable' : 'Add to order'}
      </button>

      {choosing ? (
        <ItemOptionsModal item={item} conflicts={conflicts} onAdd={confirmAdd} onClose={() => setChoosing(false)} />
      ) : null}
    </div>
  );
}

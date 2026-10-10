'use client';

import { useState } from 'react';
import type { MenuItem, ModifierSelection } from '@/types';
import { Modal } from '@/components/ui/modal';
import { ModifierPicker } from '@/components/menu/modifier-picker';
import { QtyStepper } from '@/components/storefront/qty-stepper';
import { defaultSelections, unitPriceFor } from '@/lib/menu';
import { money } from '@/lib/format';

/**
 * Customise a dish before adding it (US2.3): modifier choices with price deltas,
 * a quantity stepper and a live line price (unit price incl. options × qty).
 */
export function ItemOptionsModal({
  item,
  conflicts,
  onAdd,
  onClose,
}: {
  item: MenuItem;
  /** Allergens on this dish that are on the customer's allergy list (US2.4). */
  conflicts: string[];
  onAdd: (modifiers: ModifierSelection[], qty: number) => void;
  onClose: () => void;
}) {
  const [selections, setSelections] = useState<ModifierSelection[]>(() => defaultSelections(item));
  const [qty, setQty] = useState(1);

  const unit = unitPriceFor(item, selections);
  const lineTotal = Math.round(unit * 100 * qty) / 100;

  return (
    <Modal title={item.name} onClose={onClose} dark>
      <div className="space-y-4 sm:space-y-5">
        {item.description ? <p className="text-sm leading-relaxed text-bone-dim">{item.description}</p> : null}

        {conflicts.length > 0 ? <AllergyWarning conflicts={conflicts} /> : null}

        <ModifierPicker item={item} value={selections} onChange={setSelections} dark />

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-char-hairline pt-3 sm:gap-4 sm:pt-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-bone-dim">Quantity</span>
            <QtyStepper
              value={qty}
              onDecrement={() => setQty((q) => Math.max(1, q - 1))}
              onIncrement={() => setQty((q) => Math.min(99, q + 1))}
              itemName={item.name}
              min={1}
            />
          </div>
          <p className="text-sm text-bone-dim">
            {money(unit)} each
          </p>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={() => onAdd(selections, qty)}>
            Add {qty > 1 ? `${qty} ` : ''}to order · {money(lineTotal)}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** "⚠ Contains peanuts — on your allergy list" (US2.4). The dish stays orderable. */
export function AllergyWarning({ conflicts, compact = false }: { conflicts: string[]; compact?: boolean }) {
  const text = `⚠ Contains ${conflicts.join(', ')} — on your allergy list`;
  if (compact) {
    return (
      <span role="note" className="chip border-red-400/40 bg-red-500/15 font-semibold text-red-200">
        {text}
      </span>
    );
  }
  return (
    <p role="note" className="rounded-xl border border-red-400/40 bg-red-500/10 px-3.5 py-2.5 text-sm font-medium text-red-200">
      {text}
    </p>
  );
}

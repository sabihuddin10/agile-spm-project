import type { MenuItem, ModifierSelection, SelectedModifier } from '@/types';

/** Default selections: the first option of every single-choice group (e.g. Size → Regular). */
export function defaultSelections(item: MenuItem): ModifierSelection[] {
  return item.modifiers
    .filter((g) => g.type === 'single' && g.options.length > 0)
    .map((g) => ({ group: g.name, label: g.options[0].label }));
}

/** Price the selections the same way the server does (base + option deltas). */
export function priceSelections(item: MenuItem, selections: ModifierSelection[]): SelectedModifier[] {
  return selections.flatMap((s) => {
    const option = item.modifiers.find((g) => g.name === s.group)?.options.find((o) => o.label === s.label);
    return option ? [{ ...s, priceDelta: option.priceDelta }] : [];
  });
}

export function unitPriceFor(item: MenuItem, selections: ModifierSelection[]): number {
  const cents =
    Math.round(item.price * 100) +
    priceSelections(item, selections).reduce((sum, m) => sum + Math.round(m.priceDelta * 100), 0);
  return cents / 100;
}

/** Stable key for "same dish with the same options" (used to merge cart lines). */
export function selectionKey(menuItemId: string, selections: ModifierSelection[]): string {
  const parts = selections.map((s) => `${s.group}:${s.label}`).sort();
  return [menuItemId, ...parts].join('|');
}

/** Allergens on a dish that clash with a customer's recorded allergies (US2.4). */
export function allergyConflicts(item: MenuItem, allergies: string[] | undefined): string[] {
  const mine = new Set((allergies ?? []).map((a) => a.toLowerCase()));
  return item.allergens.filter((a) => mine.has(a.toLowerCase()));
}

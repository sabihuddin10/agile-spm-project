import type { InventoryItem, RecipeLine, StockHealth, StockMovement } from '@/types';
import type { Tone } from '@/lib/format';

/** Badge label/tone for each stock health level (US8.1, US8.4). */
export const HEALTH: Record<StockHealth, { label: string; tone: Tone }> = {
  ok: { label: 'OK', tone: 'emerald' },
  near: { label: 'Near reorder', tone: 'amber' },
  low: { label: 'Low · reorder', tone: 'red' },
};

/** Stock quantities can be fractional after recipe deductions: show up to 3 decimals. */
export function qty(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

/** '+5 kg' / '−0.15 kg' (true minus sign). */
export function signedQty(n: number, unit: string): string {
  return `${n >= 0 ? '+' : '−'}${qty(Math.abs(n))} ${unit}`;
}

export const MOVEMENT_REASON: Record<StockMovement['reason'], { label: string; tone: Tone }> = {
  sale: { label: 'Sale', tone: 'brand' },
  restock: { label: 'Restock', tone: 'emerald' },
  wastage: { label: 'Wastage', tone: 'red' },
  count: { label: 'Stock count', tone: 'blue' },
};

export function movementLabel(m: StockMovement): string {
  if (m.reason === 'sale' && m.orderNumber != null) return `Sale #${m.orderNumber}`;
  return MOVEMENT_REASON[m.reason]?.label ?? m.reason;
}

/** Mirrors the server's reorder suggestion: top stock back up to twice the reorder level. */
export function suggestedQty(item: Pick<InventoryItem, 'stock' | 'reorderLevel' | 'unit'>): number {
  const raw = Math.max(item.reorderLevel * 2 - item.stock, item.reorderLevel, 1);
  return ['units', 'dozen', 'boxes'].includes(item.unit) ? Math.ceil(raw) : Math.ceil(raw * 10) / 10;
}

/** Food cost of one portion of a dish from its bill of materials. */
export function recipeCost(recipe: Pick<RecipeLine, 'inventoryId' | 'qty'>[], inventory: InventoryItem[]): number {
  return recipe.reduce((sum, line) => {
    const ing = inventory.find((i) => i.id === line.inventoryId);
    return sum + (ing ? ing.costPerUnit * line.qty : 0);
  }, 0);
}

/** Parse a numeric text input; NaN when blank or invalid. */
export function toNumber(value: string): number {
  return value.trim() === '' ? Number.NaN : Number(value);
}

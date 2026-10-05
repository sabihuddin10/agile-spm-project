import type { TableStatus } from '@/types';
import { TABLE_STATUS, type Tone } from '@/lib/format';

const TILE: Partial<Record<Tone, string>> = {
  emerald: 'border-emerald-200 border-l-emerald-500 bg-emerald-50/60',
  amber: 'border-amber-200 border-l-amber-500 bg-amber-50/60',
  blue: 'border-blue-200 border-l-blue-500 bg-blue-50/60',
  stone: 'border-stone-300 border-l-stone-400 bg-stone-100/80',
};

const DOT: Partial<Record<Tone, string>> = {
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  blue: 'bg-blue-500',
  stone: 'bg-stone-400',
};

/** Tile background/border for a table status (colours follow TABLE_STATUS tones). */
export function tileClass(status: TableStatus): string {
  return TILE[TABLE_STATUS[status].tone] ?? TILE.stone!;
}

/** Small swatch colour for a table status. */
export function dotClass(status: TableStatus): string {
  return DOT[TABLE_STATUS[status].tone] ?? DOT.stone!;
}

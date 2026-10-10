/**
 * Colour sets for the shared form pieces. "light" is the staff console (stone
 * on white); "dark" is the storefront (bone on charcoal), where the -700 shades
 * would be too dark to read, so lighter shades of the same hues are used.
 */
export type Tone = 'light' | 'dark';

export const TONES = {
  light: {
    met: 'text-emerald-700',
    pending: 'text-stone-500',
    error: 'text-red-600',
    hint: 'text-stone-500',
    track: 'bg-stone-200',
    weak: 'bg-red-500',
    fair: 'bg-amber-500',
    strong: 'bg-emerald-600',
    toggle: 'text-stone-500 hover:text-stone-800 focus-visible:ring-brand-500',
    inputError: 'border-red-400 focus:border-red-500 focus:ring-red-500',
  },
  dark: {
    met: 'text-emerald-300',
    pending: 'text-bone-dim',
    error: 'text-red-300',
    hint: 'text-bone-faint',
    track: 'bg-char-hairline',
    weak: 'bg-red-400',
    fair: 'bg-amber-400',
    strong: 'bg-emerald-400',
    toggle: 'text-bone-dim hover:text-bone focus-visible:ring-ember',
    inputError: '!border-red-400/70 focus:!border-red-400 focus:!ring-red-400',
  },
} as const;

import type { ReactNode } from 'react';
import type { Tone } from '@/lib/format';

const DARK_TONES: Record<Tone, string> = {
  emerald: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
  amber: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
  red: 'border-red-400/30 bg-red-400/10 text-red-300',
  stone: 'border-char-hairline bg-char-deep text-bone-dim',
  brand: 'border-ember/30 bg-ember/10 text-ember-soft',
  blue: 'border-sky-400/30 bg-sky-400/10 text-sky-300',
};

/** Status badge for the dark storefront (the staff <Badge> is tuned for light backgrounds). */
export function StatusPill({ tone, children, className = '' }: { tone: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${DARK_TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

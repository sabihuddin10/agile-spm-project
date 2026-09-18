import type { ReactNode } from 'react';

const tones: Record<string, string> = {
  emerald: 'bg-emerald-100 text-emerald-700',
  amber: 'bg-amber-100 text-amber-700',
  red: 'bg-red-100 text-red-700',
  stone: 'bg-stone-100 text-stone-600',
  brand: 'bg-brand-100 text-brand-700',
  blue: 'bg-blue-100 text-blue-700',
};

export function Badge({
  children,
  tone = 'stone',
  className = '',
}: {
  children: ReactNode;
  tone?: keyof typeof tones;
  className?: string;
}) {
  return <span className={`badge ${tones[tone]} ${className}`}>{children}</span>;
}
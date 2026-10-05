import Link from 'next/link';

/** The Plate & Flame flame glyph. */
export function FlameMark({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12 2c4.2 5 6.5 8.2 6.5 11.6A6.5 6.5 0 0 1 5.5 13.4C5.8 10 8 6.9 12 2Z" opacity="0.32" />
      <path d="M12 7c1.9 3 2.8 4.9 2.8 6.6a2.8 2.8 0 0 1-5.6 0C9.2 11.9 10.1 10 12 7Z" />
    </svg>
  );
}

/** Logo lock-up linking home — used on the sign-in and register screens. */
export function BrandLink({ className = '' }: { className?: string }) {
  return (
    <Link href="/" className={`flex items-center gap-3 ${className}`}>
      <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-char-hairline bg-char-raised text-ember">
        <FlameMark />
      </span>
      <span>
        <span className="block font-display text-xl font-semibold leading-tight tracking-tight text-bone">Plate &amp; Flame</span>
        <span className="block text-xs leading-tight text-bone-faint">Wood-fired bistro</span>
      </span>
    </Link>
  );
}

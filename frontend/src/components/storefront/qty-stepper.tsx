'use client';

/** Compact − qty + control used in the cart and the dish options dialog (storefront theme). */
export function QtyStepper({
  value,
  onDecrement,
  onIncrement,
  itemName,
  min = 0,
  max = 99,
  disabled = false,
  size = 'md',
}: {
  value: number;
  onDecrement: () => void;
  onIncrement: () => void;
  /** Used in the buttons' aria-labels. */
  itemName: string;
  min?: number;
  max?: number;
  disabled?: boolean;
  size?: 'sm' | 'md';
}) {
  const btn = size === 'sm' ? 'h-7 w-7 text-sm' : 'h-9 w-9 text-base';
  return (
    <div className="inline-flex items-center overflow-hidden rounded-pill border border-char-hairline bg-char-deep">
      <button
        type="button"
        className={`${btn} flex items-center justify-center font-bold text-bone-dim transition hover:text-bone disabled:cursor-not-allowed disabled:opacity-40`}
        onClick={onDecrement}
        disabled={disabled || value <= min}
        aria-label={min === 0 && value === 1 ? `Remove ${itemName}` : `One fewer ${itemName}`}
      >
        −
      </button>
      <span className="min-w-[28px] text-center text-sm font-bold text-bone" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        className={`${btn} flex items-center justify-center font-bold text-bone-dim transition hover:text-bone disabled:cursor-not-allowed disabled:opacity-40`}
        onClick={onIncrement}
        disabled={disabled || value >= max}
        aria-label={`One more ${itemName}`}
      >
        +
      </button>
    </div>
  );
}

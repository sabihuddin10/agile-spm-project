import type { MenuItem } from '@/types';

export function MenuItemCard({
  item,
  onAdd,
}: {
  item: MenuItem;
  onAdd?: (item: MenuItem) => void;
}) {
  const unavailable = !item.available;
  return (
    <div className="card flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-xl font-semibold tracking-tight text-bone">
          {item.name}
        </h3>
        <span className="shrink-0 font-medium text-ember-soft">
          ${item.price.toFixed(2)}
        </span>
      </div>

      <p className="mt-1.5 line-clamp-2 flex-1 text-sm leading-relaxed text-bone-dim">
        {item.description}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        {item.dietaryTags.map((t) => (
          <span key={t} className="chip chip-diet">
            {t}
          </span>
        ))}
        {item.allergens.map((a) => (
          <span key={a} className="chip chip-allergen">
            {a}
          </span>
        ))}
        {unavailable ? (
          <span className="chip chip-muted">{item.outOfStockReason || 'Unavailable'}</span>
        ) : null}
      </div>

      <button
        disabled={unavailable}
        title={
          unavailable
            ? 'Temporarily unavailable'
            : onAdd
              ? 'Add to cart'
              : 'Sign in to start ordering'
        }
        onClick={() => onAdd?.(item)}
        className={`btn-primary mt-5 w-full !py-2 text-sm ${unavailable ? 'opacity-40' : ''}`}
      >
        {unavailable ? 'Unavailable' : 'Add to order'}
      </button>
    </div>
  );
}
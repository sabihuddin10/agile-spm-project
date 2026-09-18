'use client';

import type { MenuCategory, MenuItem } from '@/types';
import { Badge } from '@/components/ui/badge';

export function MenuItemList({
  categories,
  onEdit,
  onDelete,
  onToggleAvailability,
}: {
  categories: MenuCategory[];
  onEdit: (item: MenuItem) => void;
  onDelete: (item: MenuItem) => void;
  onToggleAvailability: (item: MenuItem) => void;
}) {
  return (
    <div className="space-y-6">
      {categories.map((cat) => (
        <section key={cat.id}>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-semibold text-stone-800">{cat.name}</h3>
            <span className="text-xs text-stone-400">
              {cat.items?.filter((i) => i.available).length ?? 0} available
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {(cat.items ?? []).map((item) => (
              <MenuItemRow
                key={item.id}
                item={item}
                onEdit={() => onEdit(item)}
                onDelete={() => onDelete(item)}
                onToggleAvailability={() => onToggleAvailability(item)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function MenuItemRow({
  item,
  onEdit,
  onDelete,
  onToggleAvailability,
}: {
  item: MenuItem;
  onEdit: () => void;
  onDelete: () => void;
  onToggleAvailability: () => void;
}) {
  return (
    <div
      className={`rounded-xl border bg-white p-4 transition ${
        item.available ? 'border-stone-200' : 'border-dashed border-stone-300 bg-stone-50'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-stone-800">{item.name}</p>
          <p className="mt-0.5 line-clamp-1 text-sm text-stone-500">{item.description || '—'}</p>
        </div>
        <p className="shrink-0 font-bold text-brand-700">${item.price.toFixed(2)}</p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {item.available ? (
          <Badge tone="emerald">Available</Badge>
        ) : (
          <Badge tone="red" className="normal-case">
            Out of stock · {item.outOfStockReason || 'no reason set'}
          </Badge>
        )}
        {item.dietaryTags.map((t) => (
          <Badge key={t} tone="emerald" className="normal-case">
            {t}
          </Badge>
        ))}
        {item.allergens.map((a) => (
          <Badge key={a} tone="red" className="normal-case">
            ⚠ {a}
          </Badge>
        ))}
      </div>

      {item.modifiers.length > 0 ? (
        <p className="mt-2 text-xs text-stone-400">
          {item.modifiers.map((m) => `${m.name} (${m.options.join(', ')})`).join(' · ')}
        </p>
      ) : null}

      <div className="mt-3 flex gap-1.5">
        <button onClick={onToggleAvailability} className="btn-secondary !px-2.5 !py-1 text-xs">
          {item.available ? 'Mark out of stock' : 'Back in stock'}
        </button>
        <button onClick={onEdit} className="btn-secondary !px-2.5 !py-1 text-xs">
          Edit
        </button>
        <button onClick={onDelete} className="btn-danger !px-2.5 !py-1 text-xs">
          Delete
        </button>
      </div>
    </div>
  );
}
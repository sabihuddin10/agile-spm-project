'use client';

import type { MenuCategory, MenuItem, Modifier } from '@/types';
import { Badge } from '@/components/ui/badge';
import { ExclamationTriangleIcon } from '@/components/ui/icons';
import { money } from '@/lib/format';

/** "Size: Regular, Large +$4.00" (US2.3). */
export function modifierSummary(group: Modifier): string {
  const options = group.options.map((o) => (o.priceDelta ? `${o.label} +${money(o.priceDelta)}` : o.label));
  return `${group.name}: ${options.join(', ')}`;
}

/** What the signed-in role may do to items (mirrors `can.*`). */
export interface MenuItemPermissions {
  /** Add, edit, delete (US2.1). */
  manage: boolean;
  /** Mark out of stock / back in stock (US2.5). */
  toggle: boolean;
  /** See recipe status — waiters never receive item.recipe (chef/manager/admin). */
  viewRecipes: boolean;
  /** Edit the bill of materials (US8.2). */
  recipes: boolean;
}

interface Handlers {
  onEdit: (item: MenuItem) => void;
  onDelete: (item: MenuItem) => void;
  onMarkOut: (item: MenuItem) => void;
  onMarkIn: (item: MenuItem) => void;
  onRecipe: (item: MenuItem) => void;
  onAdd?: (categoryId: string) => void;
}

/**
 * Staff menu grouped by category: availability, dietary/allergen tags,
 * modifier options with price deltas and recipe status, with the actions the
 * role allows (US2.1, US2.2, US2.3, US2.5, US8.2).
 */
export function MenuItemList({
  categories,
  permissions,
  busyId,
  filtered = false,
  ...handlers
}: {
  categories: MenuCategory[];
  permissions: MenuItemPermissions;
  /** Item with an availability change in flight. */
  busyId?: string | null;
  /** A search/filter is active — empty categories are skipped. */
  filtered?: boolean;
} & Handlers) {
  const visible = filtered ? categories.filter((c) => (c.items ?? []).length > 0) : categories;

  if (visible.length === 0) {
    return <p className="py-10 text-center text-sm text-stone-500">No menu items match.</p>;
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {visible.map((cat) => {
        const items = cat.items ?? [];
        const available = items.filter((i) => i.available).length;
        return (
          <section key={cat.id} aria-labelledby={`cat-${cat.id}`}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h3 id={`cat-${cat.id}`} className="font-semibold text-stone-800">
                {cat.name}
              </h3>
              {!cat.active ? <Badge tone="amber">Hidden from customers</Badge> : null}
              {cat.active && (cat.itemCount ?? items.length) === 0 ? (
                <Badge tone="stone">Empty · hidden on customer menu</Badge>
              ) : null}
              <span className="ml-auto text-xs tabular-nums text-stone-500">
                {available}/{items.length} available
              </span>
            </div>

            {items.length === 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-stone-300 px-4 py-5 text-sm text-stone-500">
                <span>No items in this category yet.</span>
                {permissions.manage && handlers.onAdd ? (
                  <button className="btn-sm btn-secondary" onClick={() => handlers.onAdd?.(cat.id)}>
                    + Add item to {cat.name}
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                {items.map((item) => (
                  <MenuItemCard
                    key={item.id}
                    item={item}
                    permissions={permissions}
                    busy={busyId === item.id}
                    {...handlers}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function MenuItemCard({
  item,
  permissions,
  busy,
  onEdit,
  onDelete,
  onMarkOut,
  onMarkIn,
  onRecipe,
}: {
  item: MenuItem;
  permissions: MenuItemPermissions;
  busy: boolean;
} & Handlers) {
  // Recipe status matters to the kitchen and managers, not to waiters.
  const recipe = permissions.viewRecipes ? item.recipe : undefined;
  const hasActions = permissions.toggle || permissions.manage || permissions.recipes;

  return (
    <article
      className={`flex flex-col rounded-xl border p-4 transition ${
        item.available ? 'border-stone-200 bg-white' : 'border-dashed border-red-200 bg-red-50/30'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-stone-800">{item.name}</p>
          <p className="mt-0.5 line-clamp-2 text-sm text-stone-500">{item.description || '—'}</p>
        </div>
        <p className="shrink-0 font-bold tabular-nums text-brand-700">{money(item.price)}</p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {item.available ? <Badge tone="emerald">Available</Badge> : <Badge tone="red">Out of stock</Badge>}
        {item.dietaryTags.map((t) => (
          <Badge key={t} tone="emerald" className="font-medium">
            {t}
          </Badge>
        ))}
        {item.allergens.map((a) => (
          <Badge key={a} tone="red">
            <ExclamationTriangleIcon className="h-3.5 w-3.5" />
            <span className="sr-only">Allergy: </span>
            {a}
          </Badge>
        ))}
      </div>

      {!item.available ? (
        <p className="mt-2 text-xs text-red-700">
          <span className="font-medium">Reason:</span> {item.outOfStockReason || 'not given'}
        </p>
      ) : null}

      {item.modifiers.length > 0 ? (
        <ul className="mt-2 space-y-0.5 text-xs text-stone-500">
          {item.modifiers.map((m) => (
            <li key={m.id || m.name}>
              <span className="font-medium text-stone-600">{m.name}</span>
              <span className="text-stone-500"> ({m.type === 'multi' ? 'multi-select' : 'pick one'})</span>:{' '}
              {m.options.map((o, i) => (
                <span key={o.label}>
                  {i > 0 ? ', ' : ''}
                  {o.label}
                  {o.priceDelta ? <span className="text-brand-700"> +{money(o.priceDelta)}</span> : null}
                </span>
              ))}
            </li>
          ))}
        </ul>
      ) : null}

      {recipe ? (
        recipe.length > 0 ? (
          <p
            className="mt-2 text-xs text-stone-500"
            title={recipe.map((r) => `${r.qty} ${r.unit ?? ''} ${r.name ?? ''}`.trim()).join('\n')}
          >
            <span className="font-medium text-stone-600">Recipe:</span> {recipe.length} ingredient
            {recipe.length === 1 ? '' : 's'}
            <span className="text-stone-500"> · {recipe.map((r) => r.name).join(', ')}</span>
          </p>
        ) : (
          <p className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800">
            No recipe — stock won&apos;t auto-deduct
          </p>
        )
      ) : null}

      {hasActions ? (
        <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
          {permissions.toggle ? (
            item.available ? (
              <button
                onClick={() => onMarkOut(item)}
                disabled={busy}
                className="btn-sm btn-secondary"
              >
                Mark out of stock
              </button>
            ) : (
              <button
                onClick={() => onMarkIn(item)}
                disabled={busy}
                className="btn-sm btn-secondary !border-emerald-300 !text-emerald-700"
              >
                {busy ? 'Updating…' : 'Back in stock'}
              </button>
            )
          ) : null}
          {permissions.recipes ? (
            <button onClick={() => onRecipe(item)} className="btn-sm btn-secondary">
              Recipe
            </button>
          ) : null}
          {permissions.manage ? (
            <>
              <button onClick={() => onEdit(item)} className="btn-sm btn-secondary">
                Edit
              </button>
              <button onClick={() => onDelete(item)} disabled={busy} className="btn-sm btn-danger">
                Delete
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

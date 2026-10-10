'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { InventoryItem, MenuCategory, MenuItem } from '@/types';
import { inventoryApi, menuApi } from '@/lib/api';
import { errorMessage } from '@/lib/format';
import { can } from '@/lib/permissions';
import { useAuth } from '@/context/auth-context';
import { StaffLayout } from '@/components/layout/staff-layout';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Modal } from '@/components/ui/modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';
import { MenuItemList, type MenuItemPermissions } from '@/components/menu/menu-item-list';
import { MenuItemForm } from '@/components/menu/menu-item-form';
import { CategoryManager } from '@/components/menu/category-manager';
import { RecipeEditor } from '@/components/inventory/recipe-editor';

type AvailabilityFilter = 'all' | 'available' | 'out' | 'no-recipe';

const OUT_REASONS = ['Sold out for today', 'Ingredient shortage', 'Supplier delivery delayed', 'Equipment issue'];

/**
 * Staff menu (Sprint 2): waiters browse read-only, chefs toggle availability
 * (US2.5), managers/admins manage items, categories, modifiers and recipes
 * (US2.1–US2.4, US8.2).
 */
export default function MenuPage() {
  const { user } = useAuth();
  const toast = useToast();
  const role = user?.role;
  const permissions: MenuItemPermissions = useMemo(
    () => ({
      manage: can.manageMenu(role),
      toggle: can.toggleAvailability(role),
      viewRecipes: can.viewRecipes(role),
      recipes: can.editRecipes(role),
    }),
    [role],
  );

  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [tags, setTags] = useState<string[] | undefined>();
  const [allergens, setAllergens] = useState<string[] | undefined>();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<AvailabilityFilter>('all');

  const [form, setForm] = useState<{ editing: MenuItem | null; categoryId?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [markingOut, setMarkingOut] = useState<MenuItem | null>(null);
  const [recipeItem, setRecipeItem] = useState<MenuItem | null>(null);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [busyCategoryId, setBusyCategoryId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<
    { kind: 'item'; item: MenuItem } | { kind: 'category'; category: MenuCategory } | null
  >(null);

  const load = useCallback(async () => {
    try {
      const res = await menuApi.get(true);
      setCategories(res.menu);
      setTags(res.tags);
      setAllergens(res.allergens);
    } catch (err) {
      toast(errorMessage(err, 'Failed to load menu.'), 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadInventory = useCallback(async () => {
    try {
      const res = await inventoryApi.list();
      setInventory(res.inventory);
    } catch (err) {
      toast(errorMessage(err, 'Failed to load ingredients.'), 'error');
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (permissions.recipes) loadInventory();
  }, [permissions.recipes, loadInventory]);

  const allItems = useMemo(() => categories.flatMap((c) => c.items ?? []), [categories]);
  const outCount = allItems.filter((i) => !i.available).length;
  const noRecipeCount = allItems.filter((i) => i.recipe && i.recipe.length === 0).length;

  const filtered = search.trim() !== '' || filter !== 'all';
  const shown = useMemo(() => {
    if (!filtered) return categories;
    const q = search.trim().toLowerCase();
    return categories.map((c) => ({
      ...c,
      items: (c.items ?? []).filter((i) => {
        if (filter === 'available' && !i.available) return false;
        if (filter === 'out' && i.available) return false;
        if (filter === 'no-recipe' && !(i.recipe && i.recipe.length === 0)) return false;
        if (!q) return true;
        return [i.name, i.description, ...i.dietaryTags, ...i.allergens].some((s) => s.toLowerCase().includes(q));
      }),
    }));
  }, [categories, filter, filtered, search]);

  /* ------------------------------------------------------------ items */

  async function submitItem(data: Partial<MenuItem>) {
    if (!permissions.manage || !form) return;
    setSaving(true);
    try {
      if (form.editing) {
        await menuApi.updateItem(form.editing.id, data);
        toast(`${data.name ?? 'Menu item'} updated.`, 'success');
      } else {
        await menuApi.createItem(data);
        toast(`${data.name ?? 'Menu item'} added to the menu.`, 'success');
      }
      setForm(null);
      await load();
    } catch (err) {
      toast(errorMessage(err, 'Failed to save menu item.'), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function removeItem(item: MenuItem) {
    if (!permissions.manage) return;
    setBusyItemId(item.id);
    try {
      await menuApi.removeItem(item.id);
      toast(`${item.name} deleted.`, 'success');
      setConfirming(null);
      await load();
    } catch (err) {
      toast(errorMessage(err, 'Failed to delete menu item.'), 'error');
      setConfirming(null);
    } finally {
      setBusyItemId(null);
    }
  }

  async function setAvailability(item: MenuItem, available: boolean, reason = '') {
    if (!permissions.toggle) return false;
    setBusyItemId(item.id);
    try {
      await menuApi.updateItem(item.id, available ? { available: true } : { available: false, outOfStockReason: reason });
      toast(available ? `${item.name} is back in stock.` : `${item.name} marked out of stock.`, 'success');
      await load();
      return true;
    } catch (err) {
      toast(errorMessage(err, 'Failed to update availability.'), 'error');
      return false;
    } finally {
      setBusyItemId(null);
    }
  }

  /* ------------------------------------------------------- categories */

  async function createCategory(name: string) {
    setBusyCategoryId('new');
    try {
      await menuApi.createCategory(name);
      toast(`Category "${name}" added. It stays hidden from customers until it has items.`, 'success');
      await load();
      return true;
    } catch (err) {
      toast(errorMessage(err, 'Failed to create category.'), 'error');
      return false;
    } finally {
      setBusyCategoryId(null);
    }
  }

  async function renameCategory(category: MenuCategory, name: string) {
    setBusyCategoryId(category.id);
    try {
      await menuApi.updateCategory(category.id, { name });
      toast(`Renamed "${category.name}" to "${name}".`, 'success');
      await load();
      return true;
    } catch (err) {
      toast(errorMessage(err, 'Failed to rename category.'), 'error');
      return false;
    } finally {
      setBusyCategoryId(null);
    }
  }

  async function toggleCategory(category: MenuCategory) {
    setBusyCategoryId(category.id);
    try {
      await menuApi.updateCategory(category.id, { active: !category.active });
      toast(
        category.active ? `${category.name} is now hidden from customers.` : `${category.name} is visible to customers again.`,
        'success',
      );
      await load();
    } catch (err) {
      toast(errorMessage(err, 'Failed to update category.'), 'error');
    } finally {
      setBusyCategoryId(null);
    }
  }

  async function deleteCategory(category: MenuCategory) {
    setBusyCategoryId(category.id);
    try {
      await menuApi.removeCategory(category.id);
      toast(`Category "${category.name}" deleted.`, 'success');
      setConfirming(null);
      await load();
    } catch (err) {
      toast(errorMessage(err, 'Failed to delete category.'), 'error');
      setConfirming(null);
    } finally {
      setBusyCategoryId(null);
    }
  }

  /* ------------------------------------------------------------ render */

  const subtitle = permissions.manage
    ? 'Items, categories, modifiers with prices, dietary and allergen tags, availability and recipes.'
    : permissions.toggle
      ? 'Mark dishes out of stock or back in stock as the kitchen runs.'
      : 'Browse the current menu (read-only for your role).';

  const filters: { id: AvailabilityFilter; label: string; count: number; show: boolean }[] = [
    { id: 'all', label: 'All', count: allItems.length, show: true },
    { id: 'available', label: 'Available', count: allItems.length - outCount, show: true },
    { id: 'out', label: 'Out of stock', count: outCount, show: true },
    { id: 'no-recipe', label: 'No recipe', count: noRecipeCount, show: permissions.recipes },
  ];

  return (
    <StaffLayout section="menu">
      <PageHeader
        title={permissions.manage ? 'Menu management' : 'Menu'}
        subtitle={subtitle}
        action={
          permissions.manage ? (
            <button onClick={() => setForm({ editing: null })} className="btn-primary" disabled={categories.length === 0}>
              + Add item
            </button>
          ) : undefined
        }
      />

      <div className={`grid gap-4 ${permissions.manage ? 'lg:grid-cols-[300px_1fr] lg:items-start' : ''}`}>
        {permissions.manage ? (
          <Card className="lg:sticky lg:top-8">
            <CategoryManager
              categories={categories}
              busyId={busyCategoryId}
              onCreate={createCategory}
              onRename={renameCategory}
              onToggleActive={toggleCategory}
              onDelete={(category) => setConfirming({ kind: 'category', category })}
            />
          </Card>
        ) : null}

        <Card className="min-w-0 p-0">
          <div className="flex flex-col gap-3 border-b border-stone-100 p-4 sm:flex-row sm:items-center">
            <input
              type="search"
              className="input sm:max-w-xs"
              placeholder="Search dishes, tags, allergens…"
              aria-label="Search menu"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter menu items">
              {filters
                .filter((f) => f.show)
                .map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    aria-pressed={filter === f.id}
                    onClick={() => setFilter(f.id)}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                      filter === f.id
                        ? 'border-brand-300 bg-brand-50 text-brand-700'
                        : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    {f.label} <span className="opacity-70">({f.count})</span>
                  </button>
                ))}
            </div>
          </div>
          <div className="p-4">
            {loading ? (
              <Spinner label="Loading menu…" />
            ) : categories.length === 0 ? (
              <p className="py-10 text-center text-sm text-stone-500">
                {permissions.manage ? 'Add a category first, then add items to it.' : 'The menu is empty.'}
              </p>
            ) : (
              <MenuItemList
                categories={shown}
                permissions={permissions}
                busyId={busyItemId}
                filtered={filtered}
                onEdit={(item) => setForm({ editing: item })}
                onDelete={(item) => setConfirming({ kind: 'item', item })}
                onMarkOut={setMarkingOut}
                onMarkIn={(item) => setAvailability(item, true)}
                onRecipe={(item) => {
                  setRecipeItem(item);
                  loadInventory();
                }}
                onAdd={(categoryId) => setForm({ editing: null, categoryId })}
              />
            )}
          </div>
        </Card>
      </div>

      {form ? (
        <Modal title={form.editing ? `Edit ${form.editing.name}` : 'Add menu item'} onClose={() => setForm(null)} wide>
          <MenuItemForm
            initial={form.editing}
            categories={categories}
            tags={tags}
            allergens={allergens}
            defaultCategoryId={form.categoryId}
            onSubmit={submitItem}
            onCancel={() => setForm(null)}
            submitting={saving}
          />
        </Modal>
      ) : null}

      {markingOut ? (
        <OutOfStockDialog
          item={markingOut}
          busy={busyItemId === markingOut.id}
          onClose={() => setMarkingOut(null)}
          onConfirm={async (reason) => {
            if (await setAvailability(markingOut, false, reason)) setMarkingOut(null);
          }}
        />
      ) : null}

      {confirming?.kind === 'item' ? (
        <ConfirmDialog
          title={`Delete ${confirming.item.name}?`}
          confirmLabel="Delete item"
          busy={busyItemId === confirming.item.id}
          onConfirm={() => removeItem(confirming.item)}
          onCancel={() => setConfirming(null)}
        >
          <p>{confirming.item.name} will be removed from the menu. This cannot be undone.</p>
        </ConfirmDialog>
      ) : null}

      {confirming?.kind === 'category' ? (
        <ConfirmDialog
          title={`Delete the "${confirming.category.name}" category?`}
          confirmLabel="Delete category"
          busy={busyCategoryId === confirming.category.id}
          onConfirm={() => deleteCategory(confirming.category)}
          onCancel={() => setConfirming(null)}
        >
          <p>The category will be removed. This cannot be undone.</p>
        </ConfirmDialog>
      ) : null}

      {recipeItem ? (
        <RecipeEditor
          item={recipeItem}
          inventory={inventory}
          onClose={() => setRecipeItem(null)}
          onSaved={() => {
            setRecipeItem(null);
            load();
          }}
        />
      ) : null}
    </StaffLayout>
  );
}

/** Reason prompt shown before a dish is marked out of stock (US2.5). */
function OutOfStockDialog({
  item,
  busy,
  onClose,
  onConfirm,
}: {
  item: MenuItem;
  busy: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');

  return (
    <Modal title={`Mark ${item.name} out of stock`} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (reason.trim()) onConfirm(reason.trim());
        }}
      >
        <p className="text-sm text-stone-500">
          Customers and waiters will see it as unavailable and can&apos;t order it until it&apos;s back in stock.
        </p>
        <div>
          <label className="label" htmlFor="oos-reason">
            Reason *
          </label>
          <input
            id="oos-reason"
            className="input"
            autoFocus
            required
            placeholder="e.g. Sold out for today"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {OUT_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={`rounded-full border px-3 py-1.5 text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                  reason === r ? 'border-red-300 bg-red-50 text-red-700' : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-danger" disabled={busy || !reason.trim()}>
            {busy ? 'Saving…' : 'Mark out of stock'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

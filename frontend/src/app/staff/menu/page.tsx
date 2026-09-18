'use client';

import { useCallback, useEffect, useState } from 'react';
import type { MenuCategory, MenuItem } from '@/types';
import { menuApi } from '@/lib/api';
import { useAuth } from '@/context/auth-context';
import { StaffLayout } from '@/components/layout/staff-layout';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { MenuItemList } from '@/components/menu/menu-item-list';
import { MenuItemForm } from '@/components/menu/menu-item-form';
import { CategoryManager } from '@/components/menu/category-manager';

export default function MenuPage() {
  const { user } = useAuth();
  const toast = useToast();
  const canManage = user ? ['chef', 'manager', 'admin'].includes(user.role) : false;

  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const { menu } = await menuApi.get();
      setCategories(menu);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to load menu.', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function submit(data: Partial<MenuItem>) {
    if (!canManage) return;
    setSaving(true);
    try {
      if (editing) {
        await menuApi.updateItem(editing.id, data);
        toast('Menu item updated.', 'success');
      } else {
        await menuApi.createItem({ ...data, available: data.available ?? true });
        toast('Menu item added.', 'success');
      }
      setFormOpen(false);
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to save menu item.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: MenuItem) {
    if (!canManage) return;
    if (!window.confirm(`Delete ${item.name}?`)) return;
    try {
      await menuApi.removeItem(item.id);
      toast('Menu item deleted.', 'success');
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to delete menu item.', 'error');
    }
  }

  async function toggleAvailability(item: MenuItem) {
    if (!canManage) return;
    try {
      await menuApi.updateItem(item.id, { available: !item.available });
      toast(item.available ? `${item.name} marked out of stock.` : `${item.name} is back in stock.`, 'success');
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to update availability.', 'error');
    }
  }

  async function createCategory(name: string) {
    if (!canManage) return;
    try {
      await menuApi.createCategory(name);
      toast(`Category "${name}" added.`, 'success');
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to create category.', 'error');
    }
  }

  async function renameCategory(id: string, name: string) {
    if (!canManage) return;
    try {
      await menuApi.updateCategory(id, { name });
      toast('Category renamed.', 'success');
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to rename category.', 'error');
    }
  }

  async function deleteCategory(id: string) {
    if (!canManage) return;
    try {
      await menuApi.removeCategory(id);
      toast('Category deleted.', 'success');
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to delete category.', 'error');
    }
  }

  return (
    <StaffLayout>
      <PageHeader
        title={canManage ? 'Menu management' : 'Menu'}
        subtitle={
          canManage
            ? 'Sprint 2 · Items, categories, modifiers, dietary/allergen tags, availability. (US2.1–US2.5)'
            : 'Sprint 2 · Browse the current menu (read-only for your role).'
        }
        action={
          canManage ? (
            <button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              className="btn-primary"
            >
              + Add item
            </button>
          ) : undefined
        }
      />

      <div className="grid gap-4 lg:grid-cols-[280px_1fr] lg:items-start">
        <Card className="lg:sticky lg:top-8">
          <CategoryManager
            categories={categories}
            onCreate={createCategory}
            onRename={renameCategory}
            onDelete={deleteCategory}
          />
        </Card>

        <Card className="p-0">
          {loading ? (
            <Spinner label="Loading menu…" />
          ) : (
            <div className="p-4">
              <MenuItemList
                categories={categories}
                onEdit={(item) => {
                  setEditing(item);
                  setFormOpen(true);
                }}
                onDelete={remove}
                onToggleAvailability={toggleAvailability}
              />
            </div>
          )}
        </Card>
      </div>

      {formOpen ? (
        <Modal
          title={editing ? `Edit ${editing.name}` : 'Add menu item'}
          onClose={() => setFormOpen(false)}
          wide
        >
          <MenuItemForm
            initial={editing}
            categories={categories}
            onSubmit={submit}
            onCancel={() => setFormOpen(false)}
            submitting={saving}
          />
        </Modal>
      ) : null}
    </StaffLayout>
  );
}
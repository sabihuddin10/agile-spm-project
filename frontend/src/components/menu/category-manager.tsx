'use client';

import { useState } from 'react';
import type { MenuCategory } from '@/types';
import { Badge } from '@/components/ui/badge';

/**
 * Manager/Admin category editor (US2.2): add, rename, delete (only when empty)
 * and show/hide a category on the customer menu. Each handler resolves `true`
 * on success so the inline inputs can reset.
 */
export function CategoryManager({
  categories,
  busyId,
  onCreate,
  onRename,
  onToggleActive,
  onDelete,
}: {
  categories: MenuCategory[];
  /** Category with a change in flight ('new' while creating). */
  busyId?: string | null;
  onCreate: (name: string) => Promise<boolean>;
  onRename: (category: MenuCategory, name: string) => Promise<boolean>;
  onToggleActive: (category: MenuCategory) => void;
  onDelete: (category: MenuCategory) => void;
}) {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    if (await onCreate(name)) setNewName('');
  }

  async function submitRename(e: React.FormEvent, category: MenuCategory) {
    e.preventDefault();
    const name = editingName.trim();
    if (!name) return;
    if (name === category.name || (await onRename(category, name))) setEditingId(null);
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Categories</p>

      <form onSubmit={submitCreate} className="flex gap-2">
        <input
          className="input"
          placeholder="New category…"
          aria-label="New category name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button type="submit" className="btn-primary shrink-0 !px-3" disabled={!newName.trim() || busyId === 'new'}>
          {busyId === 'new' ? 'Adding…' : 'Add'}
        </button>
      </form>

      <ul className="space-y-1.5">
        {categories.map((c) => {
          const count = c.itemCount ?? c.items?.length ?? 0;
          const busy = busyId === c.id;
          return (
            <li
              key={c.id}
              className={`rounded-lg border px-3 py-2 ${c.active ? 'border-stone-200' : 'border-dashed border-amber-300 bg-amber-50/40'}`}
            >
              {editingId === c.id ? (
                <form onSubmit={(e) => submitRename(e, c)} className="flex items-center gap-2">
                  <input
                    className="input !py-1"
                    aria-label={`Rename ${c.name}`}
                    value={editingName}
                    autoFocus
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                  />
                  <button type="submit" className="text-xs font-medium text-emerald-700" disabled={busy}>
                    Save
                  </button>
                  <button type="button" className="text-xs font-medium text-stone-500" onClick={() => setEditingId(null)}>
                    Cancel
                  </button>
                </form>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-stone-700">{c.name}</span>
                    <Badge tone="stone" className="font-medium">
                      {count} item{count === 1 ? '' : 's'}
                    </Badge>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={c.active}
                      aria-label={`Show ${c.name} to customers`}
                      disabled={busy}
                      onClick={() => onToggleActive(c)}
                      className="flex items-center gap-1.5 text-xs text-stone-600 disabled:opacity-50"
                    >
                      <span
                        className={`relative inline-block h-4 w-7 rounded-full transition ${c.active ? 'bg-emerald-500' : 'bg-stone-300'}`}
                      >
                        <span
                          className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all ${c.active ? 'left-3.5' : 'left-0.5'}`}
                        />
                      </span>
                      {!c.active ? (
                        <span className="font-medium text-amber-700">Hidden from customers</span>
                      ) : count === 0 ? (
                        <span className="text-stone-500">Visible · empty, so auto-hidden</span>
                      ) : (
                        <span>Visible</span>
                      )}
                    </button>
                    <span className="ml-auto flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(c.id);
                          setEditingName(c.name);
                        }}
                        className="text-xs text-stone-500 hover:text-stone-800"
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(c)}
                        className="text-xs text-stone-500 hover:text-red-600 disabled:cursor-not-allowed disabled:text-stone-300"
                        disabled={count > 0 || busy}
                        title={count > 0 ? 'Move or delete its items first' : `Delete ${c.name}`}
                      >
                        Delete
                      </button>
                    </span>
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ul>

      <p className="text-xs leading-relaxed text-stone-500">
        Empty categories are hidden on the customer menu automatically. Switch a category off to hide it even when it has
        items. A category can only be deleted once it&apos;s empty.
      </p>
    </div>
  );
}

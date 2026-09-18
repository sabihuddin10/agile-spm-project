'use client';

import { useState } from 'react';
import type { MenuCategory } from '@/types';
import { Badge } from '@/components/ui/badge';

export function CategoryManager({
  categories,
  onCreate,
  onRename,
  onDelete,
}: {
  categories: MenuCategory[];
  onCreate: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}) {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    onCreate(newName.trim());
    setNewName('');
  }

  function submitRename(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId || !editingName.trim()) return;
    onRename(editingId, editingName.trim());
    setEditingId(null);
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Categories</p>

      <form onSubmit={submitCreate} className="flex gap-2">
        <input
          className="input"
          placeholder="New category…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button type="submit" className="btn-primary shrink-0 !px-3">
          Add
        </button>
      </form>

      <ul className="space-y-1">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center gap-2 rounded-lg border border-stone-100 px-3 py-2">
            {editingId === c.id ? (
              <form onSubmit={submitRename} className="flex flex-1 items-center gap-2">
                <input
                  className="input !py-1"
                  value={editingName}
                  autoFocus
                  onChange={(e) => setEditingName(e.target.value)}
                />
                <button type="submit" className="text-xs font-medium text-emerald-600">
                  Save
                </button>
                <button
                  type="button"
                  className="text-xs font-medium text-stone-400"
                  onClick={() => setEditingId(null)}
                >
                  Cancel
                </button>
              </form>
            ) : (
              <>
                <span className="flex-1 text-sm font-medium text-stone-700">{c.name}</span>
                <Badge tone="stone">{c.itemCount ?? 0}</Badge>
                <button
                  onClick={() => {
                    setEditingId(c.id);
                    setEditingName(c.name);
                  }}
                  className="text-xs text-stone-400 hover:text-stone-600"
                >
                  Rename
                </button>
                <button
                  onClick={() => onDelete(c.id)}
                  className="text-xs text-stone-400 hover:text-red-600"
                  disabled={(c.itemCount ?? 0) > 0}
                  title={(c.itemCount ?? 0) > 0 ? 'Category still has items' : 'Delete category'}
                >
                  Delete
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
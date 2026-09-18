'use client';

import { useEffect, useState } from 'react';
import type { MenuCategory, MenuItem, Modifier } from '@/types';

const DIETARY = ['vegetarian', 'vegan', 'gluten-free', 'halal', 'keto', 'nut-free'];
const ALLERGENS = ['gluten', 'dairy', 'eggs', 'peanuts', 'tree nuts', 'shellfish', 'fish', 'soy', 'sesame'];

interface Draft {
  name: string;
  categoryId: string;
  price: string;
  description: string;
  dietaryTags: string[];
  allergens: string[];
  modifiers: { name: string; options: string; type: 'single' | 'multi' }[];
  available: boolean;
  outOfStockReason: string;
}

export function MenuItemForm({
  initial,
  categories,
  onSubmit,
  onCancel,
  submitting,
}: {
  initial?: MenuItem | null;
  categories: MenuCategory[];
  onSubmit: (data: Partial<MenuItem>) => void;
  onCancel: () => void;
  submitting?: boolean;
}) {
  const [draft, setDraft] = useState<Draft>(blank(categories));

  useEffect(() => {
    setDraft(
      initial
        ? {
            name: initial.name,
            categoryId: initial.categoryId,
            price: String(initial.price),
            description: initial.description,
            dietaryTags: initial.dietaryTags,
            allergens: initial.allergens,
            modifiers: (initial.modifiers || []).map((m) => ({
              name: m.name,
              options: m.options.join(', '),
              type: m.type,
            })),
            available: initial.available,
            outOfStockReason: initial.outOfStockReason,
          }
        : blank(categories),
    );
  }, [initial, categories]);

  function toggle(list: 'dietaryTags' | 'allergens', value: string) {
    setDraft((d) => ({
      ...d,
      [list]: d[list].includes(value) ? d[list].filter((v) => v !== value) : [...d[list], value],
    }));
  }

  function patchModifier(index: number, patch: Partial<{ name: string; options: string; type: 'single' | 'multi' }>) {
    setDraft((d) => ({
      ...d,
      modifiers: d.modifiers.map((m, i) => (i === index ? { ...m, ...patch } : m)),
    }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const modifiers: Modifier[] = draft.modifiers
      .filter((m) => m.name.trim())
      .map((m) => ({
        id: `mod_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name: m.name.trim(),
        options: m.options
          .split(',')
          .map((o) => o.trim())
          .filter(Boolean),
        type: m.type,
      }));

    onSubmit({
      name: draft.name,
      categoryId: draft.categoryId,
      price: Number(draft.price),
      description: draft.description,
      dietaryTags: draft.dietaryTags,
      allergens: draft.allergens,
      modifiers,
      available: draft.available,
      outOfStockReason: draft.available ? '' : draft.outOfStockReason,
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Item name *</label>
          <input
            className="input"
            required
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Category *</label>
          <select
            className="input"
            required
            value={draft.categoryId}
            onChange={(e) => setDraft({ ...draft, categoryId: e.target.value })}
          >
            <option value="" disabled>
              Select category…
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Price (USD) *</label>
          <input
            className="input"
            required
            type="number"
            min="0"
            step="0.01"
            value={draft.price}
            onChange={(e) => setDraft({ ...draft, price: e.target.value })}
          />
        </div>
        <div className="flex items-end">
          <label className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg border border-stone-200 px-3 py-2">
            <input
              type="checkbox"
              className="h-4 w-4 accent-brand-600"
              checked={draft.available}
              onChange={(e) => setDraft({ ...draft, available: e.target.checked })}
            />
            <span className="text-sm font-medium">Available to order</span>
          </label>
        </div>
      </div>

      {!draft.available ? (
        <div>
          <label className="label">Out-of-stock reason</label>
          <input
            className="input"
            placeholder="e.g. Bakery delivery delayed"
            value={draft.outOfStockReason}
            onChange={(e) => setDraft({ ...draft, outOfStockReason: e.target.value })}
          />
        </div>
      ) : null}

      <div>
        <label className="label">Description</label>
        <textarea
          className="input min-h-[64px]"
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Dietary tags</label>
          <div className="flex flex-wrap gap-2">
            {DIETARY.map((d) => (
              <TagChip
                key={d}
                label={d}
                active={draft.dietaryTags.includes(d)}
                tone="emerald"
                onClick={() => toggle('dietaryTags', d)}
              />
            ))}
          </div>
        </div>
        <div>
          <label className="label">Allergens</label>
          <div className="flex flex-wrap gap-2">
            {ALLERGENS.map((a) => (
              <TagChip
                key={a}
                label={a}
                active={draft.allergens.includes(a)}
                tone="red"
                onClick={() => toggle('allergens', a)}
              />
            ))}
          </div>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="label !mb-0">Modifiers / add-ons</label>
          <button
            type="button"
            className="text-xs font-medium text-brand-600 hover:underline"
            onClick={() =>
              setDraft((d) => ({ ...d, modifiers: [...d.modifiers, { name: '', options: '', type: 'single' }] }))
            }
          >
            + Add modifier group
          </button>
        </div>
        {draft.modifiers.length === 0 ? (
          <p className="rounded-lg bg-stone-50 px-3 py-2 text-sm text-stone-400">None.</p>
        ) : (
          <div className="space-y-2">
            {draft.modifiers.map((m, i) => (
              <div key={i} className="grid grid-cols-[1fr_1.4fr_auto_auto] items-center gap-2">
                <input
                  className="input"
                  placeholder="Name (e.g. Size)"
                  value={m.name}
                  onChange={(e) => patchModifier(i, { name: e.target.value })}
                />
                <input
                  className="input"
                  placeholder="Options, comma separated"
                  value={m.options}
                  onChange={(e) => patchModifier(i, { options: e.target.value })}
                />
                <select
                  className="input !w-auto"
                  value={m.type}
                  onChange={(e) => patchModifier(i, { type: e.target.value as 'single' | 'multi' })}
                >
                  <option value="single">Pick one</option>
                  <option value="multi">Multi-select</option>
                </select>
                <button
                  type="button"
                  className="text-sm text-stone-400 hover:text-red-600"
                  onClick={() =>
                    setDraft((d) => ({ ...d, modifiers: d.modifiers.filter((_, idx) => idx !== i) }))
                  }
                  aria-label="Remove modifier"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Saving…' : initial ? 'Save changes' : 'Add item'}
        </button>
      </div>
    </form>
  );
}

function blank(categories: MenuCategory[]): Draft {
  return {
    name: '',
    categoryId: categories[0]?.id ?? '',
    price: '',
    description: '',
    dietaryTags: [],
    allergens: [],
    modifiers: [],
    available: true,
    outOfStockReason: '',
  };
}

function TagChip({
  label,
  active,
  onClick,
  tone,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  tone: 'emerald' | 'red';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
        active
          ? tone === 'emerald'
            ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
            : 'border-red-300 bg-red-50 text-red-700'
          : 'border-stone-200 bg-white text-stone-500 hover:bg-stone-50'
      }`}
    >
      {label}
    </button>
  );
}
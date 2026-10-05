'use client';

import { useState } from 'react';
import type { MenuCategory, MenuItem, Modifier } from '@/types';
import { modifierSummary } from './menu-item-list';

const DEFAULT_TAGS = ['vegetarian', 'vegan', 'gluten-free', 'halal', 'keto', 'nut-free'];
const DEFAULT_ALLERGENS = ['gluten', 'dairy', 'eggs', 'peanuts', 'tree nuts', 'shellfish', 'fish', 'soy', 'sesame'];

interface OptionDraft {
  key: number;
  label: string;
  priceDelta: string;
}

interface GroupDraft {
  key: number;
  /** Kept for existing groups so their id survives an edit. */
  id?: string;
  name: string;
  type: Modifier['type'];
  options: OptionDraft[];
}

interface Draft {
  name: string;
  categoryId: string;
  price: string;
  description: string;
  dietaryTags: string[];
  allergens: string[];
  modifiers: GroupDraft[];
  available: boolean;
  outOfStockReason: string;
}

let keySeq = 0;
const nextKey = () => ++keySeq;
const blankOption = (label = '', priceDelta = ''): OptionDraft => ({ key: nextKey(), label, priceDelta });
const blankGroup = (): GroupDraft => ({ key: nextKey(), name: '', type: 'single', options: [blankOption()] });

function draftFrom(initial: MenuItem | null | undefined, categories: MenuCategory[], defaultCategoryId?: string): Draft {
  if (!initial) {
    return {
      name: '',
      categoryId: defaultCategoryId ?? categories[0]?.id ?? '',
      price: '',
      description: '',
      dietaryTags: [],
      allergens: [],
      modifiers: [],
      available: true,
      outOfStockReason: '',
    };
  }
  return {
    name: initial.name,
    categoryId: initial.categoryId,
    price: String(initial.price),
    description: initial.description,
    dietaryTags: [...initial.dietaryTags],
    allergens: [...initial.allergens],
    modifiers: (initial.modifiers ?? []).map((m) => ({
      key: nextKey(),
      id: m.id,
      name: m.name,
      type: m.type,
      options: m.options.map((o) => blankOption(o.label, o.priceDelta ? String(o.priceDelta) : '')),
    })),
    available: initial.available,
    outOfStockReason: initial.outOfStockReason,
  };
}

/** Turn the editor rows into API modifier groups, or return a validation message. */
function buildModifiers(groups: GroupDraft[]): { modifiers: Modifier[] } | { error: string } {
  const modifiers: Modifier[] = [];
  for (const g of groups) {
    const name = g.name.trim();
    const options = g.options
      .filter((o) => o.label.trim() || o.priceDelta.trim())
      .map((o) => ({ label: o.label.trim(), priceDelta: o.priceDelta.trim() === '' ? 0 : Number(o.priceDelta) }));
    if (!name && options.length === 0) continue; // untouched blank group
    if (!name) return { error: 'Give every modifier group a name (e.g. "Size").' };
    if (options.length === 0) return { error: `Modifier group "${name}" needs at least one option.` };
    if (options.some((o) => !o.label)) return { error: `Every option in "${name}" needs a label.` };
    if (options.some((o) => !Number.isFinite(o.priceDelta) || o.priceDelta < 0)) {
      return { error: `Price changes in "${name}" must be zero or more.` };
    }
    const labels = options.map((o) => o.label.toLowerCase());
    if (new Set(labels).size !== labels.length) return { error: `Option labels in "${name}" must be unique.` };
    if (modifiers.some((m) => m.name.toLowerCase() === name.toLowerCase())) {
      return { error: `There are two modifier groups called "${name}".` };
    }
    // An empty id tells the server to mint one for a new group.
    modifiers.push({ id: g.id ?? '', name, type: g.type, options });
  }
  return { modifiers };
}

/**
 * Add / edit a menu item (US2.1) with dietary & allergen tags (US2.4) and a
 * modifier editor where every option carries its own price delta (US2.3).
 * Mount it fresh (e.g. inside a Modal) for each item.
 */
export function MenuItemForm({
  initial,
  categories,
  tags = DEFAULT_TAGS,
  allergens = DEFAULT_ALLERGENS,
  defaultCategoryId,
  onSubmit,
  onCancel,
  submitting,
}: {
  initial?: MenuItem | null;
  categories: MenuCategory[];
  /** Dietary tags offered (from GET /menu). */
  tags?: string[];
  /** Allergens offered (from GET /menu). */
  allergens?: string[];
  defaultCategoryId?: string;
  onSubmit: (data: Partial<MenuItem>) => void;
  onCancel: () => void;
  submitting?: boolean;
}) {
  const [draft, setDraft] = useState<Draft>(() => draftFrom(initial, categories, defaultCategoryId));
  const [error, setError] = useState('');

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setError('');
  }

  function toggle(list: 'dietaryTags' | 'allergens', value: string) {
    setDraft((d) => ({
      ...d,
      [list]: d[list].includes(value) ? d[list].filter((v) => v !== value) : [...d[list], value],
    }));
  }

  function patchGroup(key: number, patch: Partial<GroupDraft>) {
    setDraft((d) => ({ ...d, modifiers: d.modifiers.map((g) => (g.key === key ? { ...g, ...patch } : g)) }));
    setError('');
  }

  function patchOption(groupKey: number, optionKey: number, patch: Partial<OptionDraft>) {
    setDraft((d) => ({
      ...d,
      modifiers: d.modifiers.map((g) =>
        g.key === groupKey ? { ...g, options: g.options.map((o) => (o.key === optionKey ? { ...o, ...patch } : o)) } : g,
      ),
    }));
    setError('');
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const price = Number(draft.price);
    if (!draft.name.trim()) return setError('Item name is required.');
    if (!draft.categoryId) return setError('Choose a category.');
    if (draft.price.trim() === '' || !(price >= 0)) return setError('Price must be zero or more.');
    if (!draft.available && !draft.outOfStockReason.trim()) return setError('Add a reason for marking it out of stock.');
    const built = buildModifiers(draft.modifiers);
    if ('error' in built) return setError(built.error);

    onSubmit({
      name: draft.name.trim(),
      categoryId: draft.categoryId,
      price,
      description: draft.description.trim(),
      dietaryTags: draft.dietaryTags,
      allergens: draft.allergens,
      modifiers: built.modifiers,
      available: draft.available,
      outOfStockReason: draft.available ? '' : draft.outOfStockReason.trim(),
    });
  }

  const preview = buildModifiers(draft.modifiers);

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="mi-name">
            Item name *
          </label>
          <input
            id="mi-name"
            className="input"
            required
            value={draft.name}
            onChange={(e) => set('name', e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="mi-category">
            Category *
          </label>
          <select
            id="mi-category"
            className="input"
            required
            value={draft.categoryId}
            onChange={(e) => set('categoryId', e.target.value)}
          >
            <option value="" disabled>
              Select category…
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.active ? '' : ' (hidden)'}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="mi-price">
            Price (USD) *
          </label>
          <input
            id="mi-price"
            className="input"
            required
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={draft.price}
            onChange={(e) => set('price', e.target.value)}
          />
        </div>
        <div className="flex items-end">
          <label className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg border border-stone-200 px-3 py-2">
            <input
              type="checkbox"
              className="h-4 w-4 accent-brand-600"
              checked={draft.available}
              onChange={(e) => set('available', e.target.checked)}
            />
            <span className="text-sm font-medium">Available to order</span>
          </label>
        </div>
      </div>

      {!draft.available ? (
        <div>
          <label className="label" htmlFor="mi-reason">
            Out-of-stock reason *
          </label>
          <input
            id="mi-reason"
            className="input"
            placeholder="e.g. Bakery delivery delayed"
            value={draft.outOfStockReason}
            onChange={(e) => set('outOfStockReason', e.target.value)}
          />
        </div>
      ) : null}

      <div>
        <label className="label" htmlFor="mi-description">
          Description
        </label>
        <textarea
          id="mi-description"
          className="input min-h-[64px]"
          value={draft.description}
          onChange={(e) => set('description', e.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <fieldset>
          <legend className="label">Dietary tags</legend>
          <div className="flex flex-wrap gap-2">
            {tags.map((d) => (
              <TagChip
                key={d}
                label={d}
                active={draft.dietaryTags.includes(d)}
                tone="emerald"
                onClick={() => toggle('dietaryTags', d)}
              />
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="label">Allergens</legend>
          <div className="flex flex-wrap gap-2">
            {allergens.map((a) => (
              <TagChip
                key={a}
                label={a}
                active={draft.allergens.includes(a)}
                tone="red"
                onClick={() => toggle('allergens', a)}
              />
            ))}
          </div>
        </fieldset>
      </div>

      <fieldset>
        <div className="mb-2 flex items-center justify-between gap-2">
          <legend className="label !mb-0">Modifiers / add-ons</legend>
          <button
            type="button"
            className="text-xs font-medium text-brand-600 hover:underline"
            onClick={() => setDraft((d) => ({ ...d, modifiers: [...d.modifiers, blankGroup()] }))}
          >
            + Add modifier group
          </button>
        </div>

        {draft.modifiers.length === 0 ? (
          <p className="rounded-lg bg-stone-50 px-3 py-2 text-sm text-stone-400">
            None. Add a group such as “Size” (pick one) or “Extras” (multi-select); each option can add to the price.
          </p>
        ) : (
          <div className="space-y-3">
            {draft.modifiers.map((g, gi) => (
              <div key={g.key} className="rounded-lg border border-stone-200 bg-stone-50/60 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    className="input min-w-0 flex-1 basis-40"
                    placeholder="Group name (e.g. Size)"
                    aria-label={`Modifier group ${gi + 1} name`}
                    value={g.name}
                    onChange={(e) => patchGroup(g.key, { name: e.target.value })}
                  />
                  <select
                    className="input !w-auto"
                    aria-label={`Modifier group ${gi + 1} type`}
                    value={g.type}
                    onChange={(e) => patchGroup(g.key, { type: e.target.value as Modifier['type'] })}
                  >
                    <option value="single">Pick one</option>
                    <option value="multi">Multi-select</option>
                  </select>
                  <button
                    type="button"
                    className="rounded p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600"
                    aria-label={`Remove modifier group ${g.name || gi + 1}`}
                    onClick={() => setDraft((d) => ({ ...d, modifiers: d.modifiers.filter((x) => x.key !== g.key) }))}
                  >
                    ✕
                  </button>
                </div>

                <div className="mt-2 space-y-1.5 pl-0 sm:pl-3">
                  {g.options.map((o, oi) => (
                    <div key={o.key} className="grid grid-cols-[1fr_6.5rem_auto] items-center gap-2">
                      <input
                        className="input !py-1.5"
                        placeholder={oi === 0 ? 'Option (e.g. Regular)' : 'Option'}
                        aria-label={`${g.name || 'Group'} option ${oi + 1} label`}
                        value={o.label}
                        onChange={(e) => patchOption(g.key, o.key, { label: e.target.value })}
                      />
                      <div className="relative">
                        <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-xs text-stone-400">
                          +$
                        </span>
                        <input
                          className="input !py-1.5 pl-7"
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          placeholder="0.00"
                          aria-label={`${o.label || `Option ${oi + 1}`} price change`}
                          value={o.priceDelta}
                          onChange={(e) => patchOption(g.key, o.key, { priceDelta: e.target.value })}
                        />
                      </div>
                      <button
                        type="button"
                        className="rounded p-1 text-stone-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                        aria-label={`Remove option ${o.label || oi + 1}`}
                        disabled={g.options.length === 1}
                        onClick={() => patchGroup(g.key, { options: g.options.filter((x) => x.key !== o.key) })}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="text-xs font-medium text-brand-600 hover:underline"
                    onClick={() => patchGroup(g.key, { options: [...g.options, blankOption()] })}
                  >
                    + Add option
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {'modifiers' in preview && preview.modifiers.length > 0 ? (
          <div className="mt-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-800">
            <span className="font-semibold">Customers see: </span>
            {preview.modifiers.map(modifierSummary).join(' · ')}
          </div>
        ) : null}
      </fieldset>

      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

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
      aria-pressed={active}
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

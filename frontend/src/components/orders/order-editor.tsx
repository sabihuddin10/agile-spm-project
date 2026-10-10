'use client';

import { useMemo, useState } from 'react';
import type { MenuCategory, MenuItem, ModifierSelection, NewOrderLine, Order } from '@/types';
import { ModifierPicker } from '@/components/menu/modifier-picker';
import { Badge } from '@/components/ui/badge';
import { modifierText, money, titleCase } from '@/lib/format';
import { allergyConflicts, defaultSelections, priceSelections, selectionKey, unitPriceFor } from '@/lib/menu';
import { lineTotal } from './labels';
import { MAX_ORDER_LINES, ORDER_LINES_FULL } from '@/lib/validation/fields';

export const MAX_LINE_QTY = 99;

/** One editable order line. `fallback` keeps a prefilled line readable if its dish left the menu. */
export interface DraftLine {
  key: string;
  menuItemId: string;
  qty: number;
  modifiers: ModifierSelection[];
  fallback?: { name: string; unitPrice: number };
}

let seq = 0;
const nextKey = () => `line_${++seq}`;

/** Prefill the editor from an existing order (US3.2). */
export function linesFromOrder(order: Order): DraftLine[] {
  return order.items.map((i) => ({
    key: nextKey(),
    menuItemId: i.menuItemId,
    qty: i.qty,
    modifiers: i.modifiers.map(({ group, label }) => ({ group, label })),
    fallback: { name: i.name, unitPrice: i.unitPrice },
  }));
}

/** API payload for create / replaceItems. */
export function toOrderLines(lines: DraftLine[]): NewOrderLine[] {
  return lines.map(({ menuItemId, qty, modifiers }) => ({ menuItemId, qty, modifiers }));
}

export function indexMenu(categories: MenuCategory[]): Map<string, MenuItem> {
  return new Map(categories.flatMap((c) => c.items ?? []).map((i) => [i.id, i]));
}

function unitPriceOf(line: DraftLine, byId: Map<string, MenuItem>): number {
  const dish = byId.get(line.menuItemId);
  return dish ? unitPriceFor(dish, line.modifiers) : line.fallback?.unitPrice ?? 0;
}

/** Running subtotal (before tax / service), priced like the server. */
export function draftSubtotal(lines: DraftLine[], byId: Map<string, MenuItem>): number {
  const cents = lines.reduce((sum, l) => sum + Math.round(unitPriceOf(l, byId) * 100) * l.qty, 0);
  return cents / 100;
}

/** Lines the server would refuse because the dish is currently unavailable. */
export function unavailableLines(lines: DraftLine[], byId: Map<string, MenuItem>): DraftLine[] {
  return lines.filter((l) => byId.get(l.menuItemId)?.available === false);
}

function matches(item: MenuItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [item.name, item.description, ...item.dietaryTags].some((f) => f.toLowerCase().includes(q));
}

/**
 * Menu browser + editable line list used to place a staff order (US3.1, US3.5,
 * US6.3) and to amend a placed order before confirmation (US3.2). Unavailable
 * dishes are shown disabled with their reason; dishes with modifiers open an
 * inline ModifierPicker (defaults pre-selected); lines have qty steppers and a
 * running subtotal. `allergies` flags dishes that clash with the guest (US1.5).
 */
export function OrderLineEditor({
  categories,
  lines,
  onChange,
  allergies = [],
}: {
  categories: MenuCategory[];
  lines: DraftLine[];
  onChange: (next: DraftLine[]) => void;
  allergies?: string[];
}) {
  const byId = useMemo(() => indexMenu(categories), [categories]);
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState('all');
  const [configuring, setConfiguring] = useState<{ itemId: string; selections: ModifierSelection[]; qty: number } | null>(
    null,
  );
  const [optionsFor, setOptionsFor] = useState<string | null>(null);
  /** Shown when a 51st distinct line was refused (the server's limit is 50). */
  const [lineLimit, setLineLimit] = useState(false);

  const visible = categories
    .filter((c) => categoryId === 'all' || c.id === categoryId)
    .map((c) => ({ ...c, items: (c.items ?? []).filter((i) => matches(i, query)) }))
    .filter((c) => c.items.length > 0);

  const qtyByItem = useMemo(() => {
    const map = new Map<string, number>();
    lines.forEach((l) => map.set(l.menuItemId, (map.get(l.menuItemId) ?? 0) + l.qty));
    return map;
  }, [lines]);

  const subtotal = draftSubtotal(lines, byId);
  const itemCount = lines.reduce((n, l) => n + l.qty, 0);

  function add(item: MenuItem, selections: ModifierSelection[], qty = 1) {
    const key = selectionKey(item.id, selections);
    const existing = lines.find((l) => selectionKey(l.menuItemId, l.modifiers) === key);
    if (existing) {
      onChange(lines.map((l) => (l === existing ? { ...l, qty: Math.min(MAX_LINE_QTY, l.qty + qty) } : l)));
    } else if (lines.length >= MAX_ORDER_LINES) {
      setLineLimit(true);
    } else {
      onChange([...lines, { key: nextKey(), menuItemId: item.id, qty, modifiers: selections }]);
    }
  }

  function pickDish(item: MenuItem) {
    if (item.modifiers.length === 0) {
      add(item, []);
      return;
    }
    setConfiguring((cur) =>
      cur?.itemId === item.id ? null : { itemId: item.id, selections: defaultSelections(item), qty: 1 },
    );
  }

  function update(key: string, patch: Partial<DraftLine>) {
    onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function remove(key: string) {
    onChange(lines.filter((l) => l.key !== key));
    setLineLimit(false);
    if (optionsFor === key) setOptionsFor(null);
  }

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------------ menu browser */}
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="label !mb-0">Menu</p>
          <input
            type="search"
            className="input sm:!w-56"
            placeholder="Search dishes…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search the menu"
          />
        </div>
        <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label="Filter by category">
          {[{ id: 'all', name: 'All' }, ...categories].map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={categoryId === c.id}
              onClick={() => setCategoryId(c.id)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                categoryId === c.id
                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                  : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="max-h-72 overflow-y-auto rounded-lg border border-stone-200">
          {visible.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-stone-500">No dishes match.</p>
          ) : (
            visible.map((c) => (
              <section key={c.id} aria-label={c.name}>
                <h3 className="sticky top-0 z-10 border-b border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">
                  {c.name}
                </h3>
                <ul className="divide-y divide-stone-100">
                  {c.items.map((item) => {
                    const inOrder = qtyByItem.get(item.id) ?? 0;
                    const clash = allergyConflicts(item, allergies);
                    const open = configuring?.itemId === item.id;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          disabled={!item.available}
                          onClick={() => pickDish(item)}
                          aria-expanded={item.modifiers.length ? open : undefined}
                          className="flex w-full items-start gap-3 px-3 py-2.5 text-left transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:bg-stone-50/60"
                        >
                          <span className="min-w-0 flex-1">
                            <span className={`block text-sm font-medium ${item.available ? 'text-stone-800' : 'text-stone-400'}`}>
                              {item.name}
                              {inOrder > 0 ? (
                                <span className="ml-2 rounded-full bg-brand-100 px-1.5 py-0.5 text-xs font-semibold text-brand-700">
                                  {inOrder} in order
                                </span>
                              ) : null}
                            </span>
                            {item.available ? (
                              <span className="mt-0.5 block text-xs text-stone-500">
                                {item.allergens.length ? `Contains ${item.allergens.join(', ')}` : 'No listed allergens'}
                                {item.modifiers.length ? ' · options' : ''}
                              </span>
                            ) : (
                              <span className="mt-0.5 block text-xs font-medium text-red-600">
                                Unavailable{item.outOfStockReason ? ` — ${item.outOfStockReason}` : ''}
                              </span>
                            )}
                            {clash.length > 0 && item.available ? (
                              <span className="mt-1 block text-xs font-semibold text-red-600">
                                Guest allergy: {clash.map(titleCase).join(', ')}
                              </span>
                            ) : null}
                          </span>
                          <span className="shrink-0 text-right">
                            <span className={`block text-sm font-semibold ${item.available ? 'text-stone-700' : 'text-stone-400'}`}>
                              {money(item.price)}
                            </span>
                            {item.available ? (
                              <span className="mt-0.5 block text-xs font-medium text-brand-600">
                                {item.modifiers.length ? (open ? 'Close' : 'Choose…') : '+ Add'}
                              </span>
                            ) : null}
                          </span>
                        </button>

                        {open && configuring ? (
                          <div className="space-y-3 border-t border-dashed border-stone-200 bg-brand-50/40 px-3 py-3">
                            <ModifierPicker
                              item={item}
                              value={configuring.selections}
                              onChange={(selections) => setConfiguring({ ...configuring, selections })}
                            />
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <QtyStepper
                                value={configuring.qty}
                                name={item.name}
                                onChange={(qty) => setConfiguring({ ...configuring, qty })}
                              />
                              <div className="flex gap-2">
                                <button type="button" className="btn-sm btn-ghost" onClick={() => setConfiguring(null)}>
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  className="btn-sm btn-primary"
                                  onClick={() => {
                                    add(item, configuring.selections, configuring.qty);
                                    setConfiguring(null);
                                  }}
                                >
                                  Add {configuring.qty} ·{' '}
                                  {money(lineTotal(unitPriceFor(item, configuring.selections), configuring.qty))}
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))
          )}
        </div>
      </div>

      {/* ------------------------------------------------------- order lines */}
      <div>
        <p className="label">
          Order lines{' '}
          <span className="font-normal text-stone-500">
            ({itemCount} item{itemCount === 1 ? '' : 's'})
          </span>
        </p>
        {lineLimit && lines.length >= MAX_ORDER_LINES ? (
          <p role="status" className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {ORDER_LINES_FULL}
          </p>
        ) : null}
        {lines.length === 0 ? (
          <p className="rounded-lg border border-dashed border-stone-300 px-4 py-5 text-center text-sm text-stone-500">
            Nothing added yet — pick dishes from the menu above.
          </p>
        ) : (
          <ul className="divide-y divide-stone-100 rounded-lg border border-stone-200">
            {lines.map((line) => {
              const dish = byId.get(line.menuItemId);
              const unit = unitPriceOf(line, byId);
              const priced = dish ? priceSelections(dish, line.modifiers) : [];
              const clash = dish ? allergyConflicts(dish, allergies) : [];
              const editingOptions = optionsFor === line.key && dish;
              return (
                <li key={line.key} className="px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <div className="min-w-0 flex-1 basis-40">
                      <p className="text-sm font-medium text-stone-800">{dish?.name ?? line.fallback?.name ?? 'Unknown dish'}</p>
                      {priced.length ? <p className="text-xs text-stone-500">{modifierText(priced)}</p> : null}
                      <p className="text-xs tabular-nums text-stone-500">{money(unit)} each</p>
                      {!dish ? (
                        <p className="text-xs font-medium text-amber-700">Not on the current menu</p>
                      ) : !dish.available ? (
                        <p className="text-xs font-medium text-red-600">
                          Unavailable{dish.outOfStockReason ? ` — ${dish.outOfStockReason}` : ''}. Remove it to continue.
                        </p>
                      ) : null}
                      {clash.length ? (
                        <p className="text-xs font-semibold text-red-600">Guest allergy: {clash.map(titleCase).join(', ')}</p>
                      ) : null}
                    </div>
                    <QtyStepper value={line.qty} name={dish?.name ?? 'item'} onChange={(qty) => update(line.key, { qty })} />
                    <span className="w-16 text-right text-sm font-semibold tabular-nums text-stone-700">{money(lineTotal(unit, line.qty))}</span>
                    <div className="flex items-center gap-1">
                      {dish && dish.modifiers.length ? (
                        <button
                          type="button"
                          className="btn-sm btn-ghost !px-2"
                          aria-expanded={Boolean(editingOptions)}
                          onClick={() => setOptionsFor(editingOptions ? null : line.key)}
                        >
                          Options
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="flex h-9 w-9 items-center justify-center rounded-md text-stone-500 transition hover:bg-red-50 hover:text-red-600"
                        onClick={() => remove(line.key)}
                        aria-label={`Remove ${dish?.name ?? 'line'}`}
                      >
                        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  {editingOptions ? (
                    <div className="mt-3 rounded-lg bg-stone-50 p-3">
                      <ModifierPicker item={dish} value={line.modifiers} onChange={(modifiers) => update(line.key, { modifiers })} />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-3 flex items-baseline justify-between rounded-lg bg-stone-50 px-3 py-2">
          <span className="text-sm text-stone-500">
            Subtotal <span className="text-xs text-stone-500">(tax &amp; service added at billing)</span>
          </span>
          <span className="text-base font-bold tabular-nums text-stone-900">{money(subtotal)}</span>
        </div>
      </div>
    </div>
  );
}

/** − qty + control with accessible labels. */
export function QtyStepper({
  value,
  name,
  onChange,
}: {
  value: number;
  name: string;
  onChange: (next: number) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-lg border border-stone-300 bg-white">
      <button
        type="button"
        className="px-2.5 py-1 text-stone-600 hover:bg-stone-50 disabled:opacity-40"
        onClick={() => onChange(Math.max(1, value - 1))}
        disabled={value <= 1}
        aria-label={`Decrease quantity of ${name}`}
      >
        −
      </button>
      <span className="min-w-[2rem] text-center text-sm font-semibold tabular-nums" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        className="px-2.5 py-1 text-stone-600 hover:bg-stone-50 disabled:opacity-40"
        onClick={() => onChange(Math.min(MAX_LINE_QTY, value + 1))}
        disabled={value >= MAX_LINE_QTY}
        aria-label={`Increase quantity of ${name}`}
      >
        +
      </button>
    </div>
  );
}

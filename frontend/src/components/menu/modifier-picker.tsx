'use client';

import type { MenuItem, ModifierSelection } from '@/types';
import { money } from '@/lib/format';

/**
 * Choose modifier options for a dish (US2.3): radio buttons for single-choice
 * groups (Size, Cook), checkboxes for multi-select extras, with price deltas.
 * Styling uses the shared .label/.chip classes so it fits both the staff
 * console and the storefront.
 */
export function ModifierPicker({
  item,
  value,
  onChange,
  dark = false,
}: {
  item: MenuItem;
  value: ModifierSelection[];
  onChange: (next: ModifierSelection[]) => void;
  dark?: boolean;
}) {
  if (item.modifiers.length === 0) return null;

  const isOn = (group: string, label: string) => value.some((s) => s.group === group && s.label === label);

  function pick(group: string, label: string, type: 'single' | 'multi') {
    if (type === 'single') {
      onChange([...value.filter((s) => s.group !== group), { group, label }]);
    } else if (isOn(group, label)) {
      onChange(value.filter((s) => !(s.group === group && s.label === label)));
    } else {
      onChange([...value, { group, label }]);
    }
  }

  return (
    <div className="space-y-4">
      {item.modifiers.map((g) => (
        <fieldset key={g.id}>
          <legend className={`mb-2 text-sm font-medium ${dark ? 'text-bone' : 'text-stone-700'}`}>
            {g.name}{' '}
            <span className={`text-xs font-normal ${dark ? 'text-bone-faint' : 'text-stone-400'}`}>
              {g.type === 'single' ? 'choose one' : 'optional extras'}
            </span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {g.options.map((o) => {
              const on = isOn(g.name, o.label);
              return (
                <button
                  key={o.label}
                  type="button"
                  role={g.type === 'single' ? 'radio' : 'checkbox'}
                  aria-checked={on}
                  onClick={() => pick(g.name, o.label, g.type)}
                  className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
                    on
                      ? dark
                        ? 'border-ember bg-ember/15 text-bone'
                        : 'border-brand-500 bg-brand-50 text-brand-700'
                      : dark
                        ? 'border-char-hairline bg-char-deep text-bone-dim hover:border-ember/40 hover:text-bone'
                        : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  {o.label}
                  {o.priceDelta ? <span className="ml-1 text-xs opacity-75">+{money(o.priceDelta)}</span> : null}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

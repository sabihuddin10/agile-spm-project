'use client';

import type { Customer } from '@/types';
import { Badge } from '@/components/ui/badge';
import { money, titleCase } from '@/lib/format';
import { ALLERGY_OPTIONS, DIETARY_OPTIONS } from '@/components/customers/preference-options';

/** Customer ledger rows (US1.1, US1.3): contact, type, spend, orders, points and preference flags. */
export function CustomerTable({
  customers,
  onSelect,
  selectedId,
}: {
  customers: Customer[];
  onSelect: (customer: Customer) => void;
  selectedId: string | null;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="table-base">
        <thead>
          <tr>
            <th>Name</th>
            <th>Contact</th>
            <th>Type</th>
            <th className="text-right">Total spend</th>
            <th className="text-right">Orders</th>
            <th className="text-right">Points</th>
            <th>Prefs</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((c) => (
            <tr
              key={c.id}
              onClick={() => onSelect(c)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(c);
                }
              }}
              tabIndex={0}
              aria-selected={selectedId === c.id}
              className={`cursor-pointer transition focus:outline-none focus-visible:bg-brand-50 ${
                selectedId === c.id ? 'bg-brand-50' : 'hover:bg-stone-50'
              }`}
            >
              <td className="font-medium text-stone-800">{c.name}</td>
              <td className="text-stone-600">
                <div>{c.email || '—'}</div>
                <div className="text-xs text-stone-400">{c.phone || ''}</div>
              </td>
              <td>
                <Badge tone={c.type === 'online' ? 'blue' : 'stone'}>{titleCase(c.type)}</Badge>
              </td>
              <td className="text-right font-medium">{money(c.totalSpend)}</td>
              <td className="text-right text-stone-600">{c.orderCount ?? c.orderHistory?.length ?? 0}</td>
              <td className="text-right text-stone-600">{c.loyaltyPoints}</td>
              <td>
                <PreferencePills dietary={c.preferences?.dietary ?? []} allergies={c.preferences?.allergies ?? []} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PreferencePills({ dietary, allergies }: { dietary: string[]; allergies: string[] }) {
  if (dietary.length + allergies.length === 0) return <span className="text-xs text-stone-400">None recorded</span>;
  const extra = Math.max(0, dietary.length - 2) + Math.max(0, allergies.length - 2);
  return (
    <div className="flex flex-wrap gap-1">
      {dietary.slice(0, 2).map((d) => (
        <span key={d} className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
          {d}
        </span>
      ))}
      {allergies.slice(0, 2).map((a) => (
        <span key={a} className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-600">
          ⚠ {a}
        </span>
      ))}
      {extra > 0 ? <span className="text-[10px] text-stone-400">+{extra}</span> : null}
    </div>
  );
}

export interface CustomerFilterValues {
  q: string;
  type: '' | Customer['type'];
  dietary: string;
  allergy: string;
}

export const EMPTY_FILTERS: CustomerFilterValues = { q: '', type: '', dietary: '', allergy: '' };

/**
 * Ledger search and filters (US1.3). Controlled — the page debounces the
 * search text and re-queries the API whenever any filter changes.
 */
export function CustomerFilters({
  value,
  onChange,
  busy = false,
}: {
  value: CustomerFilterValues;
  onChange: (next: CustomerFilterValues) => void;
  busy?: boolean;
}) {
  const active = value.q || value.type || value.dietary || value.allergy;
  const set = <K extends keyof CustomerFilterValues>(key: K, v: CustomerFilterValues[K]) => onChange({ ...value, [key]: v });

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-[200px] flex-1">
        <label htmlFor="customer-search" className="label">
          Search
        </label>
        <input
          id="customer-search"
          type="search"
          className="input"
          placeholder="Name, email, or phone…"
          value={value.q}
          onChange={(e) => set('q', e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="customer-type" className="label">
          Type
        </label>
        <select
          id="customer-type"
          className="input w-36"
          value={value.type}
          onChange={(e) => set('type', e.target.value as CustomerFilterValues['type'])}
        >
          <option value="">All</option>
          <option value="walk-in">Walk-in</option>
          <option value="online">Online</option>
        </select>
      </div>
      <div>
        <label htmlFor="customer-dietary" className="label">
          Dietary
        </label>
        <select
          id="customer-dietary"
          className="input w-40"
          value={value.dietary}
          onChange={(e) => set('dietary', e.target.value)}
        >
          <option value="">Any</option>
          {DIETARY_OPTIONS.map((d) => (
            <option key={d} value={d}>
              {titleCase(d)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="customer-allergy" className="label">
          Allergy flag
        </label>
        <select
          id="customer-allergy"
          className="input w-40"
          value={value.allergy}
          onChange={(e) => set('allergy', e.target.value)}
        >
          <option value="">Any</option>
          {ALLERGY_OPTIONS.map((a) => (
            <option key={a} value={a}>
              {titleCase(a)}
            </option>
          ))}
        </select>
      </div>
      {active ? (
        <button type="button" className="btn-ghost" onClick={() => onChange(EMPTY_FILTERS)}>
          Clear filters
        </button>
      ) : null}
      {busy ? <span className="pb-2 text-xs text-stone-400" aria-live="polite">Updating…</span> : null}
    </div>
  );
}

'use client';

import { useMemo, useState } from 'react';
import type { Customer } from '@/types';
import { Badge } from '@/components/ui/badge';

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
            <th>Prefs</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((c) => (
            <tr
              key={c.id}
              onClick={() => onSelect(c)}
              className={`cursor-pointer transition ${
                selectedId === c.id ? 'bg-brand-50' : 'hover:bg-stone-50'
              }`}
            >
              <td className="font-medium text-stone-800">{c.name}</td>
              <td className="text-stone-600">
                <div>{c.email || '—'}</div>
                <div className="text-xs text-stone-400">{c.phone || ''}</div>
              </td>
              <td>
                <Badge tone={c.type === 'online' ? 'blue' : 'stone'}>{c.type}</Badge>
              </td>
              <td className="text-right font-medium">${c.totalSpend.toFixed(2)}</td>
              <td className="text-right text-stone-600">{c.orderCount ?? 0}</td>
              <td>
                <DietaryPills dietary={c.preferences?.dietary ?? []} allergies={c.preferences?.allergies ?? []} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DietaryPills({ dietary, allergies }: { dietary: string[]; allergies: string[] }) {
  const count = dietary.length + allergies.length;
  if (count === 0) return <span className="text-xs text-stone-400">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {dietary.slice(0, 2).map((d) => (
        <span key={d} className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600">
          {d}
        </span>
      ))}
      {allergies.slice(0, 2).map((a) => (
        <span key={a} className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-500">
          ⚠ {a}
        </span>
      ))}
    </div>
  );
}

export function CustomerFilters({
  onFilter,
}: {
  onFilter: (filters: { q: string; type: string; allergen: string }) => void;
}) {
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [allergen, setAllergen] = useState('');

  const debounced = useMemo(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    return (value: string) => {
      clearTimeout(timer);
      timer = setTimeout(() => onFilter({ q: value, type, allergen }), 250);
    };
  }, [onFilter, type, allergen]);

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-[220px] flex-1">
        <label htmlFor="search" className="label">
          Search
        </label>
        <input
          id="search"
          className="input"
          placeholder="Name, email, or phone…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            debounced(e.target.value);
          }}
        />
      </div>
      <div>
        <label htmlFor="type" className="label">
          Type
        </label>
        <select
          id="type"
          className="input w-36"
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            onFilter({ q, type: e.target.value, allergen });
          }}
        >
          <option value="">All</option>
          <option value="walk-in">Walk-in</option>
          <option value="online">Online</option>
        </select>
      </div>
      <div>
        <label htmlFor="allergen" className="label">
          Allergy flag
        </label>
        <select
          id="allergen"
          className="input w-40"
          value={allergen}
          onChange={(e) => {
            setAllergen(e.target.value);
            onFilter({ q, type, allergen: e.target.value });
          }}
        >
          <option value="">Any</option>
          <option value="peanuts">Peanuts</option>
          <option value="shellfish">Shellfish</option>
          <option value="dairy">Dairy</option>
          <option value="gluten">Gluten</option>
        </select>
      </div>
    </div>
  );
}
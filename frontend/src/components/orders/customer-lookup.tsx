'use client';

import { useEffect, useState } from 'react';
import type { Customer } from '@/types';
import { customerApi } from '@/lib/api';
import { errorMessage } from '@/lib/format';
import { useToast } from '@/components/ui/toast';
import { AllergyBanner } from './allergy-banner';

/**
 * Optional guest lookup when taking a staff order: searches the customer ledger
 * by name, email or phone and, once chosen, shows the guest's allergies and
 * dietary preferences so they travel with the order (US1.5, US3.1).
 */
export function CustomerLookup({
  value,
  onChange,
}: {
  value: Customer | null;
  onChange: (customer: Customer | null) => void;
}) {
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Customer[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    let stale = false;
    setSearching(true);
    const id = window.setTimeout(async () => {
      try {
        const { customers } = await customerApi.list({ q });
        if (!stale) setResults(customers.slice(0, 6));
      } catch (err) {
        if (!stale) toast(errorMessage(err, 'Customer search failed.'), 'error');
      } finally {
        if (!stale) setSearching(false);
      }
    }, 250);
    return () => {
      stale = true;
      window.clearTimeout(id);
    };
  }, [query, toast]);

  if (value) {
    return (
      <div className="space-y-2 rounded-lg border border-stone-200 bg-stone-50 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-stone-800">{value.name}</p>
            <p className="truncate text-xs text-stone-500">{[value.email, value.phone].filter(Boolean).join(' · ') || 'No contact details'}</p>
          </div>
          <button
            type="button"
            className="btn-ghost !px-2 !py-1 text-xs"
            onClick={() => {
              onChange(null);
              setQuery('');
            }}
          >
            Change
          </button>
        </div>
        <AllergyBanner allergies={value.preferences.allergies} dietary={value.preferences.dietary} />
        {value.preferences.allergies.length === 0 && value.preferences.dietary.length === 0 ? (
          <p className="text-xs text-stone-400">No allergies or dietary preferences on file.</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        type="search"
        className="input"
        placeholder="Search by name, email or phone (optional)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Find a customer"
      />
      {query.trim().length >= 2 ? (
        <div className="mt-1 rounded-lg border border-stone-200 bg-white shadow-sm">
          {searching && results.length === 0 ? (
            <p className="px-3 py-2 text-xs text-stone-400">Searching…</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-xs text-stone-400">No customers match “{query.trim()}”.</p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {results.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-stone-50"
                    onClick={() => onChange(c)}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-stone-800">{c.name}</span>
                      <span className="block truncate text-xs text-stone-500">{c.email || c.phone}</span>
                    </span>
                    {c.preferences.allergies.length ? (
                      <span className="badge shrink-0 bg-red-100 text-red-700">Allergies</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

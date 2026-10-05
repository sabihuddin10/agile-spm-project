'use client';

import { useEffect, useState } from 'react';
import type { Customer } from '@/types';
import { ALLERGY_OPTIONS, DIETARY_OPTIONS, optionsWith, toggleValue } from '@/components/customers/preference-options';

interface Draft {
  name: string;
  email: string;
  phone: string;
  type: 'walk-in' | 'online';
  dietary: string[];
  allergies: string[];
  notes: string;
}

const empty: Draft = { name: '', email: '', phone: '', type: 'walk-in', dietary: [], allergies: [], notes: '' };

/** Add or edit a ledger customer (US1.1) with dietary preferences and allergies (US1.5). */
export function CustomerForm({
  initial,
  onSubmit,
  onCancel,
  submitting,
  error,
}: {
  initial?: Customer | null;
  onSubmit: (data: Partial<Customer>) => void;
  onCancel: () => void;
  submitting?: boolean;
  /** Server validation message, shown inside the dialog. */
  error?: string | null;
}) {
  const [draft, setDraft] = useState<Draft>(empty);

  useEffect(() => {
    setDraft(
      initial
        ? {
            name: initial.name,
            email: initial.email,
            phone: initial.phone,
            type: initial.type,
            dietary: initial.preferences.dietary,
            allergies: initial.preferences.allergies,
            notes: initial.notes,
          }
        : empty,
    );
  }, [initial]);

  function toggle(list: 'dietary' | 'allergies', value: string) {
    setDraft((d) => ({ ...d, [list]: toggleValue(d[list], value) }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      name: draft.name.trim(),
      email: draft.email.trim(),
      phone: draft.phone.trim(),
      type: draft.type,
      preferences: { dietary: draft.dietary, allergies: draft.allergies },
      notes: draft.notes,
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="customer-name" className="label">
            Full name *
          </label>
          <input
            id="customer-name"
            className="input"
            required
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor="customer-phone" className="label">
            Phone
          </label>
          <input
            id="customer-phone"
            type="tel"
            className="input"
            value={draft.phone}
            onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor="customer-email" className="label">
            Email
          </label>
          <input
            id="customer-email"
            type="email"
            className="input"
            value={draft.email}
            onChange={(e) => setDraft({ ...draft, email: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor="customer-type-field" className="label">
            Type
          </label>
          <select
            id="customer-type-field"
            className="input"
            value={draft.type}
            onChange={(e) => setDraft({ ...draft, type: e.target.value as 'walk-in' | 'online' })}
          >
            <option value="walk-in">Walk-in</option>
            <option value="online">Online</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="label">Dietary preferences</p>
          <div className="flex flex-wrap gap-2">
            {optionsWith(DIETARY_OPTIONS, draft.dietary).map((d) => (
              <Chip key={d} active={draft.dietary.includes(d)} onClick={() => toggle('dietary', d)} label={d} />
            ))}
          </div>
        </div>
        <div>
          <p className="label">Allergies</p>
          <div className="flex flex-wrap gap-2">
            {optionsWith(ALLERGY_OPTIONS, draft.allergies).map((a) => (
              <Chip key={a} active={draft.allergies.includes(a)} onClick={() => toggle('allergies', a)} label={a} danger />
            ))}
          </div>
        </div>
      </div>

      <div>
        <label htmlFor="customer-notes" className="label">
          Notes
        </label>
        <textarea
          id="customer-notes"
          className="input min-h-[72px]"
          value={draft.notes}
          onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
        />
      </div>

      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="btn-secondary" disabled={submitting}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Saving…' : initial ? 'Save changes' : 'Add customer'}
        </button>
      </div>
    </form>
  );
}

function Chip({
  label,
  active,
  onClick,
  danger = false,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={active}
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
        active
          ? danger
            ? 'border-red-300 bg-red-50 text-red-700'
            : 'border-emerald-300 bg-emerald-50 text-emerald-700'
          : 'border-stone-200 bg-white text-stone-500 hover:bg-stone-50'
      }`}
    >
      {label}
    </button>
  );
}
'use client';

import { useState } from 'react';
import type { Table } from '@/types';

export interface TableFormValues {
  number: number;
  seats: number;
  zone: string;
}

const NEW_ZONE = '__new__';

/**
 * Add or edit a table's number, seats and zone (US6.1). Zones can be picked
 * from the existing floor or typed as a new one.
 */
export function TableForm({
  initial,
  zones,
  takenNumbers,
  submitting,
  onSubmit,
  onCancel,
}: {
  initial: Table | null;
  zones: string[];
  /** Numbers used by other tables, for an early duplicate warning. */
  takenNumbers: number[];
  submitting: boolean;
  onSubmit: (values: TableFormValues) => void;
  onCancel: () => void;
}) {
  const suggested = takenNumbers.length ? Math.max(...takenNumbers) + 1 : 1;
  const [number, setNumber] = useState(String(initial?.number ?? suggested));
  const [seats, setSeats] = useState(String(initial?.seats ?? 4));
  const [zone, setZone] = useState(initial?.zone ?? zones[0] ?? NEW_ZONE);
  const [newZone, setNewZone] = useState('');
  const [errors, setErrors] = useState<Partial<Record<'number' | 'seats' | 'zone', string>>>({});

  const creatingZone = zone === NEW_ZONE || zones.length === 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(number);
    const s = Number(seats);
    const z = (creatingZone ? newZone : zone).trim();
    const found: typeof errors = {};
    if (!number.trim() || !Number.isInteger(n) || n < 1) found.number = 'Enter a whole number of 1 or more.';
    else if (takenNumbers.includes(n)) found.number = `Table ${n} already exists.`;
    if (!seats.trim() || !Number.isInteger(s) || s < 1 || s > 20) found.seats = 'Seats must be between 1 and 20.';
    if (!z) found.zone = 'Choose a zone or type a new one.';
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    onSubmit({ number: n, seats: s, zone: z });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="tbl-number">
            Table number
          </label>
          <input
            id="tbl-number"
            className="input"
            type="number"
            inputMode="numeric"
            min={1}
            value={number}
            aria-invalid={Boolean(errors.number)}
            onChange={(e) => setNumber(e.target.value)}
          />
          {errors.number ? <p className="mt-1 text-xs text-red-600">{errors.number}</p> : null}
        </div>
        <div>
          <label className="label" htmlFor="tbl-seats">
            Seats
          </label>
          <input
            id="tbl-seats"
            className="input"
            type="number"
            inputMode="numeric"
            min={1}
            max={20}
            value={seats}
            aria-invalid={Boolean(errors.seats)}
            onChange={(e) => setSeats(e.target.value)}
          />
          {errors.seats ? <p className="mt-1 text-xs text-red-600">{errors.seats}</p> : null}
        </div>
      </div>

      <div>
        <label className="label" htmlFor="tbl-zone">
          Zone
        </label>
        {zones.length > 0 ? (
          <select id="tbl-zone" className="input" value={zone} onChange={(e) => setZone(e.target.value)}>
            {zones.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
            <option value={NEW_ZONE}>+ New zone…</option>
          </select>
        ) : null}
        {creatingZone ? (
          <input
            id={zones.length > 0 ? 'tbl-new-zone' : 'tbl-zone'}
            className={`input ${zones.length > 0 ? 'mt-2' : ''}`}
            placeholder="e.g. Patio, Private room"
            aria-label="New zone name"
            value={newZone}
            maxLength={40}
            autoFocus={zones.length > 0}
            onChange={(e) => setNewZone(e.target.value)}
          />
        ) : null}
        {errors.zone ? <p className="mt-1 text-xs text-red-600">{errors.zone}</p> : null}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Saving…' : initial ? 'Save changes' : 'Add table'}
        </button>
      </div>
    </form>
  );
}

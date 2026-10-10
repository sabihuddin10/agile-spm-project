'use client';

import { useState } from 'react';
import type { Table } from '@/types';
import { FieldError, SubmitHint, describedBy } from '@/components/forms/field-error';
import { TONES } from '@/components/forms/tone';
import { useFormValidation, type Rules } from '@/lib/validation/use-form-validation';

export interface TableFormValues {
  number: number;
  seats: number;
  zone: string;
}

const NEW_ZONE = '__new__';
/** Limits from server/src/routes/tables.js. */
const TABLE_NUMBER_MAX = 9999;
const ZONE_MAX = 40;
const ERR = TONES.light.inputError;

type Values = { number: string; seats: string; zone: string };

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
  const creatingZone = zone === NEW_ZONE || zones.length === 0;
  const effectiveZone = (creatingZone ? newZone : zone).trim();

  const rules: Rules<Values> = {
    number: (v) => {
      const n = Number(v);
      if (!v.trim() || !Number.isInteger(n) || n < 1) return 'Enter a whole number of 1 or more.';
      if (n > TABLE_NUMBER_MAX) return `Table numbers go up to ${TABLE_NUMBER_MAX}.`;
      if (takenNumbers.includes(n)) return `Table ${n} already exists.`;
      return undefined;
    },
    seats: (v) => {
      const s = Number(v);
      return !v.trim() || !Number.isInteger(s) || s < 1 || s > 20 ? 'Seats must be between 1 and 20.' : undefined;
    },
    zone: (v) => (v ? undefined : 'Choose a zone or type a new one.'),
  };
  const v = useFormValidation<Values>({ number, seats, zone: effectiveZone }, rules, {
    labels: { number: 'Table number', seats: 'Seats', zone: 'Zone' },
  });
  const errors = v.errors;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!v.touchAll()) return;
    onSubmit({ number: Number(number), seats: Number(seats), zone: effectiveZone });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-3 sm:space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="tbl-number">
            Table number
          </label>
          <input
            id="tbl-number"
            className={`input ${errors.number ? ERR : ''}`}
            type="number"
            inputMode="numeric"
            min={1}
            max={TABLE_NUMBER_MAX}
            placeholder="12"
            value={number}
            aria-invalid={Boolean(errors.number)}
            aria-describedby={describedBy(errors.number && 'tbl-number-err')}
            onChange={(e) => setNumber(e.target.value)}
            onBlur={() => v.blur('number')}
          />
          <FieldError id="tbl-number-err" message={errors.number} />
        </div>
        <div>
          <label className="label" htmlFor="tbl-seats">
            Seats
          </label>
          <input
            id="tbl-seats"
            className={`input ${errors.seats ? ERR : ''}`}
            type="number"
            inputMode="numeric"
            min={1}
            max={20}
            placeholder="4"
            value={seats}
            aria-invalid={Boolean(errors.seats)}
            aria-describedby={describedBy(errors.seats && 'tbl-seats-err')}
            onChange={(e) => setSeats(e.target.value)}
            onBlur={() => v.blur('seats')}
          />
          <FieldError id="tbl-seats-err" message={errors.seats} />
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
            className={`input ${zones.length > 0 ? 'mt-2' : ''} ${errors.zone ? ERR : ''}`}
            placeholder="e.g. Main hall"
            aria-label="New zone name"
            value={newZone}
            maxLength={ZONE_MAX}
            autoFocus={zones.length > 0}
            aria-invalid={Boolean(errors.zone)}
            aria-describedby={describedBy(errors.zone && 'tbl-zone-err')}
            onChange={(e) => setNewZone(e.target.value)}
            onBlur={() => v.blur('zone')}
          />
        ) : null}
        <FieldError id="tbl-zone-err" message={errors.zone} />
      </div>

      <div className="space-y-2 pt-2">
        <SubmitHint id="tbl-submit-hint" fields={v.invalidLabels} className="text-right" />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={submitting || !v.isValid}
            aria-disabled={submitting || !v.isValid}
            aria-describedby={v.isValid ? undefined : 'tbl-submit-hint'}
          >
            {submitting ? 'Saving…' : initial ? 'Save changes' : 'Add table'}
          </button>
        </div>
      </div>
    </form>
  );
}

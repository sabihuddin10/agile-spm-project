'use client';

import { useEffect, useState } from 'react';
import { money } from '@/lib/format';
import { ConfirmDialog } from '@/components/staff/confirm-dialog';

/** Admin control: change a staff member's hourly wage, with a confirmation step. */
export function WageEditor({
  name,
  wage,
  onSave,
}: {
  name: string;
  wage: number;
  onSave: (hourlyWage: number) => Promise<void>;
}) {
  const [value, setValue] = useState(String(wage));
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => setValue(String(wage)), [wage]);

  const next = Number(value);
  const dirty = value.trim() !== '' && next !== wage;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!Number.isFinite(next) || next <= 0 || next > 500) {
      setError('Enter an hourly wage between $0.01 and $500.');
      return;
    }
    setError(null);
    setConfirming(true);
  }

  async function confirm() {
    setBusy(true);
    try {
      await onSave(Math.round(next * 100) / 100);
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-1">
      <label htmlFor="wage-input" className="label">
        Hourly wage
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative sm:w-40">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-stone-400">$</span>
          <input
            id="wage-input"
            className={`input pl-7 ${error ? 'border-red-400' : ''}`}
            type="number"
            inputMode="decimal"
            min={0}
            max={500}
            step={0.25}
            placeholder="e.g. 15.50"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'wage-error' : undefined}
          />
        </div>
        <button type="submit" className="btn-secondary" disabled={!dirty}>
          Update wage
        </button>
      </div>
      {error ? (
        <p id="wage-error" role="alert" className="text-xs font-medium text-red-600">
          {error}
        </p>
      ) : null}
      {confirming ? (
        <ConfirmDialog
          title="Change hourly wage"
          confirmLabel="Change wage"
          danger={false}
          busy={busy}
          onConfirm={confirm}
          onCancel={() => setConfirming(false)}
        >
          <p>
            Change {name}&apos;s hourly wage from <strong>{money(wage)}</strong> to <strong>{money(next)}</strong>? Pay
            estimates are recalculated with the new rate.
          </p>
        </ConfirmDialog>
      ) : null}
    </form>
  );
}

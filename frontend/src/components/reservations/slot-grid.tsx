'use client';

import type { TimeSlot } from '@/types';
import { localDateISO } from '@/lib/format';

type Variant = 'staff' | 'storefront';

const STYLES: Record<Variant, { idle: string; selected: string; off: string; heading: string; note: string }> = {
  staff: {
    idle: 'border-stone-300 bg-white text-stone-700 hover:border-brand-400 hover:bg-brand-50',
    selected: 'border-brand-600 bg-brand-600 text-white',
    off: 'cursor-not-allowed border-stone-200 bg-stone-50 text-stone-400',
    heading: 'text-stone-500',
    note: 'text-stone-500',
  },
  storefront: {
    idle: 'border-char-hairline bg-char-deep text-bone hover:border-ember/50',
    selected: 'border-ember bg-ember text-bone shadow-ember',
    off: 'cursor-not-allowed border-char-hairline/60 bg-transparent text-bone-faint/70',
    heading: 'text-bone-faint',
    note: 'text-bone-dim',
  },
};

function isPast(date: string, time: string): boolean {
  if (date !== localDateISO()) return date < localDateISO();
  const now = new Date();
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m < now.getHours() * 60 + now.getMinutes();
}

/**
 * Selectable booking times for one day, split into lunch and dinner. Full or
 * already-passed slots are disabled with a hint (US7.1).
 */
export function SlotGrid({
  date,
  slots,
  value,
  onChange,
  loading,
  error,
  variant = 'staff',
}: {
  date: string;
  slots: TimeSlot[];
  value: string;
  onChange: (time: string) => void;
  loading: boolean;
  error?: string;
  variant?: Variant;
}) {
  const s = STYLES[variant];

  if (!date) return <p className={`text-sm ${s.note}`}>Pick a date to see available times.</p>;
  if (error) return <p className="text-sm text-red-500">{error}</p>;
  if (loading && slots.length === 0) return <p className={`text-sm ${s.note}`}>Checking availability…</p>;
  if (slots.length === 0) return null;

  const groups = [
    { label: 'Lunch', slots: slots.filter((x) => Number(x.time.slice(0, 2)) < 16) },
    { label: 'Dinner', slots: slots.filter((x) => Number(x.time.slice(0, 2)) >= 16) },
  ].filter((g) => g.slots.length > 0);
  const anyOpen = slots.some((x) => x.available);

  return (
    <div className="space-y-3">
      {groups.map((g) => (
        <div key={g.label}>
          <p className={`mb-1.5 text-xs font-semibold uppercase tracking-wide ${s.heading}`}>{g.label}</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {g.slots.map((slot) => {
              const selected = slot.available && slot.time === value;
              const hint = slot.available ? null : isPast(date, slot.time) ? 'Past' : 'Full';
              return (
                <button
                  key={slot.time}
                  type="button"
                  disabled={!slot.available}
                  aria-pressed={selected}
                  aria-label={hint ? `${slot.time}, ${hint.toLowerCase()}` : slot.time}
                  onClick={() => onChange(slot.time)}
                  className={`flex flex-col items-center rounded-lg border px-2 py-1.5 text-sm font-semibold tabular-nums transition ${
                    selected ? s.selected : slot.available ? s.idle : s.off
                  }`}
                >
                  <span className={hint ? 'line-through decoration-1' : ''}>{slot.time}</span>
                  {hint ? <span className="text-xs font-medium no-underline">{hint}</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {!anyOpen ? (
        <p className={`text-sm ${s.note}`}>Fully booked for this party size on that day. Try another date.</p>
      ) : null}
    </div>
  );
}

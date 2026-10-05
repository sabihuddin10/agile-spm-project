'use client';

import type { Granularity } from '@/types';
import { addDaysISO, localDateISO } from '@/lib/format';
import { Segmented } from '@/components/analytics/analytics-card';

export type RangePreset = '7' | '30' | '60' | '90' | 'month' | 'custom';

export interface RangeState {
  preset: RangePreset;
  from: string;
  to: string;
  granularity: Granularity;
}

const PRESETS: { value: Exclude<RangePreset, 'custom'>; label: string }[] = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '60', label: 'Last 60 days' },
  { value: '90', label: 'Last 90 days' },
  { value: 'month', label: 'This month' },
];

const GRANULARITIES: { value: Granularity; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

/** Date range for a preset, ending today (local time). */
export function presetRange(preset: Exclude<RangePreset, 'custom'>): { from: string; to: string } {
  const to = localDateISO();
  if (preset === 'month') return { from: `${to.slice(0, 7)}-01`, to };
  return { from: addDaysISO(-(Number(preset) - 1)), to };
}

/**
 * Period filter for the analytics dashboard: range presets, a custom from/to,
 * and the Day / Week / Month grouping used by the trend (US10.1 "by the selected period").
 */
export function RangeControls({
  value,
  onChange,
  error,
}: {
  value: RangeState;
  onChange: (next: RangeState) => void;
  error?: string | null;
}) {
  const today = localDateISO();

  return (
    <div>
      <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-end 2xl:justify-between">
        <div className="min-w-0">
          <p className="label">Period</p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Date range presets">
            {PRESETS.map((p) => {
              const active = value.preset === p.value;
              return (
                <button
                  key={p.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChange({ ...value, preset: p.value, ...presetRange(p.value) })}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                    active
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:text-stone-900'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="label">From</span>
              <input
                type="date"
                className={`input !py-1.5 ${error ? '!border-red-400' : ''}`}
                value={value.from}
                max={value.to || today}
                aria-invalid={Boolean(error)}
                onChange={(e) => e.target.value && onChange({ ...value, preset: 'custom', from: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="label">To</span>
              <input
                type="date"
                className={`input !py-1.5 ${error ? '!border-red-400' : ''}`}
                value={value.to}
                min={value.from}
                max={today}
                aria-invalid={Boolean(error)}
                onChange={(e) => e.target.value && onChange({ ...value, preset: 'custom', to: e.target.value })}
              />
            </label>
          </div>
          <div>
            <p className="label">Group by</p>
            <Segmented
              label="Group trend by"
              size="md"
              value={value.granularity}
              options={GRANULARITIES}
              onChange={(granularity) => onChange({ ...value, granularity })}
            />
          </div>
        </div>
      </div>
      {error ? (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

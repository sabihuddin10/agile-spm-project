'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { AnalyticsDashboard, StockHealth } from '@/types';
import { AnalyticsCard } from '@/components/analytics/analytics-card';
import { pct } from '@/components/analytics/analytics-format';
import { Badge } from '@/components/ui/badge';

type Row = AnalyticsDashboard['inventory'][number];

const STATUS: Record<StockHealth, { label: string; tone: 'red' | 'amber' | 'emerald'; bar: string }> = {
  low: { label: 'Low', tone: 'red', bar: 'bg-red-500' },
  near: { label: 'Near reorder', tone: 'amber', bar: 'bg-amber-500' },
  ok: { label: 'OK', tone: 'emerald', bar: 'bg-emerald-500' },
};

/** Coverage = stock as a % of reorder level; the bar spans 0–200% with a tick at the reorder level. */
function CoverageBar({ item }: { item: Row }) {
  const width = Math.min(100, Math.max(2, item.coverage / 2));
  return (
    <div className="relative mt-1.5 h-1.5 rounded-full bg-stone-100" aria-hidden="true">
      <div className={`h-full rounded-full ${STATUS[item.status].bar}`} style={{ width: `${width}%` }} />
      <div className="absolute inset-y-[-3px] left-1/2 w-px bg-stone-400" title="Reorder level" />
    </div>
  );
}

function ItemRow({ item }: { item: Row }) {
  const s = STATUS[item.status];
  return (
    <li className="py-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-medium text-stone-800">{item.name}</p>
        <Badge tone={s.tone}>{s.label}</Badge>
      </div>
      <p className="mt-0.5 text-xs text-stone-500">
        <span className="tabular-nums text-stone-700">
          {item.stock} {item.unit}
        </span>{' '}
        in stock · reorder at {item.reorderLevel} {item.unit} ·{' '}
        <span className="tabular-nums">{pct(item.coverage)}</span> coverage
      </p>
      <CoverageBar item={item} />
    </li>
  );
}

/**
 * US10.5 — inventory health ranked by coverage (stock ÷ reorder level): items
 * at or below reorder level in red, within 25% of it in amber.
 */
export function InventoryHealth({ items, className = '' }: { items: AnalyticsDashboard['inventory']; className?: string }) {
  const [showAll, setShowAll] = useState(false);
  const atRisk = items.filter((i) => i.status !== 'ok');
  const healthy = items.filter((i) => i.status === 'ok');
  const lowCount = items.filter((i) => i.status === 'low').length;
  const nearCount = atRisk.length - lowCount;

  return (
    <AnalyticsCard
      title="Inventory health"
      story="US10.5"
      subtitle="Current stock, lowest coverage first."
      className={className}
      action={
        <Link href="/staff/inventory" className="text-sm font-medium text-brand-700 hover:text-brand-800 hover:underline">
          Inventory →
        </Link>
      }
    >
      <div className="mb-2 flex flex-wrap gap-2 text-xs">
        <Badge tone="red">{lowCount} low</Badge>
        <Badge tone="amber">{nearCount} near reorder</Badge>
        <Badge tone="emerald">{healthy.length} healthy</Badge>
      </div>

      {atRisk.length === 0 ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
          ✓ Every ingredient is comfortably above its reorder level.
        </p>
      ) : (
        <ul className="divide-y divide-stone-100">
          {atRisk.map((i) => (
            <ItemRow key={i.id} item={i} />
          ))}
        </ul>
      )}

      {healthy.length > 0 ? (
        <>
          {showAll ? (
            <ul className="divide-y divide-stone-100 border-t border-stone-100">
              {healthy.map((i) => (
                <ItemRow key={i.id} item={i} />
              ))}
            </ul>
          ) : null}
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="mt-2 self-start text-xs font-medium text-stone-500 hover:text-stone-800"
            aria-expanded={showAll}
          >
            {showAll ? 'Hide healthy items' : `Show ${healthy.length} healthy item${healthy.length === 1 ? '' : 's'}`}
          </button>
        </>
      ) : null}
      <p className="mt-3 text-xs text-stone-500">Bar: stock vs. reorder level (tick = reorder level, full = 2× reorder level).</p>
    </AnalyticsCard>
  );
}

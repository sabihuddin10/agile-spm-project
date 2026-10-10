'use client';

import { useState } from 'react';
import type { Order, Role } from '@/types';
import { orderApi } from '@/lib/api';
import { can } from '@/lib/permissions';
import { errorMessage, formatMinutes, minutesSince } from '@/lib/format';
import { useToast } from '@/components/ui/toast';

/**
 * An order waiting at the pass (US4.3): where it goes, how long it has been
 * ready, and confirmation that floor staff were notified. Floor roles who can
 * also see the KDS (manager, admin) may mark it served from here.
 */
export function ReadyTicket({
  order,
  now,
  role,
  onChanged,
}: {
  order: Order;
  now: number;
  role: Role | undefined;
  onChanged: () => Promise<unknown> | void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const waited = minutesSince(order.readyAt, now);
  const where =
    order.type === 'dine-in'
      ? order.tableNumber
        ? `Table ${order.tableNumber}`
        : 'Dine-in · no table'
      : order.fulfillment === 'delivery'
        ? 'Delivery'
        : 'Pickup';

  async function serve() {
    setBusy(true);
    try {
      await orderApi.setStatus(order.id, 'served');
      toast(`Order #${order.number} served.`, 'success');
      await onChanged();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-base font-bold text-stone-900">#{order.number}</p>
          <p className="text-sm font-semibold text-emerald-800">{where}</p>
        </div>
        <p className={`shrink-0 text-right text-sm font-semibold tabular-nums ${waited >= 5 ? 'text-amber-700' : 'text-emerald-700'}`}>
          {waited < 1 ? 'Just now' : `${formatMinutes(waited)} waiting`}
        </p>
      </div>
      <p className="mt-1.5 text-xs text-stone-600">{order.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}</p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1 text-xs font-medium text-emerald-700">
          <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M10 2a6 6 0 00-6 6c0 1.887-.454 3.665-1.257 5.234a.75.75 0 00.515 1.076 32.91 32.91 0 003.256.508 3.5 3.5 0 006.972 0 32.903 32.903 0 003.256-.508.75.75 0 00.515-1.076A11.448 11.448 0 0116 8a6 6 0 00-6-6zm0 14.5a2 2 0 01-1.95-1.557 33.54 33.54 0 003.9 0A2 2 0 0110 16.5z" />
          </svg>
          Floor staff notified{order.waiterName ? ` · ${order.waiterName}` : ''}
        </p>
        {can.serveOrders(role) ? (
          <button type="button" className="btn-sm btn-secondary" disabled={busy} onClick={serve}>
            {busy ? 'Saving…' : 'Mark served'}
          </button>
        ) : null}
      </div>
    </li>
  );
}

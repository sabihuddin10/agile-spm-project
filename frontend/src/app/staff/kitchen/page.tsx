'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { KitchenResponse } from '@/types';
import { orderApi } from '@/lib/api';
import { canAccess } from '@/lib/permissions';
import { errorMessage } from '@/lib/format';
import { useAuth } from '@/context/auth-context';
import { useNow, usePolling } from '@/hooks/use-polling';
import { StaffLayout } from '@/components/layout/staff-layout';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';
import { KitchenTicket, isDelayed } from '@/components/orders/kitchen-ticket';
import { ReadyTicket } from '@/components/orders/ready-ticket';
import { useMenuIndex } from '@/components/orders/use-order-menu';

/**
 * Kitchen display system: the live queue in server order
 * (rush first, then oldest confirmed) with per-dish Start → Ready, delay flags
 * past the configured threshold, rush / reorder controls, and a separate
 * "Ready for pickup" list. Refreshes every 5 seconds.
 */
export default function KitchenPage() {
  const { user } = useAuth();
  const toast = useToast();
  const role = user?.role;
  const allowed = canAccess(role, 'kitchen');
  const now = useNow(15000);
  const menuById = useMenuIndex(allowed);

  const [data, setData] = useState<KitchenResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);
  const lastError = useRef<string | null>(null);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    try {
      const next = await orderApi.kitchen();
      if (mine !== seq.current) return;
      setData(next);
      setError(null);
      lastError.current = null;
    } catch (err) {
      if (mine !== seq.current) return;
      const message = errorMessage(err, 'Failed to load the kitchen queue.');
      if (!lastError.current) toast(message, 'error');
      lastError.current = message;
      setError(message);
    }
  }, [toast]);

  useEffect(() => {
    if (allowed) load();
  }, [allowed, load]);
  usePolling(load, 5000, allowed);

  const queue = data?.queue ?? [];
  const ready = data?.ready ?? [];
  const delayMinutes = data?.delayMinutes ?? 15;
  const delayedCount = queue.filter((o) => isDelayed(o, delayMinutes, now)).length;
  const rushCount = queue.filter((o) => o.priority === 'rush').length;

  return (
    <StaffLayout section="kitchen">
      <PageHeader
        title="Kitchen display"
        subtitle="Rush orders first, then oldest confirmed. Refreshes every 5 seconds."
        action={
          data ? (
            <Badge tone={delayedCount ? 'red' : 'stone'} className="!px-3 !py-1 !text-sm">
              Flag after {delayMinutes} min
            </Badge>
          ) : null
        }
      />

      {error && data ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          <span>Couldn&apos;t refresh the queue: {error} Retrying automatically…</span>
          <button type="button" className="btn-sm btn-ghost text-red-700 hover:bg-red-100" onClick={() => load()}>
            Retry now
          </button>
        </div>
      ) : null}

      {!data ? (
        <Card>
          {error ? (
            <EmptyState
              title="Couldn't load the kitchen queue"
              hint={error}
              action={
                <button type="button" className="btn-secondary" onClick={() => load()}>
                  Try again
                </button>
              }
            />
          ) : (
            <Spinner label="Loading kitchen queue…" />
          )}
        </Card>
      ) : (
        <>
          <dl className="mb-4 grid grid-cols-1 gap-2.5 sm:mb-5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4">
            <Stat label="In queue" value={queue.length} />
            <Stat label="Delayed" value={delayedCount} tone={delayedCount ? 'red' : undefined} />
            <Stat label="Rush" value={rushCount} tone={rushCount ? 'amber' : undefined} />
            <Stat label="Ready for pickup" value={ready.length} tone={ready.length ? 'emerald' : undefined} />
          </dl>

          <div className="grid gap-4 sm:gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
            <section aria-labelledby="queue-heading">
              <h2 id="queue-heading" className="mb-2 text-base font-semibold text-stone-900 sm:mb-3 sm:text-lg">
                Queue
              </h2>
              {queue.length === 0 ? (
                <Card>
                  <EmptyState title="Kitchen is clear" hint="Confirmed orders appear here automatically, rush orders first." />
                </Card>
              ) : (
                <ol className="grid gap-3 sm:gap-4 md:grid-cols-2 2xl:grid-cols-3">
                  {queue.map((order, i) => {
                    const band = queue.filter((o) => o.priority === order.priority);
                    const idx = band.findIndex((o) => o.id === order.id);
                    return (
                      <li key={order.id}>
                        <KitchenTicket
                          order={order}
                          position={i + 1}
                          delayMinutes={delayMinutes}
                          now={now}
                          role={role}
                          canMoveUp={idx > 0}
                          canMoveDown={idx < band.length - 1}
                          menuById={menuById}
                          onChanged={load}
                        />
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>

            <aside aria-labelledby="ready-heading">
              <div className="mb-2 flex items-baseline justify-between gap-2 sm:mb-3">
                <h2 id="ready-heading" className="text-base font-semibold text-stone-900 sm:text-lg">
                  Ready for pickup
                </h2>
                <span className="text-xs text-stone-500">Floor staff notified</span>
              </div>
              {ready.length === 0 ? (
                <Card>
                  <EmptyState title="Nothing at the pass" hint="Orders move here when every dish is ready." />
                </Card>
              ) : (
                <ul className="space-y-2 sm:space-y-3">
                  {ready.map((order) => (
                    <ReadyTicket key={order.id} order={order} now={now} role={role} onChanged={load} />
                  ))}
                </ul>
              )}
            </aside>
          </div>
        </>
      )}
    </StaffLayout>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'red' | 'amber' | 'emerald' }) {
  const color =
    tone === 'red' ? 'text-red-600' : tone === 'amber' ? 'text-amber-600' : tone === 'emerald' ? 'text-emerald-600' : 'text-stone-900';
  return (
    // On phones label and number share one line, so the four tiles stay short.
    <div className="flex items-baseline justify-between gap-3 rounded-xl border border-stone-200 bg-white p-3 shadow-sm sm:block sm:px-4 sm:py-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-stone-500">{label}</dt>
      <dd className={`text-xl font-bold tabular-nums sm:mt-1 sm:text-2xl ${color}`}>{value}</dd>
    </div>
  );
}

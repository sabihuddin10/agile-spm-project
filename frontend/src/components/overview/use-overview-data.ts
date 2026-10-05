'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AnalyticsSummary, InventoryItem, KitchenResponse, Order, Shift, Table, User } from '@/types';
import { analyticsApi, inventoryApi, orderApi, staffApi, tableApi } from '@/lib/api';
import { addDaysISO, errorMessage, localDateISO } from '@/lib/format';
import { canAccess } from '@/lib/permissions';
import { usePolling } from '@/hooks/use-polling';
import { useToast } from '@/components/ui/toast';

export const OVERVIEW_POLL_MS = 10_000;

export interface OverviewData {
  /** Floor staff (waiter/manager/admin). */
  placed: Order[] | null;
  ready: Order[] | null;
  tables: Table[] | null;
  /** Kitchen (chef/manager/admin). */
  kitchen: KitchenResponse | null;
  /** Manager/admin. */
  summary: AnalyticsSummary | null;
  /** Anyone with inventory access (chef/manager/admin). */
  inventory: InventoryItem[] | null;
  /** Everyone — the next 30 days of the signed-in user's rota. */
  shifts: Shift[] | null;
}

const EMPTY: OverviewData = {
  placed: null,
  ready: null,
  tables: null,
  kitchen: null,
  summary: null,
  inventory: null,
  shifts: null,
};

/** What each role's overview shows — mirrors the server's role guards. */
export function overviewAccess(role: User['role']) {
  return {
    floor: canAccess(role, 'orders'),
    kitchen: canAccess(role, 'kitchen'),
    summary: canAccess(role, 'analytics'),
    inventory: canAccess(role, 'inventory'),
  };
}

const skip = Promise.resolve(null);

/**
 * Loads the role-tailored overview widgets and keeps them live (polls every
 * 10 s while the tab is visible). A failing endpoint keeps its last good value;
 * the error is toasted once, not on every poll.
 */
export function useOverviewData(user: User) {
  const toast = useToast();
  const [data, setData] = useState<OverviewData>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const failing = useRef(false);
  const role = user.role;

  const load = useCallback(async () => {
    const access = overviewAccess(role);
    try {
      const [placed, ready, tables, kitchen, summary, inventory, shifts] = await Promise.allSettled([
        access.floor ? orderApi.list({ status: 'placed' }) : skip,
        access.floor ? orderApi.list({ status: 'ready' }) : skip,
        access.floor ? tableApi.list() : skip,
        access.kitchen ? orderApi.kitchen() : skip,
        access.summary ? analyticsApi.summary() : skip,
        access.inventory ? inventoryApi.list() : skip,
        staffApi.myShifts({ from: localDateISO(), to: addDaysISO(30) }),
      ]);

      setData((prev) => ({
        placed: placed.status === 'fulfilled' ? placed.value?.orders ?? null : prev.placed,
        ready: ready.status === 'fulfilled' ? ready.value?.orders ?? null : prev.ready,
        tables: tables.status === 'fulfilled' ? tables.value?.tables ?? null : prev.tables,
        kitchen: kitchen.status === 'fulfilled' ? kitchen.value : prev.kitchen,
        summary: summary.status === 'fulfilled' ? summary.value?.summary ?? null : prev.summary,
        inventory: inventory.status === 'fulfilled' ? inventory.value?.inventory ?? null : prev.inventory,
        shifts: shifts.status === 'fulfilled' ? shifts.value.shifts : prev.shifts,
      }));

      const rejected = [placed, ready, tables, kitchen, summary, inventory, shifts].find(
        (r): r is PromiseRejectedResult => r.status === 'rejected',
      );
      if (rejected) throw rejected.reason;
      failing.current = false;
      setUpdatedAt(Date.now());
    } catch (err) {
      if (!failing.current) toast(errorMessage(err, 'Some live widgets failed to refresh.'), 'error');
      failing.current = true;
    } finally {
      setLoaded(true);
    }
  }, [role, toast]);

  useEffect(() => {
    load();
  }, [load]);

  usePolling(load, OVERVIEW_POLL_MS);

  return { data, loaded, updatedAt, reload: load };
}

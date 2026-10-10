'use client';

import { useCallback, useEffect, useState } from 'react';
import type { StaffAnalytics } from '@/types';
import { workforceApi } from '@/lib/workforce-api';
import { errorMessage } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/toast';
import { ConfirmDialog } from '@/components/staff/confirm-dialog';
import { ROLE_META } from '@/components/staff/role-meta';
import { AdjustmentForm } from '@/components/workforce/adjustment-form';
import { StaffWorkView } from '@/components/workforce/staff-work-view';
import { WageEditor } from '@/components/workforce/wage-editor';
import { monthBounds, signedMoney, trendBounds } from '@/components/workforce/workforce-format';
import { localDateISO } from '@/lib/format';

/**
 * One person's month from the Workforce hub. Read-only for managers (no money
 * at all); admins can change the hourly wage and add or remove bonuses.
 */
export function StaffDrilldown({
  userId,
  month,
  canManagePay,
  onBack,
  onChanged,
}: {
  userId: string;
  month: string;
  canManagePay: boolean;
  onBack: () => void;
  /** Called after a wage or bonus change so the hub can refresh its totals. */
  onChanged?: () => void;
}) {
  const toast = useToast();
  const [data, setData] = useState<StaffAnalytics | null>(null);
  const [trend, setTrend] = useState<StaffAnalytics | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    try {
      const [m, t] = await Promise.all([
        workforceApi.userAnalytics(userId, monthBounds(month)),
        workforceApi.userAnalytics(userId, trendBounds(month)),
      ]);
      setData(m);
      setTrend(t);
      setLoadError(false);
    } catch (err) {
      setLoadError(true);
      toast(errorMessage(err), 'error');
    }
  }, [userId, month, toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveWage(hourlyWage: number) {
    try {
      await workforceApi.setWage(userId, hourlyWage);
      toast('Hourly wage updated.', 'success');
      await load();
      onChanged?.();
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  }

  async function addAdjustment(input: { amount: number; reason: string; date: string }) {
    try {
      await workforceApi.addAdjustment(userId, input);
      toast(input.amount < 0 ? 'Correction added.' : 'Bonus added.', 'success');
      await load();
      onChanged?.();
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  }

  async function confirmRemove() {
    if (!removing) return;
    setBusy(true);
    try {
      await workforceApi.removeAdjustment(userId, removing);
      toast('Removed from pay.', 'success');
      setRemoving(null);
      await load();
      onChanged?.();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  const removingAdj = data?.pay?.bonuses.find((b) => b.id === removing) ?? null;
  const today = localDateISO();
  const { from, to } = monthBounds(month);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-secondary" onClick={onBack}>
          ← Back to team
        </button>
        {data ? (
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold text-stone-900">{data.user.name}</h2>
            <Badge tone={ROLE_META[data.user.role].tone}>{ROLE_META[data.user.role].label}</Badge>
          </div>
        ) : null}
      </div>

      {!data && loadError ? (
        <Card>
          <EmptyState
            title="Couldn't load this work record"
            hint="Check your connection, then try again."
            action={
              <button type="button" className="btn-secondary" onClick={() => load()}>
                Try again
              </button>
            }
          />
        </Card>
      ) : !data ? (
        <Card>
          <Spinner label="Loading work record…" />
        </Card>
      ) : (
        <StaffWorkView
          data={data}
          trend={trend}
          month={month}
          onRemoveAdjustment={canManagePay ? (id) => setRemoving(id) : undefined}
          payFooter={
            canManagePay && data.pay ? (
              <div className="mt-4 space-y-4 border-t sm:mt-5 sm:space-y-5 border-stone-200 pt-4">
                <WageEditor name={data.user.name} wage={data.pay.hourlyWage} onSave={saveWage} />
                <AdjustmentForm
                  name={data.user.name}
                  onSubmit={addAdjustment}
                  defaultDate={today >= from && today <= to ? today : from}
                />
              </div>
            ) : undefined
          }
        />
      )}

      {removingAdj ? (
        <ConfirmDialog
          title="Remove from pay"
          confirmLabel="Remove"
          busy={busy}
          onConfirm={confirmRemove}
          onCancel={() => setRemoving(null)}
        >
          <p>
            Remove “{removingAdj.reason}” ({signedMoney(removingAdj.amount)}) from {data?.user.name}&apos;s pay?
          </p>
        </ConfirmDialog>
      ) : null}
    </div>
  );
}

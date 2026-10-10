'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Table, TableStatus } from '@/types';
import { tableApi } from '@/lib/api';
import { can } from '@/lib/permissions';
import { TABLE_STATUS, errorMessage } from '@/lib/format';
import { usePolling } from '@/hooks/use-polling';
import { useAuth } from '@/context/auth-context';
import { StaffLayout } from '@/components/layout/staff-layout';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { Modal } from '@/components/ui/modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';
import { FloorLegend } from '@/components/tables/floor-legend';
import { TableTile } from '@/components/tables/table-tile';
import { TableForm, type TableFormValues } from '@/components/tables/table-form';

type FloorData = { tables: Table[]; zones: string[]; statuses: TableStatus[] };

const zoneId = (zone: string) => `zone-${zone.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

/** Live floor plan: tables by zone with status, orders, bookings and layout edits. */
export default function FloorPlanPage() {
  return (
    <StaffLayout section="tables">
      <FloorPlan />
    </StaffLayout>
  );
}

function FloorPlan() {
  const toast = useToast();
  const { user } = useAuth();
  const canEditLayout = can.editFloorLayout(user?.role);

  const [data, setData] = useState<FloorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [stale, setStale] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [form, setForm] = useState<{ table: Table | null } | null>(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<Table | null>(null);

  const request = useRef(0);

  // Only the latest request may write state, so a slow poll never overwrites
  // the result of an action the user just took.
  const load = useCallback(async () => {
    const id = ++request.current;
    try {
      const res = await tableApi.list();
      if (id !== request.current) return;
      setData(res);
      setStale(false);
    } catch (err) {
      if (id !== request.current) return;
      setStale(true);
      return err;
    } finally {
      if (id === request.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load().then((err) => {
      if (err) toast(errorMessage(err, 'Failed to load the floor plan.'), 'error');
    });
  }, [load, toast]);

  usePolling(load, 5000);

  const zones = useMemo(() => {
    if (!data) return [];
    const order = [...data.zones, ...data.tables.map((t) => t.zone).filter((z) => !data.zones.includes(z))];
    return order
      .map((zone) => ({ zone, tables: data.tables.filter((t) => t.zone === zone) }))
      .filter((g) => g.tables.length > 0);
  }, [data]);

  async function run(table: Table, action: () => Promise<unknown>, success: string) {
    setBusyId(table.id);
    try {
      await action();
      toast(success, 'success');
      await load();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusyId(null);
    }
  }

  const setStatus = (t: Table, status: TableStatus) =>
    run(t, () => tableApi.update(t.id, { status }), `Table ${t.number} marked ${TABLE_STATUS[status].label.toLowerCase()}.`);

  const toggleHold = (t: Table) =>
    run(
      t,
      () => tableApi.update(t.id, { held: !t.held }),
      t.held ? `Hold released on table ${t.number}.` : `Table ${t.number} is held — it won't be freed automatically.`,
    );

  const take = (t: Table) =>
    user && run(t, () => tableApi.update(t.id, { waiterId: user.id }), `You're now looking after table ${t.number}.`);

  async function confirmRemove() {
    if (!removing) return;
    await run(removing, () => tableApi.remove(removing.id), `Table ${removing.number} removed.`);
    setRemoving(null);
  }

  async function save(values: TableFormValues) {
    if (!form) return;
    setSaving(true);
    try {
      if (form.table) {
        await tableApi.update(form.table.id, values);
        toast(`Table ${values.number} updated.`, 'success');
      } else {
        await tableApi.create(values);
        toast(`Table ${values.number} added to ${values.zone}.`, 'success');
      }
      setForm(null);
      await load();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Floor plan"
        subtitle="Live table status by zone, refreshed every 5 seconds."
        action={
          canEditLayout ? (
            <button type="button" className="btn-primary" onClick={() => setForm({ table: null })}>
              + Add table
            </button>
          ) : null
        }
      />

      {loading ? (
        <Card>
          <Spinner label="Loading floor plan…" />
        </Card>
      ) : !data ? (
        <Card>
          <EmptyState
            title="Couldn't load the floor plan"
            hint="Check your connection and try again."
            action={
              <button type="button" className="btn-secondary" onClick={() => load()}>
                Retry
              </button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-4 sm:space-y-6">
          <div className="space-y-2">
            <FloorLegend tables={data.tables} statuses={data.statuses} />
            <p className="text-xs text-stone-500">
              <span className="font-medium text-stone-600">Reserved</span> is set automatically from an hour before a
              confirmed booking. Tables are freed automatically when their last order is paid — unless they&apos;re{' '}
              <span className="font-medium text-stone-600">Held</span> (e.g. guests staying on for drinks). A held table
              keeps its status until you change it yourself.
            </p>
            {stale ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800" role="status">
                Couldn&apos;t refresh just now — showing the last known floor. Retrying…
              </p>
            ) : null}
          </div>

          {zones.length === 0 ? (
            <Card>
              <EmptyState
                title="No tables yet"
                hint={canEditLayout ? 'Add your first table to build the floor plan.' : 'A manager needs to set up the floor plan.'}
              />
            </Card>
          ) : (
            zones.map(({ zone, tables }) => (
              <section key={zone} aria-labelledby={zoneId(zone)}>
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <h2 id={zoneId(zone)} className="text-base font-semibold text-stone-800">
                    {zone}
                  </h2>
                  <span className="text-xs text-stone-500">
                    {tables.length} {tables.length === 1 ? 'table' : 'tables'} ·{' '}
                    {tables.filter((t) => t.status === 'free').length} free
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                  {tables.map((t) => (
                    <TableTile
                      key={t.id}
                      table={t}
                      currentUserId={user?.id ?? null}
                      canEditLayout={canEditLayout}
                      busy={busyId === t.id}
                      onStatus={(s) => setStatus(t, s)}
                      onToggleHold={() => toggleHold(t)}
                      onTake={() => take(t)}
                      onEdit={() => setForm({ table: t })}
                      onRemove={() => setRemoving(t)}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      )}

      {form ? (
        <Modal title={form.table ? `Edit table ${form.table.number}` : 'Add table'} onClose={() => !saving && setForm(null)}>
          <TableForm
            initial={form.table}
            zones={data?.zones ?? []}
            takenNumbers={(data?.tables ?? []).filter((t) => t.id !== form.table?.id).map((t) => t.number)}
            submitting={saving}
            onSubmit={save}
            onCancel={() => setForm(null)}
          />
        </Modal>
      ) : null}

      {removing ? (
        <ConfirmDialog
          title={`Remove table ${removing.number}?`}
          confirmLabel="Remove table"
          busy={busyId === removing.id}
          onConfirm={confirmRemove}
          onCancel={() => setRemoving(null)}
        >
          <p>
            Table {removing.number} ({removing.zone}) will be taken off the floor plan. Past orders keep their table number.
          </p>
        </ConfirmDialog>
      ) : null}
    </>
  );
}

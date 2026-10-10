'use client';

import { useMemo, useState } from 'react';
import type { Shift, ShiftStatus, User } from '@/types';
import { staffApi } from '@/lib/api';
import { SHIFT_STATUS, errorMessage, formatDate, localDateISO } from '@/lib/format';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { ROLE_META, formatHours, hoursBetween, roleRank } from '@/components/staff/role-meta';

const STATUSES: ShiftStatus[] = ['scheduled', 'completed', 'missed'];
/** Shift notes are at most 500 characters (server/src/routes/staff.js). */
const NOTES_MAX = 500;

const STATUS_ACTIVE: Record<ShiftStatus, string> = {
  scheduled: 'border-blue-300 bg-blue-50 text-blue-700',
  completed: 'border-emerald-300 bg-emerald-50 text-emerald-700',
  missed: 'border-red-300 bg-red-50 text-red-700',
};

/**
 * Add or edit a shift (US9.3). New shifts go to an active staff member; edits
 * can reschedule, add notes or mark the shift completed / missed. Overlaps and
 * invalid times are rejected by the server and shown as a toast.
 */
export function ShiftForm({
  shift,
  roster,
  defaults,
  onClose,
  onSaved,
}: {
  /** Present when editing. */
  shift?: Shift | null;
  roster: User[];
  defaults?: { userId?: string; date?: string };
  onClose: () => void;
  onSaved: () => unknown;
}) {
  const toast = useToast();
  const editing = Boolean(shift);
  const staff = useMemo(
    () =>
      roster
        .filter((u) => u.active)
        .sort((a, b) => roleRank(a.role) - roleRank(b.role) || a.name.localeCompare(b.name)),
    [roster],
  );

  const [form, setForm] = useState({
    userId: shift?.userId ?? defaults?.userId ?? '',
    date: shift?.date ?? defaults?.date ?? localDateISO(),
    start: shift?.start ?? '11:00',
    end: shift?.end ?? '17:00',
    notes: shift?.notes ?? '',
    status: shift?.status ?? ('scheduled' as ShiftStatus),
  });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));
  const hours = hoursBetween(form.start, form.end);
  const endsBeforeStart = Boolean(form.start && form.end && form.end <= form.start);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (shift) {
        await staffApi.updateShift(shift.id, {
          date: form.date,
          start: form.start,
          end: form.end,
          notes: form.notes,
          status: form.status,
        });
        toast('Shift updated.', 'success');
      } else {
        const { shift: created } = await staffApi.createShift({
          userId: form.userId,
          date: form.date,
          start: form.start,
          end: form.end,
          notes: form.notes,
        });
        toast(`Shift added — it now appears on ${created.userName}'s schedule.`, 'success');
      }
      await onSaved();
      onClose();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!shift) return;
    setSaving(true);
    try {
      await staffApi.removeShift(shift.id);
      toast('Shift deleted.', 'success');
      await onSaved();
      onClose();
    } catch (err) {
      toast(errorMessage(err), 'error');
      setSaving(false);
    }
  }

  return (
    <Modal title={shift ? `Edit shift · ${shift.userName}` : 'Add shift'} onClose={saving ? () => undefined : onClose}>
      <form onSubmit={submit} className="space-y-4">
        {shift ? (
          <p className="text-sm text-stone-600">
            {shift.userName}
            {shift.role ? ` · ${ROLE_META[shift.role].label}` : ''} — originally {formatDate(shift.date)}, {shift.start}–
            {shift.end}
          </p>
        ) : (
          <div>
            <label className="label" htmlFor="shift-user">
              Staff member
            </label>
            <select
              id="shift-user"
              className="input"
              required
              value={form.userId}
              onChange={(e) => set('userId', e.target.value)}
            >
              <option value="" disabled>
                Choose a staff member…
              </option>
              {staff.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} · {ROLE_META[u.role].label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-stone-500">Suspended staff can&apos;t be scheduled.</p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="shift-date">
              Date
            </label>
            <input
              id="shift-date"
              type="date"
              className="input"
              required
              value={form.date}
              onChange={(e) => set('date', e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="shift-start">
              Start
            </label>
            <input
              id="shift-start"
              type="time"
              className="input"
              required
              value={form.start}
              onChange={(e) => set('start', e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="shift-end">
              End
            </label>
            <input
              id="shift-end"
              type="time"
              className="input"
              required
              value={form.end}
              onChange={(e) => set('end', e.target.value)}
            />
          </div>
        </div>
        <p className={`-mt-2 text-xs ${endsBeforeStart ? 'text-amber-700' : 'text-stone-500'}`}>
          {endsBeforeStart ? 'The shift must end after it starts (overnight shifts aren’t supported).' : `Duration: ${formatHours(hours)}`}
        </p>

        {editing ? (
          <fieldset className="min-w-0">
            <legend className="label">Status</legend>
            <div className="grid grid-cols-3 gap-2">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={form.status === s}
                  onClick={() => set('status', s)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                    form.status === s ? STATUS_ACTIVE[s] : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  {SHIFT_STATUS[s].label}
                </button>
              ))}
            </div>
          </fieldset>
        ) : null}

        <div>
          <label className="label" htmlFor="shift-notes">
            Notes <span className="font-normal text-stone-500">(optional)</span>
          </label>
          <textarea
            id="shift-notes"
            className="input min-h-[64px]"
            maxLength={NOTES_MAX}
            placeholder="e.g. covering the terrace, opening duties"
            value={form.notes}
            aria-describedby="shift-notes-count"
            onChange={(e) => set('notes', e.target.value)}
          />
          <p id="shift-notes-count" className="mt-1 text-right text-xs text-stone-500">
            {form.notes.length}/{NOTES_MAX}
          </p>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-stone-100 pt-4 sm:flex-row sm:items-center">
          {shift ? (
            confirmDelete ? (
              <div className="flex flex-wrap items-center gap-2 sm:mr-auto">
                <span className="text-sm text-red-700">Delete this shift?</span>
                <button type="button" className="btn-sm btn-danger" onClick={remove} disabled={saving}>
                  Yes, delete
                </button>
                <button
                  type="button"
                  className="btn-sm btn-ghost"
                  onClick={() => setConfirmDelete(false)}
                  disabled={saving}
                >
                  Keep
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn-ghost text-red-600 hover:bg-red-50 hover:text-red-700 sm:mr-auto"
                onClick={() => setConfirmDelete(true)}
                disabled={saving}
              >
                Delete shift
              </button>
            )
          ) : null}
          <button type="button" className="btn-secondary sm:ml-auto" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : shift ? 'Save changes' : 'Add shift'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

'use client';

import type { ReactNode } from 'react';
import { Modal } from '@/components/ui/modal';

/** Small confirmation modal used before destructive staff-management actions. */
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  busy = false,
  danger = true,
  onConfirm,
  onCancel,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  busy?: boolean;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal title={title} onClose={busy ? () => undefined : onCancel}>
      <div className="space-y-3 text-sm text-stone-600">{children}</div>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="button" className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm} disabled={busy}>
          {busy ? 'Working…' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

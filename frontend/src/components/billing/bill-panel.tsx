'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { Invoice } from '@/types';
import { ApiError, billingApi } from '@/lib/api';
import { can } from '@/lib/permissions';
import { ORDER_STATUS, PAYMENT_STATUS, errorMessage, formatDateTime, percent } from '@/lib/format';
import { usePolling } from '@/hooks/use-polling';
import { useAuth } from '@/context/auth-context';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/toast';
import { Receipt } from '@/components/billing/receipt';
import { billWhere, isOpen, isReadyToBill } from './bill-utils';
import { TipControl } from './tip-control';
import { SplitDialog } from './split-dialog';
import { SplitParts } from './split-parts';
import { RefundDialog } from './refund-dialog';
import { PaidActions, PayActions } from './payment-actions';

function RatesNote({ invoice, canEdit }: { invoice: Invoice; canEdit: boolean }) {
  return (
    <p className="text-xs text-stone-500">
      Tax {percent(invoice.taxRate)} on the subtotal after discounts
      {invoice.type === 'dine-in'
        ? ` · service charge ${percent(invoice.serviceChargeRate)} (dine-in only)`
        : ' · no service charge on online orders'}
      . Rates are set in{' '}
      {canEdit ? (
        <Link href="/staff/settings" className="font-medium text-brand-700 underline-offset-2 hover:underline">
          Settings
        </Link>
      ) : (
        'Settings by a manager'
      )}{' '}
      and fixed when the order is placed.
    </p>
  );
}

/**
 * Bill detail (US5.1–US5.5): itemized bill / printable receipt, tax & service
 * rates, tip, split, payment, unpay and refund. Loads the invoice by id, keeps it
 * live while open, and calls `onChanged` after every action so the list and
 * summary refresh. `onDialogChange` reports when a split/refund dialog is open.
 */
export function BillPanel({
  billId,
  initial,
  onChanged,
  onClose,
  onDialogChange,
  showHeaderClose = false,
}: {
  billId: string;
  /** Row data from the list, shown instantly while the fresh invoice loads. */
  initial?: Invoice | null;
  onChanged: () => void;
  onClose: () => void;
  onDialogChange?: (open: boolean) => void;
  showHeaderClose?: boolean;
}) {
  const { user } = useAuth();
  const toast = useToast();
  const [invoice, setInvoice] = useState<Invoice | null>(initial?.id === billId ? initial : null);
  const [dialog, setDialog] = useState<'split' | 'refund' | null>(null);
  // Bumped by every load and action so a slow poll can't overwrite fresher data.
  const seq = useRef(0);

  const load = useCallback(
    async (background = false) => {
      const mine = ++seq.current;
      try {
        const res = await billingApi.get(billId);
        if (mine === seq.current) setInvoice(res.invoice);
      } catch (err) {
        if (mine !== seq.current) return;
        if (err instanceof ApiError && err.status === 404) {
          toast('This bill no longer exists.', 'error');
          onClose();
        } else if (!background) {
          toast(errorMessage(err, 'Failed to load the bill.'), 'error');
        }
      }
    },
    [billId, onClose, toast],
  );

  useEffect(() => {
    load();
  }, [load]);
  usePolling(() => load(true), 5000);

  // A dialog only stays open while it still applies (e.g. the bill was paid elsewhere).
  const activeDialog =
    invoice && dialog === 'split' && isOpen(invoice)
      ? 'split'
      : invoice && dialog === 'refund' && invoice.paymentStatus === 'paid'
        ? 'refund'
        : null;

  useEffect(() => {
    if (dialog && !activeDialog) setDialog(null);
    onDialogChange?.(activeDialog !== null);
  }, [dialog, activeDialog, onDialogChange]);
  useEffect(() => () => onDialogChange?.(false), [onDialogChange]);

  const onUpdated = useCallback(
    (next: Invoice) => {
      seq.current++;
      setInvoice(next);
      onChanged();
    },
    [onChanged],
  );
  const onConflict = useCallback(() => {
    load(true);
    onChanged();
  }, [load, onChanged]);

  if (!invoice) {
    return <Spinner label="Loading bill…" />;
  }

  const open = isOpen(invoice);
  const status = ORDER_STATUS[invoice.status];
  const payment = PAYMENT_STATUS[invoice.paymentStatus];
  const settled = invoice.paymentStatus !== 'unpaid';

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-lg font-bold">
            Bill <span className="font-mono">#{invoice.number}</span>
            <span className="font-normal text-stone-400"> · </span>
            <span>{billWhere(invoice)}</span>
          </p>
          <p className="text-xs text-stone-500">
            {invoice.customerName ?? (invoice.type === 'dine-in' ? 'Walk-in' : 'Guest')}
            {invoice.waiterName ? ` · Server ${invoice.waiterName}` : ''} · opened {formatDateTime(invoice.createdAt)}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {isReadyToBill(invoice) ? <Badge tone="brand">Ready to bill</Badge> : null}
            <Badge tone={status.tone}>{status.label}</Badge>
            <Badge tone={payment.tone}>{payment.label}</Badge>
          </div>
        </div>
        {showHeaderClose ? (
          <button type="button" onClick={onClose} className="btn-ghost !px-2 !py-1" aria-label="Close bill details">
            ✕
          </button>
        ) : null}
      </header>

      {invoice.status === 'cancelled' ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">This order was cancelled and can&apos;t be billed.</p>
      ) : null}

      <section aria-label={settled ? 'Receipt' : 'Itemized bill'}>
        <h3 className="mb-2 text-sm font-semibold text-stone-800">{settled ? 'Receipt' : 'Itemized bill'}</h3>
        <Receipt invoice={invoice} />
      </section>

      <RatesNote invoice={invoice} canEdit={can.editSettings(user?.role)} />

      {open ? (
        <div className="space-y-5 border-t border-stone-200 pt-5">
          <TipControl invoice={invoice} onUpdated={onUpdated} onConflict={onConflict} />

          <div className="border-t border-stone-100 pt-5">
            {invoice.split ? (
              <SplitParts invoice={invoice} onUpdated={onUpdated} onConflict={onConflict} />
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-stone-800">Split the bill</h3>
                  <p className="text-xs text-stone-500">Evenly between payers, or by who ordered what.</p>
                </div>
                <button type="button" className="btn-secondary" onClick={() => setDialog('split')}>
                  Split bill…
                </button>
              </div>
            )}
          </div>

          <div className="border-t border-stone-100 pt-5">
            <PayActions invoice={invoice} onUpdated={onUpdated} onConflict={onConflict} />
          </div>
        </div>
      ) : settled ? (
        <div className="border-t border-stone-200 pt-5">
          <PaidActions
            invoice={invoice}
            role={user?.role}
            onUpdated={onUpdated}
            onConflict={onConflict}
            onRefund={() => setDialog('refund')}
          />
        </div>
      ) : null}

      {activeDialog === 'split' ? (
        <SplitDialog invoice={invoice} onClose={() => setDialog(null)} onUpdated={onUpdated} onConflict={onConflict} />
      ) : null}
      {activeDialog === 'refund' ? (
        <RefundDialog invoice={invoice} onClose={() => setDialog(null)} onUpdated={onUpdated} onConflict={onConflict} />
      ) : null}
    </div>
  );
}

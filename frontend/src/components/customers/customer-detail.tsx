'use client';

import type { Customer } from '@/types';
import { Badge } from '@/components/ui/badge';
import { ExclamationTriangleIcon, XMarkIcon } from '@/components/ui/icons';
import { ORDER_STATUS, PAYMENT_STATUS, formatDateTime, money, titleCase } from '@/lib/format';

/**
 * A customer's profile in the ledger: contact, loyalty points, spend, dietary
 * preferences and allergies (US1.5) and order history newest first (US1.4).
 */
export function CustomerDetail({
  customer,
  onEdit,
  onDelete,
  onClose,
  deleting = false,
}: {
  customer: Customer;
  onEdit: () => void;
  /** Omit to hide Delete (only managers/admins may delete customers). */
  onDelete?: () => void;
  onClose?: () => void;
  deleting?: boolean;
}) {
  const history = (customer.orderHistory ?? []).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const totalOrders = customer.orderCount ?? history.length;
  const avgOrder = totalOrders > 0 ? customer.totalSpend / totalOrders : 0;

  return (
    <div className="space-y-5">
      <div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-stone-900">{customer.name}</h3>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-stone-500">
              <Badge tone={customer.type === 'online' ? 'blue' : 'stone'}>{titleCase(customer.type)}</Badge>
              {customer.email ? <span className="break-all">{customer.email}</span> : null}
              {customer.phone ? <span>· {customer.phone}</span> : null}
            </div>
            <p className="mt-1 text-xs text-stone-500">Customer since {formatDateTime(customer.createdAt)}</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onEdit} className="btn-sm btn-secondary">
              Edit
            </button>
            {onDelete ? (
              <button type="button" onClick={onDelete} className="btn-sm btn-danger" disabled={deleting}>
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            ) : null}
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-stone-500 transition hover:bg-stone-100 hover:text-stone-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                aria-label={`Close ${customer.name}`}
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            ) : null}
          </div>
        </div>
        {customer.notes ? (
          <p className="mt-3 rounded-lg bg-stone-50 px-3 py-2 text-sm text-stone-600">{customer.notes}</p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-2">
        <Stat label="Total spend" value={money(customer.totalSpend)} />
        <Stat label="Orders" value={String(totalOrders)} />
        <Stat label="Avg / order" value={money(avgOrder)} />
        <Stat label="Flame Points" value={String(customer.loyaltyPoints)} />
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Preferences</p>
        <div className="space-y-2 text-sm">
          <PrefRow label="Dietary" values={customer.preferences?.dietary ?? []} />
          <PrefRow label="Allergies" values={customer.preferences?.allergies ?? []} danger />
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
          Order history <span className="font-normal normal-case tracking-normal">· newest first</span>
        </p>
        {history.length === 0 ? (
          <p className="rounded-lg border border-dashed border-stone-200 px-4 py-6 text-center text-sm text-stone-500">
            No orders yet.
          </p>
        ) : (
          <ul className="max-h-[420px] divide-y divide-stone-100 overflow-y-auto rounded-lg border border-stone-200">
            {history.map((o) => {
              const status = ORDER_STATUS[o.status];
              const payment = PAYMENT_STATUS[o.paymentStatus];
              return (
                <li key={o.id} className="px-4 py-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-stone-800">
                        #{o.number}
                        <span className="ml-2 font-normal text-stone-500">
                          {formatDateTime(o.createdAt)} · {titleCase(o.fulfillment)}
                        </span>
                      </p>
                      <p className="mt-0.5 text-stone-600">{o.items.join(', ')}</p>
                    </div>
                    <span className="shrink-0 font-semibold tabular-nums text-stone-800">{money(o.total)}</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Badge tone={status.tone}>{status.label}</Badge>
                    <Badge tone={payment.tone}>
                      {payment.label}
                      {o.paymentMethod && o.paymentStatus !== 'unpaid' ? ` · ${o.paymentMethod}` : ''}
                    </Badge>
                    {o.refundedAmount > 0 ? (
                      <span className="text-xs text-red-600">Refunded {money(o.refundedAmount)}</span>
                    ) : null}
                    {o.pointsEarned ? <span className="text-xs text-stone-500">+{o.pointsEarned} pts</span> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-stone-50 px-3 py-2.5 text-center">
      <p className="text-lg font-bold tabular-nums text-stone-800">{value}</p>
      <p className="text-xs font-medium uppercase tracking-wide text-stone-500">{label}</p>
    </div>
  );
}

function PrefRow({ label, values, danger = false }: { label: string; values: string[]; danger?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-20 shrink-0 text-stone-500">{label}</span>
      {values.length === 0 ? (
        <span className="text-stone-500">None recorded</span>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {values.map((v) => (
            <span
              key={v}
              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs ${
                danger ? 'bg-red-50 font-semibold text-red-700' : 'bg-emerald-50 font-medium text-emerald-700'
              }`}
            >
              {danger ? (
                <>
                  <ExclamationTriangleIcon className="h-3.5 w-3.5" />
                  <span className="sr-only">Allergy: </span>
                </>
              ) : null}
              {v}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

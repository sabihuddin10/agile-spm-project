'use client';

import type { Bill } from '@/types';
import { Badge } from '@/components/ui/badge';
import { ORDER_STATUS, PAYMENT_STATUS, formatDateTime, formatTime, money } from '@/lib/format';
import { billWhere, isReadyToBill } from './bill-utils';

function Created({ iso }: { iso: string }) {
  const today = new Date(iso).toDateString() === new Date().toDateString();
  return <>{today ? formatTime(iso) : formatDateTime(iso)}</>;
}

function StatusBadges({ bill }: { bill: Bill }) {
  const status = ORDER_STATUS[bill.status];
  const payment = PAYMENT_STATUS[bill.paymentStatus];
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {isReadyToBill(bill) ? <Badge tone="brand">Ready to bill</Badge> : <Badge tone={status.tone}>{status.label}</Badge>}
      <Badge tone={payment.tone}>{payment.label}</Badge>
      {bill.split && bill.paymentStatus === 'unpaid' ? (
        <Badge tone="blue">
          Split {bill.split.parts.filter((p) => p.paid).length}/{bill.split.parts.length}
        </Badge>
      ) : null}
    </div>
  );
}

/**
 * Bills as a table on desktop and stacked cards on phones. Served-but-unpaid
 * bills are flagged "Ready to bill" (US5.1); rows open the bill detail.
 */
export function BillList({
  bills,
  selectedId,
  onSelect,
}: {
  bills: Bill[];
  selectedId: string | null;
  onSelect: (bill: Bill) => void;
}) {
  return (
    <>
      {/* Desktop / tablet */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="table-base">
          <thead>
            <tr>
              <th>Bill</th>
              <th>Table / customer</th>
              <th>Status</th>
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {bills.map((b) => {
              const active = b.id === selectedId;
              return (
                <tr
                  key={b.id}
                  onClick={() => onSelect(b)}
                  className={`cursor-pointer transition ${
                    active ? 'bg-brand-50' : isReadyToBill(b) ? 'bg-amber-50/40 hover:bg-stone-50' : 'hover:bg-stone-50'
                  }`}
                >
                  <td className="whitespace-nowrap">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(b);
                      }}
                      className="font-mono font-semibold text-stone-800 hover:text-brand-700 focus:outline-none focus-visible:underline"
                      aria-label={`Open bill #${b.number}`}
                    >
                      #{b.number}
                    </button>
                    <p className="text-xs text-stone-500">
                      <Created iso={b.createdAt} />
                    </p>
                  </td>
                  <td>
                    <p className="font-medium text-stone-800">{billWhere(b)}</p>
                    <p className="text-xs text-stone-500">{b.customerName ?? (b.type === 'dine-in' ? 'Walk-in' : '—')}</p>
                  </td>
                  <td>
                    <StatusBadges bill={b} />
                  </td>
                  <td className="whitespace-nowrap text-right">
                    <p className="font-semibold tabular-nums">{money(b.total)}</p>
                    {b.refundedAmount > 0 ? (
                      <p className="text-xs text-red-600">−{money(b.refundedAmount)} refunded</p>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Phone */}
      <ul className="divide-y divide-stone-100 sm:hidden">
        {bills.map((b) => (
          <li key={b.id}>
            <button
              type="button"
              onClick={() => onSelect(b)}
              className={`flex w-full items-start justify-between gap-3 px-4 py-3 text-left ${
                b.id === selectedId ? 'bg-brand-50' : isReadyToBill(b) ? 'bg-amber-50/40' : ''
              }`}
            >
              <div className="min-w-0 space-y-1">
                <p className="text-sm">
                  <span className="font-mono font-semibold">#{b.number}</span>
                  <span className="text-stone-500"> · </span>
                  <span className="font-medium">{billWhere(b)}</span>
                </p>
                <p className="truncate text-xs text-stone-500">
                  {b.customerName ?? (b.type === 'dine-in' ? 'Walk-in' : '—')} · <Created iso={b.createdAt} />
                </p>
                <StatusBadges bill={b} />
              </div>
              <div className="shrink-0 text-right">
                <p className="font-semibold tabular-nums">{money(b.total)}</p>
                {b.refundedAmount > 0 ? <p className="text-xs text-red-600">−{money(b.refundedAmount)}</p> : null}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

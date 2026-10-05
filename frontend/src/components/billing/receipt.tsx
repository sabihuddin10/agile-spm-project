'use client';

import type { Invoice } from '@/types';
import { formatDateTime, modifierText, money, percent, titleCase } from '@/lib/format';

/**
 * Formatted, printable receipt / itemized bill (US5.1, US5.5). Renders as a
 * paper slip in both themes; "Print" prints only this slip (see .print-area in
 * globals.css).
 */
export function Receipt({ invoice, showPrint = true }: { invoice: Invoice; showPrint?: boolean }) {
  const settled = invoice.paymentStatus !== 'unpaid';
  return (
    <div>
      <div className="print-area mx-auto max-w-sm rounded-lg border border-stone-200 bg-white px-6 py-5 font-mono text-[13px] leading-relaxed text-stone-800">
        <div className="text-center">
          <p className="text-base font-bold tracking-wide">{invoice.restaurant.name}</p>
          <p className="text-xs text-stone-500">{invoice.restaurant.address}</p>
          <p className="mt-2 text-xs uppercase tracking-widest text-stone-500">{settled ? 'Receipt' : 'Bill'}</p>
        </div>

        <div className="mt-3 border-t border-dashed border-stone-300 pt-2 text-xs text-stone-600">
          <p className="flex justify-between">
            <span>{settled ? invoice.receiptNumber : `Order #${invoice.number}`}</span>
            <span>{formatDateTime(invoice.paidAt ?? invoice.createdAt)}</span>
          </p>
          <p className="flex justify-between">
            <span>{invoice.tableNumber ? `Table ${invoice.tableNumber}` : titleCase(invoice.fulfillment)}</span>
            <span>{invoice.waiterName ? `Server: ${invoice.waiterName}` : ''}</span>
          </p>
          {invoice.customerName ? <p>Guest: {invoice.customerName}</p> : null}
        </div>

        <div className="mt-2 space-y-1.5 border-t border-dashed border-stone-300 pt-2">
          {invoice.lines.map((l) => (
            <div key={l.id}>
              <p className="flex justify-between gap-3">
                <span>
                  {l.qty} × {l.name}
                </span>
                <span>{money(l.lineTotal)}</span>
              </p>
              {l.modifiers.length ? <p className="pl-4 text-xs text-stone-500">{modifierText(l.modifiers)}</p> : null}
              {l.qty > 1 ? <p className="pl-4 text-xs text-stone-400">@ {money(l.unitPrice)} each</p> : null}
            </div>
          ))}
        </div>

        <div className="mt-2 space-y-0.5 border-t border-dashed border-stone-300 pt-2">
          <Row label="Subtotal" value={money(invoice.subtotal)} />
          {invoice.discount > 0 ? <Row label={`Flame Points (${invoice.pointsUsed})`} value={`−${money(invoice.discount)}`} /> : null}
          {invoice.serviceCharge > 0 ? (
            <Row label={`Service charge (${percent(invoice.serviceChargeRate)})`} value={money(invoice.serviceCharge)} />
          ) : null}
          <Row label={`Tax (${percent(invoice.taxRate)})`} value={money(invoice.tax)} />
          {invoice.tip > 0 ? <Row label="Tip" value={money(invoice.tip)} /> : null}
          <p className="flex justify-between border-t border-stone-300 pt-1 text-sm font-bold">
            <span>Total</span>
            <span>{money(invoice.total)}</span>
          </p>
          {invoice.refundedAmount > 0 ? (
            <>
              <Row label={`Refunded — ${invoice.refund?.reason ?? ''}`} value={`−${money(invoice.refundedAmount)}`} />
              <Row label="Net paid" value={money(invoice.netTotal)} />
            </>
          ) : null}
        </div>

        {invoice.split ? (
          <div className="mt-2 border-t border-dashed border-stone-300 pt-2 text-xs">
            <p className="mb-0.5 font-semibold">Split {invoice.split.mode === 'even' ? 'evenly' : 'by items'}</p>
            {invoice.split.parts.map((p) => (
              <Row key={p.label} label={`${p.label}${p.paid ? ` · paid ${p.method ?? ''}` : ''}`} value={money(p.amount)} />
            ))}
          </div>
        ) : null}

        <div className="mt-3 border-t border-dashed border-stone-300 pt-2 text-center text-xs text-stone-500">
          {settled ? (
            <p>
              Paid by {invoice.paymentMethod ?? 'card'}
              {invoice.paymentStatus === 'refunded' ? ' · REFUNDED' : ''}
              {invoice.pointsEarned ? ` · +${invoice.pointsEarned} Flame Points` : ''}
            </p>
          ) : (
            <p>Unpaid — please settle with your server</p>
          )}
          <p className="mt-1">Thank you for dining with us!</p>
        </div>
      </div>

      {showPrint ? (
        <div className="no-print mt-4 text-center">
          <button type="button" className="btn-secondary" onClick={() => window.print()}>
            Print {settled ? 'receipt' : 'bill'}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex justify-between gap-3 text-xs">
      <span>{label}</span>
      <span>{value}</span>
    </p>
  );
}

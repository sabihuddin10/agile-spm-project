import type { Invoice } from '@/types';

/** Integer cents, so client-side previews add up exactly like the server's (order-math.js). */
export const toCents = (amount: number | null | undefined) => Math.round(Number(amount || 0) * 100);
export const fromCents = (cents: number) => Math.round(cents) / 100;

/** "Table 4", "Pickup", "Delivery" or "Dine-in". */
export function billWhere(bill: Pick<Invoice, 'tableNumber' | 'fulfillment'>): string {
  if (bill.tableNumber) return `Table ${bill.tableNumber}`;
  if (bill.fulfillment === 'pickup') return 'Pickup';
  if (bill.fulfillment === 'delivery') return 'Delivery';
  return 'Dine-in';
}

/** Served but not yet paid — the waiter should present the bill (US5.1). */
export function isReadyToBill(bill: Pick<Invoice, 'status' | 'paymentStatus'>): boolean {
  return bill.status === 'served' && bill.paymentStatus === 'unpaid';
}

/** Bills that can still take a tip, split or payment. */
export function isOpen(bill: Pick<Invoice, 'status' | 'paymentStatus'>): boolean {
  return bill.paymentStatus === 'unpaid' && bill.status !== 'cancelled';
}

/** Mirror of the server's splitEvenCents: parts differ by at most one cent. */
export function previewEvenSplit(total: number, ways: number): number[] {
  const totalC = toCents(total);
  const n = Math.max(1, Math.floor(ways));
  const base = Math.floor(totalC / n);
  const remainder = totalC - base * n;
  return Array.from({ length: n }, (_, i) => fromCents(base + (i < remainder ? 1 : 0)));
}

/**
 * Mirror of the server's splitByItems: each group pays its share of the total in
 * proportion to its share of the subtotal; the last group absorbs rounding.
 */
export function previewItemSplit(invoice: Invoice, groups: string[][]): number[] {
  const totalC = toCents(invoice.total);
  const lineC = (id: string) => toCents(invoice.lines.find((l) => l.id === id)?.lineTotal ?? 0);
  const subtotalC = invoice.lines.reduce((sum, l) => sum + toCents(l.lineTotal), 0);
  const subs = groups.map((ids) => ids.reduce((sum, id) => sum + lineC(id), 0));
  let allocated = 0;
  return subs.map((sub, idx) => {
    if (idx === subs.length - 1) return fromCents(totalC - allocated);
    const share = subtotalC > 0 ? Math.round((totalC * sub) / subtotalC) : 0;
    allocated += share;
    return fromCents(share);
  });
}

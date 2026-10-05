import type { Settings } from '@/types';

/** Fired on window after a successful checkout so open order lists refresh straight away. */
export const ORDER_PLACED_EVENT = 'plate-flame:order-placed';

export interface CheckoutEstimate {
  subtotal: number;
  discount: number;
  serviceCharge: number;
  tax: number;
  total: number;
}

const toCents = (n: number) => Math.round(n * 100);

/** Most Flame Points usable on this order: capped by the balance and by the subtotal. */
export function maxRedeemablePoints(subtotal: number, balance: number, pointValue: number): number {
  const valueC = toCents(pointValue);
  if (valueC <= 0) return 0;
  return Math.max(0, Math.min(Math.floor(balance), Math.floor(toCents(subtotal) / valueC)));
}

/**
 * Mirror of the server's computeTotals for a not-yet-placed order (US3.1): points
 * discount, service charge for dine-in only, tax after the discount. The server
 * re-prices the order, so the UI labels these figures "Estimated".
 */
export function estimateCheckout(
  subtotal: number,
  pointsUsed: number,
  settings: Pick<Settings, 'taxRate' | 'serviceChargeRate' | 'pointValue'>,
  dineIn: boolean,
): CheckoutEstimate {
  const subtotalC = toCents(subtotal);
  const discountC = Math.min(subtotalC, Math.max(0, pointsUsed) * toCents(settings.pointValue));
  const serviceC = dineIn ? Math.round(subtotalC * settings.serviceChargeRate) : 0;
  const taxC = Math.round((subtotalC - discountC) * settings.taxRate);
  const totalC = Math.max(0, subtotalC - discountC + serviceC + taxC);
  return {
    subtotal: subtotalC / 100,
    discount: discountC / 100,
    serviceCharge: serviceC / 100,
    tax: taxC / 100,
    total: totalC / 100,
  };
}

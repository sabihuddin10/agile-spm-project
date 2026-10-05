import type { Order, OrderStatus } from '@/types';

/** Where an order goes: "Table 4", "Dine-in · no table", "Pickup" or "Delivery" (US3.5, US6.3). */
export function placementLabel(order: Pick<Order, 'type' | 'fulfillment' | 'tableNumber'>): string {
  if (order.type === 'dine-in') return order.tableNumber ? `Table ${order.tableNumber}` : 'Dine-in · no table';
  return order.fulfillment === 'delivery' ? 'Delivery' : 'Pickup';
}

/** Statuses that are still being worked on (mirrors the server's ACTIVE_STATUSES). */
export const ACTIVE_ORDER_STATUSES: OrderStatus[] = ['placed', 'confirmed', 'preparing', 'ready', 'served'];

/** Line total in cents-safe arithmetic. */
export function lineTotal(unitPrice: number, qty: number): number {
  return (Math.round(unitPrice * 100) * qty) / 100;
}

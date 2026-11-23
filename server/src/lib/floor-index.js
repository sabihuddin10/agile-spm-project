/**
 * The floor-plan view needs, for every table, its live orders and today's next booking. Filtering all orders
 * and all reservations once per table is O(tables x (orders + reservations)); grouping them once by table
 * makes it O(orders + reservations + tables).
 */
import { groupBy, itemsFor } from './collections.js';

const OPEN_BOOKING = new Set(['requested', 'confirmed']);

/**
 * @param {{ orders: object[], reservations: object[], today: string, isActive: (order: object) => boolean }} source
 */
export function buildFloorIndex({ orders, reservations, today, isActive }) {
  const ordersByTable = groupBy(orders, (o) => o.tableId);
  const bookingsByTable = groupBy(
    reservations.filter((r) => r.date === today && OPEN_BOOKING.has(r.status)),
    (r) => r.tableId,
  );

  return {
    /** Orders still in progress at the table, in the order they were taken. */
    activeOrders: (tableId) => itemsFor(ordersByTable, tableId).filter(isActive),
    /** Today's earliest open booking at the table, or undefined. */
    nextBooking: (tableId) => itemsFor(bookingsByTable, tableId).slice().sort((a, b) => a.time.localeCompare(b.time))[0],
  };
}

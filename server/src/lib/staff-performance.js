/**
 * Per-staff performance metrics (US9.5): orders taken and served, revenue and tips handled, items prepared and
 * average prep time, shifts completed and missed.
 *
 * The first version walked every order several times for every staff member (O(staff x orders)). This groups
 * the orders and shifts by person once, so the whole report is a single pass over the data plus one lookup per
 * person, and gives exactly the same numbers.
 */
import { MINUTE, combine } from './time.js';
import { fromCents, toCents } from './order-math.js';
import { countBy, groupBy, itemsFor } from './collections.js';

const shiftHours = (s) => (combine(s.date, s.end) - combine(s.date, s.start)) / (60 * MINUTE);

/**
 * @param {{ staff: object[], orders: object[], shifts: object[], from: string, to: string }} input
 *   `orders` are the orders already restricted to the report range (and not cancelled).
 */
export function staffPerformance({ staff, orders, shifts, from, to }) {
  const takenBy = groupBy(orders, (o) => o.waiterId);
  const servedCount = countBy(orders, (o) => o.servedBy);
  const shiftsBy = groupBy(shifts.filter((s) => s.date >= from && s.date <= to), (s) => s.userId);

  // Every prepared item, filed under the person who prepared it, in order/item order.
  const preparedBy = new Map();
  for (const o of orders) {
    for (const i of o.items) {
      if (i.preparedBy == null) continue;
      const list = preparedBy.get(i.preparedBy);
      if (list) list.push({ i, o });
      else preparedBy.set(i.preparedBy, [{ i, o }]);
    }
  }

  return staff.map((u) => {
    const taken = itemsFor(takenBy, u.id);
    const settled = taken.filter((o) => o.paymentStatus !== 'unpaid');
    const prepared = itemsFor(preparedBy, u.id);
    const prepTimes = prepared
      .filter(({ i, o }) => i.readyAt && o.confirmedAt)
      .map(({ i, o }) => (new Date(i.readyAt) - new Date(o.confirmedAt)) / MINUTE);
    const myShifts = itemsFor(shiftsBy, u.id);
    const completed = myShifts.filter((s) => s.status === 'completed');

    return {
      userId: u.id,
      name: u.name,
      role: u.role,
      active: u.active,
      ordersTaken: taken.length,
      ordersServed: servedCount.get(u.id) ?? 0,
      revenueHandled: fromCents(settled.reduce((s, o) => s + toCents(o.total) - toCents(o.refund?.amount ?? 0), 0)),
      tips: fromCents(settled.reduce((s, o) => s + toCents(o.tip), 0)),
      itemsPrepared: prepared.reduce((s, { i }) => s + i.qty, 0),
      avgPrepMinutes: prepTimes.length ? Math.round(prepTimes.reduce((s, m) => s + m, 0) / prepTimes.length) : null,
      shiftsCompleted: completed.length,
      shiftsMissed: myShifts.filter((s) => s.status === 'missed').length,
      hoursWorked: Math.round(completed.reduce((s, x) => s + shiftHours(x), 0) * 10) / 10,
    };
  });
}

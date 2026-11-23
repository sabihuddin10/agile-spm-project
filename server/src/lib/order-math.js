/**
 * Money and order arithmetic. All rounding happens in integer cents so that
 * totals and split bills always add up exactly.
 */
import { Order } from '../domain/order.js';
import { OrderItem } from '../domain/order-item.js';
import { Bill } from '../domain/bill.js';

export const toCents = (amount) => Math.round(Number(amount || 0) * 100);
export const fromCents = (cents) => Math.round(cents) / 100;

/**
 * Validate modifier selections against a menu item's modifier groups and price
 * them. `selections` is [{ group, label }]. A single-choice group with nothing
 * chosen defaults to its first option (e.g. Size → Regular).
 *
 * Returns { modifiers: [{ group, label, priceDelta }], unitPrice } or { error }.
 */
export function priceSelection(menuItem, selections = []) {
  const picks = Array.isArray(selections) ? selections.filter(Boolean) : [];
  const groups = menuItem.modifiers || [];

  for (const pick of picks) {
    const group = groups.find((g) => g.name === pick.group);
    if (!group) return { error: `${menuItem.name} has no "${pick.group}" option.` };
    if (!group.options.some((o) => o.label === pick.label)) {
      return { error: `"${pick.label}" is not a ${group.name} option for ${menuItem.name}.` };
    }
  }

  const chosen = [];
  for (const group of groups) {
    const labels = [...new Set(picks.filter((p) => p.group === group.name).map((p) => p.label))];
    if (group.type === 'single') {
      if (labels.length > 1) return { error: `Choose only one ${group.name} for ${menuItem.name}.` };
      const option = labels.length ? group.options.find((o) => o.label === labels[0]) : group.options[0];
      if (option) chosen.push({ group: group.name, label: option.label, priceDelta: option.priceDelta || 0 });
    } else {
      for (const label of labels) {
        const option = group.options.find((o) => o.label === label);
        chosen.push({ group: group.name, label: option.label, priceDelta: option.priceDelta || 0 });
      }
    }
  }

  const unitCents = toCents(menuItem.price) + chosen.reduce((sum, m) => sum + toCents(m.priceDelta), 0);
  return { modifiers: chosen, unitPrice: fromCents(unitCents) };
}

/** Line total for one order item (unit price incl. modifiers × qty). */
export function lineTotal(item) {
  return fromCents(new OrderItem(item).totalCents);
}

/**
 * Recompute subtotal, service charge, tax, tip and total on an order in place.
 * Service charge applies to dine-in orders only. Tax applies after the loyalty
 * discount. Rates are snapshotted on the order (order.rates) when it is created.
 */
export function computeTotals(order) {
  const totals = Order.fromRecord(order).recalculateTotals().toTotals();
  Object.assign(order, {
    subtotal: totals.subtotal,
    discount: totals.discount,
    serviceCharge: totals.serviceCharge,
    tax: totals.tax,
    tip: totals.tip,
    total: totals.total,
  });
  return order;
}

/** Split `totalCents` into `ways` parts that differ by at most one cent. */
export function splitEvenCents(totalCents, ways) {
  return Bill.splitEvenCents(totalCents, ways);
}

/**
 * Split an order's total by item groups. `groups` is an array of arrays of
 * order-item ids; every item must appear in exactly one group. Each group pays
 * its share of the total proportional to its share of the subtotal, so tax,
 * service, tip and discounts are shared fairly. The last group absorbs rounding
 * so the parts always sum to the original total.
 */
export function splitByItems(order, groups) {
  return new Bill(order).splitByItems(groups);
}

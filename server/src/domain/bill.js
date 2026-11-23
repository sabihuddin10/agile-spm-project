import { OrderItem } from './order-item.js';

/** Billing calculations for even and item based splits of a settled total. */
export class Bill {
  #totalCents;
  #items;

  constructor(order) {
    this.#totalCents = Math.round(Number(order.total || 0) * 100);
    this.#items = (Array.isArray(order.items) ? order.items : [])
      .map((item) => new OrderItem(item));
  }

  /** Allocate remainder cents from the first payer onward, matching existing receipts. */
  static splitEvenCents(totalCents, ways) {
    const count = Math.max(1, Math.floor(ways));
    const base = Math.floor(totalCents / count);
    const remainder = totalCents - base * count;
    return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
  }

  /** Split proportional to item subtotal; the final share absorbs rounding. */
  splitByItems(groups) {
    if (!Array.isArray(groups) || groups.length < 2) {
      return { error: 'Choose at least two groups of items to split.' };
    }

    const itemIds = this.#items.map((item) => item.id);
    const flat = groups.flat();
    if (flat.length !== itemIds.length || !itemIds.every((id) => flat.includes(id))) {
      return { error: 'Every item must be assigned to exactly one payer.' };
    }
    if (groups.some((group) => !Array.isArray(group) || group.length === 0)) {
      return { error: 'Each payer needs at least one item.' };
    }

    const itemAmounts = new Map(this.#items.map((item) => [item.id, item.totalCents]));
    const subtotalCents = this.#items.reduce((sum, item) => sum + item.totalCents, 0);
    const groupSubtotals = groups.map((ids) =>
      ids.reduce((sum, id) => sum + itemAmounts.get(id), 0),
    );
    const amounts = [];
    let allocated = 0;

    groupSubtotals.forEach((subtotal, index) => {
      if (index === groupSubtotals.length - 1) {
        amounts.push(this.#totalCents - allocated);
      } else {
        const share = subtotalCents > 0
          ? Math.round((this.#totalCents * subtotal) / subtotalCents)
          : 0;
        amounts.push(share);
        allocated += share;
      }
    });

    return { amounts: amounts.map((cents) => Math.round(cents) / 100) };
  }
}

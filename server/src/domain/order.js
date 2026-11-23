import { OrderItem } from './order-item.js';

/**
 * Domain representation of an order used for business rules that depend on
 * order type. API, persistence, and seed data continue to use plain records.
 */
export class Order {
  #rates;
  #discount;
  #tip;
  #items;
  #totals = {
    subtotal: 0,
    discount: 0,
    serviceCharge: 0,
    tax: 0,
    tip: 0,
    total: 0,
  };

  constructor(record) {
    this.#rates = { ...(record.rates || {}) };
    this.#discount = record.discount;
    this.#tip = record.tip;
    this.#items = (Array.isArray(record.items) ? record.items : [])
      .map((item) => new OrderItem(item));
  }

  /** Factory keeps callers independent of the concrete order subtype. */
  static fromRecord(record) {
    if (record.type === 'dine-in') return new DineInOrder(record);
    return new Order(record);
  }

  get serviceChargeRate() {
    return 0;
  }

  get rates() {
    return { ...this.#rates };
  }

  /** Recalculate money fields in integer cents to avoid floating point drift. */
  recalculateTotals() {
    const toCents = (amount) => Math.round(Number(amount || 0) * 100);
    const fromCents = (cents) => Math.round(cents) / 100;
    const subtotalCents = this.#items.reduce((sum, item) => sum + item.totalCents, 0);
    const discountCents = Math.min(Math.max(0, toCents(this.#discount)), subtotalCents);
    const serviceChargeCents = Math.round(subtotalCents * this.serviceChargeRate);
    const taxCents = Math.round((subtotalCents - discountCents) * (this.#rates.taxRate || 0));
    const tipCents = Math.max(0, toCents(this.#tip));

    this.#totals = {
      subtotal: fromCents(subtotalCents),
      discount: fromCents(discountCents),
      serviceCharge: fromCents(serviceChargeCents),
      tax: fromCents(taxCents),
      tip: fromCents(tipCents),
      total: fromCents(
        Math.max(0, subtotalCents - discountCents + serviceChargeCents + taxCents + tipCents),
      ),
    };
    return this;
  }

  /** Return only calculated monetary fields, never the caller's order record. */
  toTotals() {
    return { ...this.#totals };
  }
}

export class DineInOrder extends Order {
  get serviceChargeRate() {
    return this.rates.serviceChargeRate || 0;
  }
}


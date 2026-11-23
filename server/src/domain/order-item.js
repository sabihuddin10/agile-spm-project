/** A line in an order; its price is the unit price (including modifiers) times quantity. */
export class OrderItem {
  #record;

  constructor(record) {
    this.#record = {
      ...record,
      ...(Array.isArray(record.modifiers)
        ? { modifiers: record.modifiers.map((modifier) => ({ ...modifier })) }
        : {}),
    };
  }

  get id() {
    return this.#record.id;
  }

  /** Return the line amount in cents to keep calculations exact. */
  get totalCents() {
    return Math.round(Number(this.#record.unitPrice || 0) * 100) * this.#record.qty;
  }

  toRecord() {
    return {
      ...this.#record,
      ...(Array.isArray(this.#record.modifiers)
        ? { modifiers: this.#record.modifiers.map((modifier) => ({ ...modifier })) }
        : {}),
    };
  }
}

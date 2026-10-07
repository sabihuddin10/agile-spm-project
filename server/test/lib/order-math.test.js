/** Pricing and splitting math — lib/order-math.js. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { priceSelection, computeTotals, splitEvenCents, splitByItems, toCents } from '../../src/lib/order-math.js';

const pizza = {
  name: 'Pizza',
  price: 18,
  modifiers: [
    { name: 'Size', type: 'single', options: [{ label: 'Regular', priceDelta: 0 }, { label: 'Large', priceDelta: 4 }] },
    { name: 'Extras', type: 'multi', options: [{ label: 'Cheese', priceDelta: 1.5 }, { label: 'Olives', priceDelta: 1 }] },
  ],
};

test('modifier price deltas are added to the unit price (US2.3)', () => {
  // Arrange
  const selections = [{ group: 'Size', label: 'Large' }, { group: 'Extras', label: 'Cheese' }, { group: 'Extras', label: 'Olives' }];

  // Act
  const r = priceSelection(pizza, selections);

  // Assert
  assert.equal(r.unitPrice, 24.5);
  assert.deepEqual(r.modifiers.map((m) => m.label), ['Large', 'Cheese', 'Olives']);
});

test('single-choice groups default to their first option', () => {
  // Arrange / Act
  const r = priceSelection(pizza, []);

  // Assert
  assert.equal(r.unitPrice, 18);
  assert.deepEqual(r.modifiers, [{ group: 'Size', label: 'Regular', priceDelta: 0 }]);
});

test('invalid selections are rejected', () => {
  // Arrange / Act / Assert
  assert.match(priceSelection(pizza, [{ group: 'Size', label: 'Huge' }]).error, /not a Size option/);
  assert.match(priceSelection(pizza, [{ group: 'Sauce', label: 'BBQ' }]).error, /no "Sauce" option/);
  assert.match(priceSelection(pizza, [{ group: 'Size', label: 'Regular' }, { group: 'Size', label: 'Large' }]).error, /only one Size/);
});

test('totals: service charge on dine-in, tax after discount, tip added (US5.2)', () => {
  // Arrange
  const order = {
    type: 'dine-in',
    rates: { taxRate: 0.1, serviceChargeRate: 0.05 },
    discount: 2,
    tip: 3,
    items: [{ unitPrice: 12.5, qty: 2 }, { unitPrice: 6, qty: 1 }],
  };

  // Act
  computeTotals(order);

  // Assert
  assert.equal(order.subtotal, 31);
  assert.equal(order.serviceCharge, 1.55);
  assert.equal(order.tax, 2.9);
  assert.equal(order.total, 31 - 2 + 1.55 + 2.9 + 3);

  // Act — online orders have no service charge
  const online = { ...order, type: 'online' };
  computeTotals(online);
  // Assert
  assert.equal(online.serviceCharge, 0);
});

test('even split always sums to the total (US5.3)', () => {
  // Arrange / Act / Assert
  for (const [total, ways] of [[10000, 3], [3950, 3], [1, 2], [999, 7]]) {
    const parts = splitEvenCents(total, ways);
    assert.equal(parts.length, ways);
    assert.equal(parts.reduce((s, p) => s + p, 0), total);
    assert.ok(Math.max(...parts) - Math.min(...parts) <= 1);
  }
});

test('split by items is proportional and sums exactly (US5.3)', () => {
  // Arrange
  const order = {
    total: 47.33,
    items: [
      { id: 'a', unitPrice: 18, qty: 1 },
      { id: 'b', unitPrice: 12.5, qty: 1 },
      { id: 'c', unitPrice: 3.5, qty: 2 },
    ],
  };

  // Act
  const { amounts } = splitByItems(order, [['a'], ['b', 'c']]);

  // Assert
  assert.equal(toCents(amounts[0]) + toCents(amounts[1]), toCents(order.total));
  assert.ok(amounts[0] > 22 && amounts[0] < 23);
  assert.match(splitByItems(order, [['a'], ['b']]).error, /exactly one payer/);
  assert.match(splitByItems(order, [['a', 'b', 'c']]).error, /at least two/);
});

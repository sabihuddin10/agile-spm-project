import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DineInOrder, Order } from '../../src/domain/order.js';
import { OrderItem } from '../../src/domain/order-item.js';
import { computeTotals } from '../../src/lib/order-math.js';

const orderRecord = (type) => ({
  id: `order-${type}`,
  type,
  items: [{ id: 'line-1', unitPrice: 10.01, qty: 2 }],
  discount: 1,
  tip: 0.5,
  rates: { serviceChargeRate: 0.1, taxRate: 0.1 },
});

test('order factory chooses the matching subtype and returns the shared base contract', () => {
  assert.ok(Order.fromRecord(orderRecord('dine-in')) instanceof DineInOrder);
  assert.ok(Order.fromRecord(orderRecord('online')) instanceof Order);
  assert.ok(!(Order.fromRecord(orderRecord('online')) instanceof DineInOrder));
  assert.ok(Order.fromRecord(orderRecord('other')) instanceof Order);
});

test('subtypes apply service charge polymorphically while preserving cent arithmetic', () => {
  const dineIn = Order.fromRecord(orderRecord('dine-in')).recalculateTotals().toTotals();
  const online = Order.fromRecord(orderRecord('online')).recalculateTotals().toTotals();

  assert.deepEqual(
    { subtotal: dineIn.subtotal, discount: dineIn.discount, serviceCharge: dineIn.serviceCharge, tax: dineIn.tax, tip: dineIn.tip, total: dineIn.total },
    { subtotal: 20.02, discount: 1, serviceCharge: 2, tax: 1.9, tip: 0.5, total: 23.42 },
  );
  assert.equal(online.serviceCharge, 0);
  assert.equal(online.total, 21.42);
});

test('legacy computeTotals mutates and returns the same plain record shape', () => {
  const record = orderRecord('dine-in');
  const items = record.items;
  const firstItem = record.items[0];
  const result = computeTotals(record);

  assert.equal(result, record);
  assert.equal(record.total, 23.42);
  assert.equal(Object.getPrototypeOf(record), Object.prototype);
  assert.equal(record.items, items);
  assert.equal(record.items[0], firstItem);
});

test('the order snapshots pricing inputs and exposes only detached calculated totals', () => {
  const source = orderRecord('online');
  const entity = Order.fromRecord(source);
  source.items[0].qty = 99;
  source.rates.taxRate = 0.9;
  const totals = entity.recalculateTotals().toTotals();
  totals.total = 999;

  assert.equal(entity.toTotals().total, 21.42);
  assert.equal(Object.hasOwn(entity.toTotals(), 'items'), false);
  assert.equal(entity.record, undefined);
});

test('OrderItem owns modifier data and calculates line amounts in integer cents', () => {
  const record = {
    id: 'line-1',
    unitPrice: 10.01,
    qty: 3,
    modifiers: [{ group: 'Size', label: 'Large', priceDelta: 1 }],
  };
  const item = new OrderItem(record);
  record.modifiers[0].label = 'mutated source';
  const exported = item.toRecord();
  exported.modifiers[0].label = 'mutated export';

  assert.equal(item.id, 'line-1');
  assert.equal(item.totalCents, 3003);
  assert.equal(item.toRecord().modifiers[0].label, 'Large');
});

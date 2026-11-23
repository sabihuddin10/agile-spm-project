import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Bill } from '../../src/domain/bill.js';
import { splitEvenCents, splitByItems } from '../../src/lib/order-math.js';

const billOrder = () => ({
  total: 30,
  items: [
    { id: 'meal', unitPrice: 20, qty: 1 },
    { id: 'drink', unitPrice: 5, qty: 2 },
  ],
});

test('Bill divides evenly and allocates remainder cents deterministically', () => {
  assert.deepEqual(Bill.splitEvenCents(1001, 3), [334, 334, 333]);
  assert.deepEqual(splitEvenCents(1001, 3), [334, 334, 333]);
});

test('Bill allocates item groups proportionally and absorbs rounding in the last share', () => {
  assert.deepEqual(new Bill(billOrder()).splitByItems([['meal'], ['drink']]), {
    amounts: [20, 10],
  });
  assert.deepEqual(splitByItems(billOrder(), [['meal'], ['drink']]), {
    amounts: [20, 10],
  });
});

test('Bill rejects incomplete, duplicated, or empty item groups with existing messages', () => {
  const bill = new Bill(billOrder());
  assert.match(bill.splitByItems([['meal']]).error, /at least two groups/);
  assert.match(bill.splitByItems([['meal'], ['meal']]).error, /exactly one payer/);
  assert.match(bill.splitByItems([['meal', 'drink'], []]).error, /needs at least one item/);
});

test('Bill keeps a snapshot of the order used for its calculation', () => {
  const order = billOrder();
  const bill = new Bill(order);
  order.total = 999;
  order.items[0].unitPrice = 999;

  assert.deepEqual(bill.splitByItems([['meal'], ['drink']]).amounts, [20, 10]);
});

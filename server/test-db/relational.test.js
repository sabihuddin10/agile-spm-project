/**
 * Relational mapping — data/relational/: the whole in-memory store is saved to
 * the relational tables and loaded back unchanged. Runs against a real Postgres
 * database (needs DATABASE_URL, see `npm run test:db`).
 */
import 'dotenv/config';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createPool } from '../src/data/db.js';
import { startServer, menuItem } from '../test/helpers.js';
import { snapshot, restore } from '../src/data/snapshot.js';
import { ensureSchema } from '../src/data/relational/schema.js';
import { saveStore, loadStore } from '../src/data/relational/index.js';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for the database tests.');
const pool = createPool(process.env.DATABASE_URL);
let api;

/** Call the API and fail loudly unless it answered 2xx. */
async function ok(promise) {
  const res = await promise;
  if (res.status >= 300) throw new Error(`setup call failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
}

/** Touch every collection so every child table gets rows too. */
async function exercise({ call, login }) {
  const manager = await login('manager');
  const waiter = await login('waiter');
  const inv = await ok(call('GET', '/inventory', { token: manager }));
  const ingredient = (inv.items ?? inv.inventory)[0];
  await ok(call('PATCH', `/inventory/${ingredient.id}`, { token: manager, body: { delta: -1 } }));
  const po = await ok(call('POST', '/inventory/purchase-orders', { token: manager, body: { lines: [{ inventoryId: ingredient.id, qty: 2 }] } }));
  await ok(call('POST', `/inventory/purchase-orders/${po.purchaseOrder.id}/receive`, { token: manager }));

  const bread = await menuItem(call, 'Garlic Bread');
  const pizza = await menuItem(call, 'Margherita Pizza');
  const split = await ok(call('POST', '/orders', { token: waiter, body: { type: 'dine-in', items: [{ menuItemId: pizza.id, qty: 1 }, { menuItemId: bread.id, qty: 1 }] } }));
  const [a, b] = split.order.items.map((i) => i.id);
  await ok(call('POST', `/billing/${split.order.id}/split`, { token: waiter, body: { mode: 'items', groups: [[a], [b]] } }));
  await ok(call('POST', `/billing/${split.order.id}/split/0/pay`, { token: waiter, body: { method: 'cash' } }));

  const refunded = await ok(call('POST', '/orders', { token: waiter, body: { type: 'dine-in', items: [{ menuItemId: bread.id, qty: 2 }] } }));
  await ok(call('POST', `/billing/${refunded.order.id}/pay`, { token: waiter, body: { method: 'card' } }));
  await ok(call('POST', `/billing/${refunded.order.id}/refund`, { token: manager, body: { reason: 'Test refund' } }));

  await ok(call('POST', '/notifications/read-all', { token: waiter }));
}

/** The schema keeps these lists as sets, so compare them sorted. */
function normalise(snap) {
  const s = structuredClone(snap);
  for (const n of s.notifications) n.readBy.sort();
  for (const c of s.customers) for (const k of Object.keys(c.preferences ?? {})) c.preferences[k].sort();
  return s;
}

before(async () => {
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await ensureSchema(pool);
  api = await startServer();
  await exercise(api);
});

after(async () => {
  await api.close();
  await pool.end();
});

test('saving then loading the store gives back the same store', async () => {
  // Arrange
  const original = snapshot();
  const client = await pool.connect();

  // Act
  try {
    await client.query('BEGIN');
    await saveStore(client, original);
    await client.query('COMMIT');
    restore({});
    restore(await loadStore(client));
  } finally {
    client.release();
  }

  // Assert
  assert.deepEqual(normalise(snapshot()), normalise(original));
});

test('every store record is a row in its table', async () => {
  // Arrange
  const s = snapshot();
  const count = async (t) => (await pool.query(`SELECT count(*)::int AS n FROM ${t}`)).rows[0].n;

  // Act
  const counts = {};
  for (const t of ['users', 'customers', 'orders', 'order_items', 'order_refunds', 'split_parts', 'split_part_items', 'stock_movements',
    'purchase_order_lines', 'notification_reads', 'shifts', 'attendance_sessions', 'attendance_breaks', 'reservations', 'recipe_lines']) {
    counts[t] = await count(t);
  }

  // Assert
  const withSplit = s.orders.filter((o) => o.split);
  assert.deepEqual(counts, {
    users: s.users.length,
    customers: s.customers.length,
    orders: s.orders.length,
    order_items: s.orders.reduce((n, o) => n + o.items.length, 0),
    order_refunds: s.orders.filter((o) => o.refund).length,
    split_parts: withSplit.reduce((n, o) => n + o.split.parts.length, 0),
    split_part_items: withSplit.reduce((n, o) => n + o.split.parts.reduce((m, p) => m + p.itemIds.length, 0), 0),
    stock_movements: s.stockMovements.length,
    purchase_order_lines: s.purchaseOrders.reduce((n, p) => n + p.lines.length, 0),
    notification_reads: s.notifications.reduce((n, x) => n + x.readBy.length, 0),
    shifts: s.shifts.length,
    attendance_sessions: s.attendance.length,
    attendance_breaks: s.attendance.reduce((n, x) => n + x.breaks.length, 0),
    reservations: s.reservations.length,
    recipe_lines: s.menuItems.reduce((n, m) => n + m.recipe.length, 0),
  });
  assert.ok(counts.split_parts > 0 && counts.order_refunds > 0 && counts.stock_movements > 0 && counts.notification_reads > 0);
});

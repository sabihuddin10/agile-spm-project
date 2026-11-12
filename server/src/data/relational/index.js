/**
 * Store ↔ relational tables. `saveStore` rewrites every table from a store
 * snapshot inside the caller's transaction; `loadStore` reads them back into a
 * snapshot that `restore()` accepts. Store string ids live in `ext_id`; bigint
 * ids are array index + 1, so foreign keys resolve without extra queries.
 */
import * as people from './people.js';
import * as menu from './menu.js';
import * as floor from './floor.js';
import * as orders from './orders.js';
import * as stock from './stock.js';
import * as alerts from './alerts.js';
import * as workforce from './workforce.js';
import * as config from './config.js';
import { idsOf, extsOf, insertRows, selectRows } from './sql.js';

const AREAS = [people, menu, floor, orders, stock, alerts, workforce, config];

/** Every data table, parents before children. `sequences` also holds state_version, so it is cleared separately. */
const TABLES = [
  'users', 'customers', 'customer_preferences', 'menu_categories', 'inventory_items', 'menu_items', 'recipe_lines',
  'tables', 'reservations', 'orders', 'order_items', 'order_refunds', 'bill_splits', 'split_parts', 'split_part_items',
  'stock_movements', 'purchase_orders', 'purchase_order_lines', 'notifications', 'notification_reads',
  'staff_applications', 'shifts', 'attendance_sessions', 'attendance_breaks', 'pay_adjustments', 'loyalty_ledger', 'settings',
];
const ORDER_BY = { customer_preferences: 'customer_id', split_part_items: 'split_part_id', notification_reads: 'notification_id' };

export async function saveStore(db, s) {
  const ids = {
    users: idsOf(s.users), customers: idsOf(s.customers), categories: idsOf(s.categories), inventory: idsOf(s.inventory),
    menuItems: idsOf(s.menuItems), tables: idsOf(s.tables), reservations: idsOf(s.reservations), orders: idsOf(s.orders),
    orderItems: idsOf(s.orders.flatMap((o) => o.items)), shifts: idsOf(s.shifts),
  };
  await db.query(`TRUNCATE ${TABLES.join(', ')} RESTART IDENTITY CASCADE`);
  await db.query("DELETE FROM sequences WHERE name <> 'state_version'");
  for (const area of AREAS) {
    for (const step of area.save(s, ids)) {
      if (typeof step === 'function') await step(db);
      else await insertRows(db, ...step);
    }
  }
}

export async function loadStore(db) {
  const rows = {};
  for (const t of TABLES) rows[t] = await selectRows(db, t, ORDER_BY[t] ?? 'id');
  rows.sequences = await selectRows(db, 'sequences', 'name');
  const exts = {
    users: extsOf(rows.users), customers: extsOf(rows.customers), categories: extsOf(rows.menu_categories),
    inventory: extsOf(rows.inventory_items), menuItems: extsOf(rows.menu_items), tables: extsOf(rows.tables),
    reservations: extsOf(rows.reservations), orders: extsOf(rows.orders), orderItems: extsOf(rows.order_items),
    shifts: extsOf(rows.shifts),
  };
  return Object.assign({}, ...AREAS.map((a) => a.load(rows, exts)));
}

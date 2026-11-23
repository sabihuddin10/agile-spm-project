/** stock_movements, purchase_orders, purchase_order_lines. */
import { iso, num, ref, byParent } from './sql.js';

const poNumber = (n) => Number(String(n).replace(/^PO-/, ''));
const poLabel = (n) => `PO-${String(n).padStart(4, '0')}`;

export function save(s, ids) {
  let line = 0;
  return [
    ['stock_movements', 'id bigint, ext_id text, inventory_id bigint, name text, unit text, delta numeric, stock_after numeric, reason movement_reason, order_id bigint, order_number integer, user_id bigint, at timestamptz',
      s.stockMovements.map((m, i) => ({
        id: i + 1, ext_id: m.id, inventory_id: ref(ids.inventory, m.inventoryId), name: m.name, unit: m.unit,
        delta: m.delta, stock_after: m.stockAfter, reason: m.reason, order_id: ref(ids.orders, m.orderId),
        order_number: m.orderNumber, user_id: ref(ids.users, m.userId), at: m.at,
      }))],
    ['purchase_orders', 'id bigint, ext_id text, number integer, status po_status, total numeric, notes text, created_by bigint, created_at timestamptz, received_at timestamptz',
      s.purchaseOrders.map((p, i) => ({
        id: i + 1, ext_id: p.id, number: poNumber(p.number), status: p.status, total: p.total, notes: p.notes,
        created_by: ref(ids.users, p.createdBy), created_at: p.createdAt, received_at: p.receivedAt,
      }))],
    ['purchase_order_lines', 'id bigint, purchase_order_id bigint, inventory_id bigint, name text, unit text, supplier text, qty numeric, cost_per_unit numeric, cost numeric',
      s.purchaseOrders.flatMap((p, i) => p.lines.map((l) => ({
        id: ++line, purchase_order_id: i + 1, inventory_id: ref(ids.inventory, l.inventoryId), name: l.name, unit: l.unit,
        supplier: l.supplier, qty: l.qty, cost_per_unit: l.costPerUnit, cost: l.cost,
      })))],
  ];
}

export function load(r, x) {
  const linesOf = byParent(r.purchase_order_lines, 'purchase_order_id');
  return {
    stockMovements: r.stock_movements.map((m) => ({
      id: m.ext_id, inventoryId: ref(x.inventory, m.inventory_id), name: m.name, unit: m.unit, delta: num(m.delta),
      stockAfter: num(m.stock_after), reason: m.reason, orderId: ref(x.orders, m.order_id), orderNumber: m.order_number,
      userId: ref(x.users, m.user_id), at: iso(m.at),
    })),
    purchaseOrders: r.purchase_orders.map((p) => ({
      id: p.ext_id, number: poLabel(p.number),
      lines: linesOf(p.id).map((l) => ({
        inventoryId: ref(x.inventory, l.inventory_id), name: l.name, unit: l.unit, supplier: l.supplier,
        qty: num(l.qty), costPerUnit: num(l.cost_per_unit), cost: num(l.cost),
      })),
      total: num(p.total), notes: p.notes, status: p.status, createdAt: iso(p.created_at),
      createdBy: ref(x.users, p.created_by), receivedAt: iso(p.received_at),
    })),
  };
}

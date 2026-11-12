/** orders, order_items, order_refunds, bill_splits, split_parts, split_part_items. */
import { iso, num, ref, byParent } from './sql.js';
import { computeTotals } from '../../lib/order-math.js';

export function save(s, ids) {
  let part = 0;
  const splits = [];
  const parts = [];
  const partItems = [];
  s.orders.forEach((o, i) => {
    if (!o.split) return;
    const splitId = splits.length + 1;
    splits.push({ id: splitId, order_id: i + 1, mode: o.split.mode, created_at: o.split.createdAt });
    o.split.parts.forEach((p, n) => {
      const partId = ++part;
      parts.push({
        id: partId, split_id: splitId, part_no: n, label: p.label, amount: p.amount, paid: p.paid,
        method: p.method ?? null, paid_at: p.paidAt ?? null,
      });
      for (const itemId of p.itemIds) partItems.push({ split_part_id: partId, order_item_id: ref(ids.orderItems, itemId) });
    });
  });

  return [
    ['orders', 'id bigint, ext_id text, number integer, type order_type, fulfillment fulfillment_method, table_id bigint, customer_id bigint, waiter_id bigint, created_by bigint, source order_source, status order_status, payment_status payment_status, payment_method payment_method, priority order_priority, kitchen_rank double precision, tax_rate numeric, service_charge_rate numeric, discount numeric, tip numeric, points_used integer, points_earned integer, notes text, delivery_address text, stock_deducted boolean, created_at timestamptz, confirmed_at timestamptz, ready_at timestamptz, served_at timestamptz, served_by bigint, paid_at timestamptz, closed_at timestamptz, cancelled_at timestamptz, updated_at timestamptz',
      s.orders.map((o, i) => ({
        id: i + 1, ext_id: o.id, number: o.number, type: o.type, fulfillment: o.fulfillment,
        table_id: ref(ids.tables, o.tableId), customer_id: ref(ids.customers, o.customerId),
        waiter_id: ref(ids.users, o.waiterId), created_by: ref(ids.users, o.createdBy), source: o.source,
        status: o.status, payment_status: o.paymentStatus, payment_method: o.paymentMethod ?? null, priority: o.priority,
        kitchen_rank: o.kitchenRank ?? null, tax_rate: o.rates?.taxRate ?? 0, service_charge_rate: o.rates?.serviceChargeRate ?? 0,
        discount: o.discount, tip: o.tip, points_used: o.pointsUsed, points_earned: o.pointsEarned, notes: o.notes,
        delivery_address: o.deliveryAddress, stock_deducted: o.stockDeducted, created_at: o.createdAt,
        confirmed_at: o.confirmedAt, ready_at: o.readyAt, served_at: o.servedAt, served_by: ref(ids.users, o.servedBy),
        paid_at: o.paidAt, closed_at: o.closedAt, cancelled_at: o.cancelledAt, updated_at: o.updatedAt,
      }))],
    ['order_items', 'id bigint, ext_id text, order_id bigint, menu_item_id bigint, name text, qty integer, base_price numeric, modifiers jsonb, unit_price numeric, status item_status, prepared_by bigint, ready_at timestamptz, served_at timestamptz',
      s.orders.flatMap((o, i) => o.items.map((it) => ({
        id: ids.orderItems.get(it.id), ext_id: it.id, order_id: i + 1, menu_item_id: ref(ids.menuItems, it.menuItemId),
        name: it.name, qty: it.qty, base_price: it.basePrice, modifiers: it.modifiers, unit_price: it.unitPrice,
        status: it.status, prepared_by: ref(ids.users, it.preparedBy), ready_at: it.readyAt, served_at: it.servedAt,
      })))],
    ['order_refunds', 'id bigint, order_id bigint, amount numeric, reason text, by_user_id bigint, at timestamptz',
      s.orders.flatMap((o, i) => (o.refund ? [{ order_id: i + 1, refund: o.refund }] : []))
        .map(({ order_id, refund }, n) => ({
          id: n + 1, order_id, amount: refund.amount, reason: refund.reason, by_user_id: ref(ids.users, refund.by), at: refund.at,
        }))],
    ['bill_splits', 'id bigint, order_id bigint, mode split_mode, created_at timestamptz', splits],
    ['split_parts', 'id bigint, split_id bigint, part_no integer, label text, amount numeric, paid boolean, method split_payment_method, paid_at timestamptz', parts],
    ['split_part_items', 'split_part_id bigint, order_item_id bigint', partItems, { identity: false }],
  ];
}

export function load(r, x) {
  const itemsOf = byParent(r.order_items, 'order_id');
  const refundOf = byParent(r.order_refunds, 'order_id');
  const splitOf = byParent(r.bill_splits, 'order_id');
  const partsOf = byParent(r.split_parts, 'split_id');
  const partItemsOf = byParent(r.split_part_items, 'split_part_id');

  const split = (orderId) => {
    const [sp] = splitOf(orderId);
    if (!sp) return null;
    return {
      mode: sp.mode,
      parts: partsOf(sp.id).sort((a, b) => a.part_no - b.part_no).map((p) => ({
        label: p.label, amount: num(p.amount),
        itemIds: partItemsOf(p.id).map((pi) => ref(x.orderItems, pi.order_item_id)),
        paid: p.paid, ...(p.method ? { method: p.method } : {}), ...(p.paid_at ? { paidAt: iso(p.paid_at) } : {}),
      })),
      createdAt: iso(sp.created_at),
    };
  };
  const refund = (orderId) => {
    const [f] = refundOf(orderId);
    return f ? { amount: num(f.amount), reason: f.reason, at: iso(f.at), by: ref(x.users, f.by_user_id) } : null;
  };

  return {
    orders: r.orders.map((o) => computeTotals({
      id: o.ext_id, number: o.number, type: o.type, fulfillment: o.fulfillment, tableId: ref(x.tables, o.table_id),
      customerId: ref(x.customers, o.customer_id), waiterId: ref(x.users, o.waiter_id), createdBy: ref(x.users, o.created_by),
      source: o.source, status: o.status, paymentStatus: o.payment_status, paymentMethod: o.payment_method,
      priority: o.priority, kitchenRank: o.kitchen_rank,
      items: itemsOf(o.id).map((it) => ({
        id: it.ext_id, menuItemId: ref(x.menuItems, it.menu_item_id), name: it.name, qty: it.qty, basePrice: num(it.base_price),
        modifiers: it.modifiers, unitPrice: num(it.unit_price), status: it.status, preparedBy: ref(x.users, it.prepared_by),
        readyAt: iso(it.ready_at), servedAt: iso(it.served_at),
      })),
      rates: { taxRate: num(o.tax_rate), serviceChargeRate: num(o.service_charge_rate) },
      discount: num(o.discount), tip: num(o.tip), pointsUsed: o.points_used, pointsEarned: o.points_earned,
      notes: o.notes, deliveryAddress: o.delivery_address, split: split(o.id), refund: refund(o.id),
      createdAt: iso(o.created_at), confirmedAt: iso(o.confirmed_at), readyAt: iso(o.ready_at), servedAt: iso(o.served_at),
      servedBy: ref(x.users, o.served_by), paidAt: iso(o.paid_at), closedAt: iso(o.closed_at),
      cancelledAt: iso(o.cancelled_at), updatedAt: iso(o.updated_at), stockDeducted: o.stock_deducted,
    })),
  };
}

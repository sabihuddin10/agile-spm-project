/**
 * Order lifecycle rules shared by the order, kitchen and billing routes:
 * status promotion from item states, closing (stock deduction + table release),
 * cancellation, payment and loyalty points.
 */
import {
  orders,
  tables,
  customers,
  users,
  menuItems,
  inventory,
  stockMovements,
  settings,
  nextId,
} from '../data/store.js';
import { notify } from './notify.js';
import { iso } from './time.js';

export const ACTIVE_STATUSES = ['placed', 'confirmed', 'preparing', 'ready', 'served'];
export const KITCHEN_STATUSES = ['confirmed', 'preparing', 'ready'];

export const isActive = (order) => ACTIVE_STATUSES.includes(order.status);

export function tableNumber(tableId) {
  return tableId ? tables.find((t) => t.id === tableId)?.number ?? null : null;
}

export function userName(userId) {
  return userId ? users.find((u) => u.id === userId)?.name ?? null : null;
}

/** Human label used in notifications, e.g. "Table 4" or "Order #1043 (pickup)". */
export function orderLabel(order) {
  const n = tableNumber(order.tableId);
  return n ? `Table ${n}` : `Order #${order.number} (${order.fulfillment})`;
}

/** API shape for an order: adds table number, staff names and customer preferences. */
export function serializeOrder(order) {
  const c = order.customerId ? customers.find((x) => x.id === order.customerId) : null;
  return {
    ...order,
    tableNumber: tableNumber(order.tableId),
    waiterName: userName(order.waiterId),
    servedByName: userName(order.servedBy),
    customer: c
      ? { id: c.id, name: c.name, email: c.email, phone: c.phone, preferences: c.preferences }
      : null,
    items: order.items.map((i) => ({ ...i, preparedByName: userName(i.preparedBy) })),
  };
}

/* ------------------------------------------------------------ lifecycle */

/**
 * Derive the order-level status from item states once the order is in the
 * kitchen: all served → served, all ready → ready, any started → preparing.
 */
export function syncOrderStatus(order, actor) {
  if (!['confirmed', 'preparing', 'ready', 'served'].includes(order.status)) return;
  const items = order.items;
  let next;
  if (items.every((i) => i.status === 'served')) next = 'served';
  else if (items.every((i) => i.status === 'ready' || i.status === 'served')) next = 'ready';
  else if (items.some((i) => ['preparing', 'ready', 'served'].includes(i.status))) next = 'preparing';
  else next = 'confirmed';

  if (next === order.status) return;
  order.status = next;
  const now = iso();
  if (next === 'ready') {
    order.readyAt = now;
    notifyOrderReady(order);
  }
  if (next === 'served') {
    order.servedAt = now;
    order.servedBy = actor?.id ?? order.servedBy;
    if (order.paymentStatus === 'paid') closeOrder(order);
  }
}

/** Placed → confirmed: route to the kitchen queue. */
export function confirmOrder(order, actor) {
  const now = iso();
  order.status = 'confirmed';
  order.confirmedAt = now;
  order.kitchenRank = Date.now();
  if (!order.waiterId && actor && ['waiter', 'manager', 'admin'].includes(actor.role)) order.waiterId = actor.id;
  order.items.forEach((i) => {
    if (i.status === 'pending') i.status = 'queued';
  });
  if (order.tableId) occupyTable(order.tableId, order.waiterId);
}

/** Served + paid → closed: deduct stock (BOM) and free the table. */
export function closeOrder(order) {
  if (order.status === 'closed') return;
  order.status = 'closed';
  order.closedAt = iso();
  deductStock(order);
  releaseTable(order);
}

export function cancelOrder(order, actor, reason = 'Order cancelled') {
  order.status = 'cancelled';
  order.cancelledAt = iso();
  const c = order.customerId ? customers.find((x) => x.id === order.customerId) : null;
  if (c && order.pointsUsed) c.loyaltyPoints += order.pointsUsed;
  if (order.paymentStatus === 'paid') {
    order.paymentStatus = 'refunded';
    order.refund = { amount: order.total, reason, at: iso(), by: actor?.id ?? null };
    if (c && order.pointsEarned) c.loyaltyPoints = Math.max(0, c.loyaltyPoints - order.pointsEarned);
  }
  releaseTable(order);
}

/** Record payment; earn loyalty points; close the order if already served. */
export function markPaid(order, method) {
  order.paymentStatus = 'paid';
  order.paymentMethod = method || order.paymentMethod || 'card';
  order.paidAt = iso();
  awardPoints(order);
  if (order.status === 'served') closeOrder(order);
}

/** Undo a payment recorded in error (closed orders re-open as served). */
export function markUnpaid(order) {
  const c = order.customerId ? customers.find((x) => x.id === order.customerId) : null;
  if (c && order.pointsEarned) c.loyaltyPoints = Math.max(0, c.loyaltyPoints - order.pointsEarned);
  order.pointsEarned = 0;
  order.paymentStatus = 'unpaid';
  order.paidAt = null;
  if (order.split) order.split.parts.forEach((p) => { p.paid = false; });
  if (order.status === 'closed') {
    order.status = 'served';
    order.closedAt = null;
    if (order.tableId) occupyTable(order.tableId, order.waiterId);
  }
}

function awardPoints(order) {
  if (!order.customerId || order.pointsEarned) return;
  const c = customers.find((x) => x.id === order.customerId);
  if (!c) return;
  order.pointsEarned = Math.floor(order.total);
  c.loyaltyPoints += order.pointsEarned;
}

/* ---------------------------------------------------------------- tables */

export function occupyTable(tableId, waiterId) {
  const t = tables.find((x) => x.id === tableId);
  if (!t) return;
  t.status = 'occupied';
  t.reservedFor = null;
  if (waiterId && !t.waiterId) t.waiterId = waiterId;
}

/**
 * Free the order's table once it has no other active orders — unless staff
 * have manually held it (US6.4).
 */
export function releaseTable(order) {
  if (!order.tableId) return;
  const t = tables.find((x) => x.id === order.tableId);
  if (!t || t.held) return;
  const stillActive = orders.some((o) => o.id !== order.id && o.tableId === t.id && isActive(o));
  if (stillActive) return;
  t.status = 'free';
  t.waiterId = null;
}

/* ------------------------------------------------------------- inventory */

const round3 = (n) => Math.round(n * 1000) / 1000;

export function recordMovement(item, delta, reason, ref = {}) {
  stockMovements.push({
    id: nextId('mov'),
    inventoryId: item.id,
    name: item.name,
    unit: item.unit,
    delta: round3(delta),
    stockAfter: item.stock,
    reason,
    orderId: ref.orderId ?? null,
    orderNumber: ref.orderNumber ?? null,
    userId: ref.userId ?? null,
    at: iso(),
  });
  if (stockMovements.length > 2000) stockMovements.splice(0, stockMovements.length - 2000);
}

/** Change stock and alert managers when it crosses the reorder threshold. */
export function adjustStock(item, delta, reason, ref) {
  const before = item.stock;
  item.stock = round3(Math.max(0, before + delta));
  recordMovement(item, item.stock - before, reason, ref);
  if (before > item.reorderLevel && item.stock <= item.reorderLevel) {
    notify({
      role: 'manager',
      type: 'low_stock',
      title: 'Low stock',
      message: `${item.name} is at or below its reorder level (${item.stock} ${item.unit} left).`,
      link: '/staff/inventory',
    });
  }
}

/** Deduct each dish's recipe (bill of materials) from stock, once per order (US8.3). */
export function deductStock(order) {
  if (order.stockDeducted) return;
  const usage = new Map();
  for (const line of order.items) {
    const dish = menuItems.find((m) => m.id === line.menuItemId);
    for (const r of dish?.recipe || []) {
      usage.set(r.inventoryId, (usage.get(r.inventoryId) || 0) + r.qty * line.qty);
    }
  }
  for (const [inventoryId, qty] of usage) {
    const item = inventory.find((i) => i.id === inventoryId);
    if (item) adjustStock(item, -qty, 'sale', { orderId: order.id, orderNumber: order.number });
  }
  order.stockDeducted = true;
}

/* -------------------------------------------------------------- kitchen */

/** Active kitchen orders in queue order: rush first, then manual rank (oldest first). */
export function kitchenQueue() {
  return orders
    .filter((o) => KITCHEN_STATUSES.includes(o.status))
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority === 'rush' ? -1 : 1;
      return (a.kitchenRank ?? 0) - (b.kitchenRank ?? 0);
    });
}

/** Move an order one place up/down within its priority band of the queue (US4.5). */
export function moveInQueue(order, direction) {
  const band = kitchenQueue().filter((o) => o.priority === order.priority && o.status !== 'ready');
  const idx = band.findIndex((o) => o.id === order.id);
  const swapWith = band[direction === 'up' ? idx - 1 : idx + 1];
  if (idx === -1 || !swapWith) return false;
  [order.kitchenRank, swapWith.kitchenRank] = [swapWith.kitchenRank, order.kitchenRank];
  if (order.kitchenRank === swapWith.kitchenRank) order.kitchenRank += direction === 'up' ? -1 : 1;
  return true;
}

/* -------------------------------------------------------- notifications */

export function waiterTarget(order) {
  return order.waiterId ? { userId: order.waiterId } : { role: 'waiter' };
}

export function notifyItemReady(order, item) {
  notify({
    ...waiterTarget(order),
    type: 'item_ready',
    title: 'Ready for pickup',
    message: `${orderLabel(order)} · ${item.qty}× ${item.name} is ready at the pass.`,
    link: '/staff/orders',
    orderId: order.id,
  });
}

function notifyOrderReady(order) {
  notify({
    ...waiterTarget(order),
    type: 'order_ready',
    title: 'Order ready',
    message: `${orderLabel(order)} — order #${order.number} is ready to serve.`,
    link: '/staff/orders',
    orderId: order.id,
  });
  const c = order.customerId ? customers.find((x) => x.id === order.customerId) : null;
  if (c?.userId && order.type === 'online') {
    notify({
      userId: c.userId,
      type: 'order_ready',
      title: 'Your order is ready',
      message:
        order.fulfillment === 'delivery'
          ? `Order #${order.number} is on its way to you.`
          : `Order #${order.number} is ready for pickup at ${settings.restaurantName}.`,
      link: '/account',
      orderId: order.id,
    });
  }
}

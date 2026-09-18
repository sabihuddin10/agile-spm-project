import { Router } from 'express';
import {
  orders,
  orderSeq,
  customers,
  customerOrderHistory,
  tables,
  menuItems,
  nextId,
  findCustomerByUserId,
  findOrderById,
  ORDER_STATUSES,
} from '../data/store.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

// Customer may place & view their own online orders. Staff manage all orders.
const staffRoles = requireRole('waiter', 'chef', 'manager', 'admin');

const POINT_VALUE = 0.1; // each Flame Point is worth $0.10 off

function serializeOrder(order, withCustomer = false) {
  const out = {
    ...order,
    status: order.status,
    tableNumber: order.tableId ? tables.find((t) => t.id === order.tableId)?.number ?? null : null,
  };
  if (withCustomer && order.customerId) {
    const c = customers.find((x) => x.id === order.customerId);
    out.customer = c ? { id: c.id, name: c.name, email: c.email } : null;
  }
  return out;
}

function computeTotals(items) {
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const tax = subtotal * 0.1; // 10% sales tax
  const total = subtotal + tax;
  return { subtotal, tax, total };
}

/** POST /api/orders — place an order (customer online OR waiter dine-in). */
router.post('/', (req, res) => {
  const {
    type = 'dine-in',
    tableId = null,
    items = [],
    fulfillment = 'pickup',
    paymentMethod = 'card',
    notes = '',
    pointsUsed = 0,
  } = req.body || {};

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'An order must contain at least one item.' });
  }

  const isCustomer = req.user.role === 'customer';
  const isStaff = ['waiter', 'chef', 'manager', 'admin'].includes(req.user.role);
  if (!isCustomer && !isStaff) {
    return res.status(403).json({ error: 'Not allowed to place an order.' });
  }
  if (isCustomer && type !== 'online') {
    return res.status(400).json({ error: 'Customers can only place online orders.' });
  }

  // Resolve customer id.
  let customerId = req.body.customerId ?? null;
  if (!customerId) {
    const linked = findCustomerByUserId(req.user.id);
    customerId = linked?.id ?? null;
  }

  if (tableId && !tables.some((t) => t.id === tableId)) {
    return res.status(400).json({ error: 'Unknown table.' });
  }

  const validItems = [];
  for (const i of items) {
    const menu = menuItems.find((m) => m.id === i.menuItemId);
    if (!menu) return res.status(400).json({ error: `Unknown menu item: ${i.menuItemId}` });
    if (!menu.available) return res.status(409).json({ error: `${menu.name} is currently unavailable.` });
    validItems.push({
      id: nextId('oi'),
      menuItemId: menu.id,
      name: menu.name,
      qty: Math.max(1, Number(i.qty) || 1),
      price: menu.price,
      status: 'placed',
      modifiers: Array.isArray(i.modifiers) ? i.modifiers : [],
    });
  }

  const validFulfillment = ['pickup', 'delivery'].includes(fulfillment) ? fulfillment : 'pickup';
  const validPayment = ['card', 'cash'].includes(paymentMethod) ? paymentMethod : 'card';
  const pointsRequested = Math.max(0, Math.floor(Number(pointsUsed) || 0));

  const { subtotal } = computeTotals(validItems);

  // Redeem Flame Points against the subtotal; customers earn 1 point per $1 spent.
  let pointsRedeemed = 0;
  let pointsCredit = 0;
  let pointsEarned = 0;

  if (isCustomer && customerId) {
    const c = customers.find((x) => x.id === customerId);
    if (c) {
      const balance = c.loyaltyPoints || 0;
      const maxAffordable = Math.floor(subtotal / POINT_VALUE);
      pointsRedeemed = Math.min(balance, pointsRequested, Math.max(0, maxAffordable));
      pointsCredit = pointsRedeemed * POINT_VALUE;
      c.loyaltyPoints = balance - pointsRedeemed;
    }
  }

  const tax = subtotal * 0.1;
  const total = Math.max(0, subtotal + tax - pointsCredit);

  if (isCustomer && customerId) {
    const c = customers.find((x) => x.id === customerId);
    if (c) {
      pointsEarned = Math.floor(total);
      c.loyaltyPoints = (c.loyaltyPoints || 0) + pointsEarned;
    }
  }

  const order = {
    id: nextId('ord'),
    number: ++orderSeq.lastNumber,
    type,
    fulfillment: isCustomer ? validFulfillment : 'pickup',
    paymentMethod: isCustomer ? validPayment : null,
    tableId,
    customerId,
    status: type === 'online' ? 'placed' : 'confirmed',
    source: type === 'online' ? 'customer' : 'waiter',
    items: validItems,
    subtotal,
    tax,
    discount: pointsCredit,
    total,
    pointsUsed: pointsRedeemed,
    pointsEarned,
    notes: isCustomer && notes ? String(notes) : '',
    paidAt: isCustomer && validPayment === 'card' ? new Date().toISOString() : null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  orders.push(order);

  // Record in customer order history.
  if (customerId) {
    if (!customerOrderHistory[customerId]) customerOrderHistory[customerId] = [];
    customerOrderHistory[customerId].push({
      id: order.id,
      date: new Date().toISOString().slice(0, 10),
      total,
      items: validItems.map((i) => i.name),
      pointsEarned,
      paymentMethod: isCustomer ? validPayment : null,
    });
    const c = customers.find((x) => x.id === customerId);
    if (c) c.totalSpend = (c.totalSpend || 0) + total;
  }

  return res.status(201).json({ order: serializeOrder(order) });
});

/** GET /api/orders — list orders, filterable. */
router.get('/', staffRoles, (req, res) => {
  const { status, tableId, type } = req.query;
  let result = [...orders];
  if (status) result = result.filter((o) => o.status === status);
  if (tableId) result = result.filter((o) => o.tableId === tableId);
  if (type) result = result.filter((o) => o.type === type);
  result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ orders: result.map((o) => serializeOrder(o, true)) });
});

/** GET /api/orders/mine — current customer's orders (self-service). */
router.get('/mine', (req, res) => {
  if (req.user.role === 'customer') {
    const linked = findCustomerByUserId(req.user.id);
    if (!linked) return res.json({ orders: [] });
    const mine = orders.filter((o) => o.customerId === linked.id);
    return res.json({ orders: mine.map((o) => serializeOrder(o)) });
  }
  return res.json({ orders: [] });
});

/** GET /api/orders/:id — single order. */
router.get('/:id', (req, res) => {
  const order = findOrderById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });

  // Customers may only view their own order.
  if (req.user.role === 'customer') {
    const linked = findCustomerByUserId(req.user.id);
    if (!linked || order.customerId !== linked.id) {
      return res.status(403).json({ error: 'Not allowed.' });
    }
  }
  res.json({ order: serializeOrder(order, true) });
});

/** PATCH /api/orders/:id — update order status (staff) or mark paid.
 *  Body: { status?, itemId?+itemStatus? , paid? }
 */
router.patch('/:id', staffRoles, (req, res) => {
  const order = findOrderById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });

  const { status, discount, paid, itemId, itemStatus } = req.body || {};

  if (status !== undefined) {
    if (!ORDER_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status.' });
    order.status = status;
    if (status === 'paid') order.paidAt = new Date().toISOString();
  }

  if (itemId !== undefined && itemStatus !== undefined) {
    const item = order.items.find((i) => i.id === itemId);
    if (!item) return res.status(404).json({ error: 'Order item not found.' });
    item.status = itemStatus;
    // If any item becomes ready, promote outer status if in_kitchen.
  }

  if (discount !== undefined) {
    order.discount = Number(discount) || 0;
    order.total = order.subtotal + (order.tax ?? 0) - order.discount;
  }

  order.updatedAt = new Date().toISOString();
  res.json({ order: serializeOrder(order, true) });
});

/** DELETE /api/orders/:id — cancel (staff). */
router.delete('/:id', staffRoles, (req, res) => {
  const idx = orders.findIndex((o) => o.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Order not found.' });
  const [removed] = orders.splice(idx, 1);
  if (removed.tableId) {
    const t = tables.find((x) => x.id === removed.tableId);
    if (t) t.status = 'free';
  }
  res.json({ deleted: true, id: removed.id });
});

export default router;

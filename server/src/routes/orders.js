import { Router } from 'express';
import {
  orders,
  customers,
  tables,
  menuItems,
  settings,
  findCustomerByUserId,
  findOrderById,
  buildOrderItem,
  createOrderRecord,
  nextId,
} from '../data/store.js';
import { requireRole } from '../middleware/auth.js';
import { computeTotals, priceSelection, toCents, fromCents } from '../lib/order-math.js';
import {
  ACTIVE_STATUSES,
  serializeOrder,
  syncOrderStatus,
  confirmOrder,
  cancelOrder,
  markPaid,
  occupyTable,
  releaseTable,
  kitchenQueue,
  moveInQueue,
  notifyItemReady,
  orderLabel,
} from '../lib/orders.js';
import { notify } from '../lib/notify.js';
import { localDate, iso } from '../lib/time.js';

const router = Router();

const FLOOR = ['waiter', 'manager', 'admin'];
const KITCHEN = ['chef', 'manager', 'admin'];
const ALL_STAFF = ['waiter', 'chef', 'manager', 'admin'];

const staffRoles = requireRole(...ALL_STAFF);
const floorRoles = requireRole(...FLOOR);
const kitchenRoles = requireRole(...KITCHEN);

/** Validate requested lines and price them from the live menu (never trust client prices). */
function buildLines(rawItems, status) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return { error: 'An order must contain at least one item.', code: 400 };
  }
  const lines = [];
  for (const raw of rawItems) {
    const menu = menuItems.find((m) => m.id === raw?.menuItemId);
    if (!menu) return { error: `Unknown menu item: ${raw?.menuItemId}`, code: 400 };
    if (!menu.available) {
      return { error: `${menu.name} is currently unavailable — please remove it from your order.`, code: 409 };
    }
    const priced = priceSelection(menu, raw.modifiers);
    if (priced.error) return { error: priced.error, code: 400 };
    lines.push(buildOrderItem(menu, raw.qty, raw.modifiers, status));
  }
  return { lines };
}

function isOwner(order, user) {
  if (user.role !== 'customer') return false;
  const linked = findCustomerByUserId(user.id);
  return Boolean(linked && order.customerId === linked.id);
}

function provisionCustomer(user) {
  let c = findCustomerByUserId(user.id);
  if (!c) {
    c = {
      id: nextId('cus'),
      userId: user.id,
      name: user.name,
      email: user.email,
      phone: '',
      type: 'online',
      loyaltyPoints: 0,
      preferences: { dietary: [], allergies: [] },
      notes: '',
      createdAt: iso(),
    };
    customers.push(c);
  }
  return c;
}

/* ---------------------------------------------------------------- create */

/**
 * POST /api/orders — place an order.
 * Customers: online (pickup/delivery) or dine-in at their table → status 'placed'.
 * Floor staff: dine-in or takeaway; sent straight to the kitchen ('confirmed')
 * unless sendToKitchen is false.
 */
router.post('/', (req, res) => {
  const user = req.user;
  const isCustomer = user.role === 'customer';
  if (!isCustomer && !FLOOR.includes(user.role)) {
    return res.status(403).json({ error: 'Your role cannot place orders.' });
  }

  const body = req.body || {};
  const type = body.type === 'online' ? 'online' : body.type === 'dine-in' ? 'dine-in' : null;
  if (!type) return res.status(400).json({ error: 'Order type must be "dine-in" or "online".' });

  const built = buildLines(body.items, 'pending');
  if (built.error) return res.status(built.code).json({ error: built.error });

  // Table: required when a customer orders from their table; optional for staff.
  let tableId = null;
  if (type === 'dine-in') {
    tableId = body.tableId || null;
    if (isCustomer && !tableId) return res.status(400).json({ error: 'Choose the table you are sitting at.' });
    if (tableId && !tables.some((t) => t.id === tableId)) return res.status(400).json({ error: 'Unknown table.' });
  }

  let fulfillment = 'dine-in';
  let deliveryAddress = '';
  if (type === 'online') {
    fulfillment = body.fulfillment === 'delivery' ? 'delivery' : 'pickup';
    deliveryAddress = String(body.deliveryAddress || '').trim();
    if (fulfillment === 'delivery' && !deliveryAddress) {
      return res.status(400).json({ error: 'A delivery address is required.' });
    }
  }

  // Customer: only customers place orders against their own profile. Staff may
  // attach a ledger customer. (A customer-supplied customerId is ignored.)
  let customer = null;
  if (isCustomer) {
    customer = provisionCustomer(user);
  } else if (body.customerId) {
    customer = customers.find((c) => c.id === body.customerId);
    if (!customer) return res.status(400).json({ error: 'Unknown customer.' });
  }

  const order = createOrderRecord({
    type,
    fulfillment,
    deliveryAddress,
    tableId,
    customerId: customer?.id ?? null,
    createdBy: user.id,
    source: isCustomer ? 'customer' : 'staff',
    waiterId: isCustomer ? null : user.id,
    items: built.lines,
    notes: String(body.notes || '').slice(0, 500),
    paymentMethod: isCustomer ? (body.paymentMethod === 'cash' ? 'cash' : 'card') : null,
  });

  // Redeem Flame Points (customers only), capped at balance and subtotal.
  if (isCustomer && customer) {
    const requested = Math.max(0, Math.floor(Number(body.pointsUsed) || 0));
    const maxBySubtotal = Math.floor(toCents(order.subtotal) / toCents(settings.pointValue));
    const redeemed = Math.min(requested, customer.loyaltyPoints, maxBySubtotal);
    if (redeemed > 0) {
      customer.loyaltyPoints -= redeemed;
      order.pointsUsed = redeemed;
      order.discount = fromCents(redeemed * toCents(settings.pointValue));
      computeTotals(order);
    }
  }

  orders.push(order);

  if (!isCustomer && body.sendToKitchen !== false) {
    confirmOrder(order, user);
  } else if (order.tableId) {
    occupyTable(order.tableId, order.waiterId);
  }

  if (isCustomer && order.paymentMethod === 'card') markPaid(order, 'card');

  if (order.status === 'placed') {
    notify({
      role: 'waiter',
      type: 'order_placed',
      title: type === 'online' ? 'New online order' : 'New table order',
      message: `${orderLabel(order)} — order #${order.number} is waiting for confirmation.`,
      link: '/staff/orders',
      orderId: order.id,
    });
  }

  return res.status(201).json({ order: serializeOrder(order) });
});

/* ----------------------------------------------------------------- reads */

/**
 * GET /api/orders — staff order list.
 * scope=active (default) | today (active + anything created today) | all
 */
router.get('/', staffRoles, (req, res) => {
  const { status, tableId, type, customerId, scope = 'active' } = req.query;
  const today = localDate();
  let result = orders.filter((o) => {
    if (scope === 'all') return true;
    if (ACTIVE_STATUSES.includes(o.status)) return true;
    return scope === 'today' && localDate(new Date(o.createdAt)) === today;
  });
  if (status) result = result.filter((o) => o.status === status);
  if (tableId) result = result.filter((o) => o.tableId === tableId);
  if (type) result = result.filter((o) => o.type === type);
  if (customerId) result = result.filter((o) => o.customerId === customerId);
  result = result.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (scope === 'all') result = result.slice(0, 300);
  res.json({ orders: result.map(serializeOrder) });
});

/** GET /api/orders/mine — the signed-in customer's orders, newest first. */
router.get('/mine', (req, res) => {
  if (req.user.role !== 'customer') return res.json({ orders: [] });
  const linked = findCustomerByUserId(req.user.id);
  if (!linked) return res.json({ orders: [] });
  const mine = orders
    .filter((o) => o.customerId === linked.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 50);
  return res.json({ orders: mine.map(serializeOrder) });
});

/**
 * GET /api/orders/kitchen — the KDS queue (confirmed/preparing, rush first then
 * oldest first) and the ready-for-pickup list (US4.1, US4.3).
 */
router.get('/kitchen', staffRoles, (req, res) => {
  const all = kitchenQueue();
  res.json({
    queue: all.filter((o) => o.status !== 'ready').map(serializeOrder),
    ready: all
      .filter((o) => o.status === 'ready')
      .sort((a, b) => (a.readyAt || '').localeCompare(b.readyAt || ''))
      .map(serializeOrder),
    delayMinutes: settings.kitchenDelayMinutes,
  });
});

/** GET /api/orders/:id — staff, or the customer who owns it. */
router.get('/:id', (req, res) => {
  const order = findOrderById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  if (req.user.role === 'customer' && !isOwner(order, req.user)) {
    return res.status(403).json({ error: 'Not allowed.' });
  }
  res.json({ order: serializeOrder(order) });
});

/* -------------------------------------------------------------- mutations */

/**
 * PUT /api/orders/:id/items — replace line items. Only allowed while the order
 * is still 'placed', i.e. before a waiter confirms it (US3.2).
 */
router.put('/:id/items', floorRoles, (req, res) => {
  const order = findOrderById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  if (order.status !== 'placed') {
    return res.status(409).json({ error: 'Line items can only be edited before the order is confirmed.' });
  }
  if (order.paymentStatus !== 'unpaid') {
    return res.status(409).json({ error: 'This order was prepaid online — cancel it and place a new one instead.' });
  }
  const built = buildLines(req.body?.items, 'pending');
  if (built.error) return res.status(built.code).json({ error: built.error });

  order.items = built.lines;
  computeTotals(order);
  order.updatedAt = iso();
  res.json({ order: serializeOrder(order) });
});

const TRANSITIONS = {
  confirmed: { roles: FLOOR, from: ['placed'] },
  preparing: { roles: KITCHEN, from: ['confirmed'] },
  ready: { roles: KITCHEN, from: ['confirmed', 'preparing'] },
  served: { roles: FLOOR, from: ['ready'] },
  cancelled: { roles: FLOOR, from: ['placed', 'confirmed', 'preparing', 'ready', 'served'] },
};

/**
 * POST /api/orders/:id/status — move the whole order through its lifecycle:
 * placed → confirmed → preparing → ready → served (→ closed once paid).
 * Customers may cancel their own order while it is still 'placed'.
 */
router.post('/:id/status', (req, res) => {
  const order = findOrderById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });

  const { status, reason } = req.body || {};
  const rule = TRANSITIONS[status];
  if (!rule) return res.status(400).json({ error: 'Invalid status.' });

  const customerCancel = status === 'cancelled' && order.status === 'placed' && isOwner(order, req.user);
  if (!customerCancel && !rule.roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'You do not have permission to perform this action.' });
  }
  if (!rule.from.includes(order.status)) {
    return res.status(409).json({ error: `Cannot move an order from "${order.status}" to "${status}".` });
  }

  const now = iso();
  if (status === 'confirmed') {
    confirmOrder(order, req.user);
  } else if (status === 'preparing') {
    order.items.forEach((i) => {
      if (i.status === 'queued') Object.assign(i, { status: 'preparing', preparedBy: req.user.id });
    });
    syncOrderStatus(order, req.user);
  } else if (status === 'ready') {
    order.items.forEach((i) => {
      if (['queued', 'preparing'].includes(i.status)) {
        Object.assign(i, { status: 'ready', readyAt: now, preparedBy: i.preparedBy || req.user.id });
      }
    });
    syncOrderStatus(order, req.user);
  } else if (status === 'served') {
    order.items.forEach((i) => {
      if (i.status !== 'served') Object.assign(i, { status: 'served', servedAt: now });
    });
    syncOrderStatus(order, req.user);
  } else if (status === 'cancelled') {
    cancelOrder(order, req.user, String(reason || 'Order cancelled'));
  }

  order.updatedAt = now;
  res.json({ order: serializeOrder(order) });
});

const ITEM_TRANSITIONS = {
  preparing: { roles: KITCHEN, from: ['queued'] },
  ready: { roles: KITCHEN, from: ['queued', 'preparing'] },
  served: { roles: FLOOR, from: ['ready'] },
};

/** PATCH /api/orders/:id/items/:itemId — item-level status (US3.4, US4.2, US4.3). */
router.patch('/:id/items/:itemId', staffRoles, (req, res) => {
  const order = findOrderById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  const item = order.items.find((i) => i.id === req.params.itemId);
  if (!item) return res.status(404).json({ error: 'Order item not found.' });

  const { status } = req.body || {};
  const rule = ITEM_TRANSITIONS[status];
  if (!rule) return res.status(400).json({ error: 'Invalid item status.' });
  if (!rule.roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'You do not have permission to perform this action.' });
  }
  if (!['confirmed', 'preparing', 'ready', 'served'].includes(order.status)) {
    return res.status(409).json({ error: 'Confirm the order before working on its items.' });
  }
  if (!rule.from.includes(item.status)) {
    return res.status(409).json({ error: `Cannot move ${item.name} from "${item.status}" to "${status}".` });
  }

  const now = iso();
  item.status = status;
  if (status === 'preparing') item.preparedBy = req.user.id;
  if (status === 'ready') {
    item.readyAt = now;
    item.preparedBy = item.preparedBy || req.user.id;
  }
  if (status === 'served') item.servedAt = now;

  const before = order.status;
  syncOrderStatus(order, req.user);
  // The order-level "ready" notification covers the last item; announce earlier ones individually.
  if (status === 'ready' && order.status !== 'ready' && before !== 'ready') notifyItemReady(order, item);

  order.updatedAt = now;
  res.json({ order: serializeOrder(order) });
});

/** PATCH /api/orders/:id/table — attach a dine-in order to a table (US3.5, US6.3). */
router.patch('/:id/table', floorRoles, (req, res) => {
  const order = findOrderById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  if (order.type !== 'dine-in') return res.status(400).json({ error: 'Online orders do not need a table.' });
  if (!ACTIVE_STATUSES.includes(order.status)) return res.status(409).json({ error: 'This order is already finished.' });

  const { tableId } = req.body || {};
  const table = tables.find((t) => t.id === tableId);
  if (!table) return res.status(400).json({ error: 'Unknown table.' });

  const previous = order.tableId;
  order.tableId = table.id;
  if (!order.waiterId && FLOOR.includes(req.user.role)) order.waiterId = req.user.id;
  occupyTable(table.id, order.waiterId);
  if (previous && previous !== table.id) releaseTable({ ...order, tableId: previous });

  order.updatedAt = iso();
  res.json({ order: serializeOrder(order) });
});

/**
 * POST /api/orders/:id/kitchen — reprioritize the KDS queue (US4.5).
 * action: up | down | rush | normal
 */
router.post('/:id/kitchen', kitchenRoles, (req, res) => {
  const order = findOrderById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  if (!['confirmed', 'preparing'].includes(order.status)) {
    return res.status(409).json({ error: 'Only orders in the kitchen queue can be reprioritized.' });
  }
  const { action } = req.body || {};
  if (action === 'rush' || action === 'normal') {
    order.priority = action;
  } else if (action === 'up' || action === 'down') {
    if (!moveInQueue(order, action)) {
      return res.status(409).json({ error: `Order is already at the ${action === 'up' ? 'top' : 'bottom'} of its queue.` });
    }
  } else {
    return res.status(400).json({ error: 'action must be up, down, rush or normal.' });
  }
  order.updatedAt = iso();
  res.json({ order: serializeOrder(order) });
});

export default router;

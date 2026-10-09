import { Router } from 'express';
import { orders, settings, customers, findOrderById, findCustomerByUserId } from '../data/store.js';
import { requireRole } from '../middleware/auth.js';
import { computeTotals, lineTotal, splitEvenCents, splitByItems, toCents, fromCents } from '../lib/order-math.js';
import { markPaid, markUnpaid, tableNumber, userName } from '../lib/orders.js';
import { localDate, iso } from '../lib/time.js';
import { text, number } from '../lib/validate.js';

const router = Router();

const billingRoles = requireRole('waiter', 'manager', 'admin');
const managerRoles = requireRole('manager', 'admin');

const PAYMENT_METHODS = ['card', 'cash'];
const MAX_TIP = 10000;

/** Itemized bill for an order (US5.1, US5.2). */
function invoice(order) {
  const c = order.customerId ? customers.find((x) => x.id === order.customerId) : null;
  const refundedAmount = order.refund?.amount ?? 0;
  return {
    id: order.id,
    number: order.number,
    receiptNumber: `R-${order.number}`,
    type: order.type,
    fulfillment: order.fulfillment,
    tableNumber: tableNumber(order.tableId),
    customerName: c?.name ?? null,
    waiterName: userName(order.waiterId),
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    paid: order.paymentStatus !== 'unpaid',
    lines: order.items.map((i) => ({
      id: i.id,
      name: i.name,
      qty: i.qty,
      basePrice: i.basePrice,
      modifiers: i.modifiers,
      unitPrice: i.unitPrice,
      lineTotal: lineTotal(i),
    })),
    subtotal: order.subtotal,
    discount: order.discount,
    pointsUsed: order.pointsUsed,
    pointsEarned: order.pointsEarned,
    serviceCharge: order.serviceCharge,
    serviceChargeRate: order.type === 'dine-in' ? order.rates.serviceChargeRate : 0,
    tax: order.tax,
    taxRate: order.rates.taxRate,
    tip: order.tip,
    total: order.total,
    refund: order.refund,
    refundedAmount,
    netTotal: fromCents(toCents(order.total) - toCents(refundedAmount)),
    split: order.split,
    createdAt: order.createdAt,
    servedAt: order.servedAt,
    paidAt: order.paidAt,
    closedAt: order.closedAt,
    restaurant: { name: settings.restaurantName, address: settings.address },
  };
}

function canView(order, user) {
  if (['waiter', 'manager', 'admin'].includes(user.role)) return true;
  if (user.role !== 'customer') return false;
  const linked = findCustomerByUserId(user.id);
  return Boolean(linked && linked.id === order.customerId);
}

function loadOrder(req, res) {
  const order = findOrderById(req.params.id);
  if (!order) {
    res.status(404).json({ error: 'Order not found.' });
    return null;
  }
  return order;
}

function requireUnpaid(order, res) {
  if (order.status === 'cancelled') {
    res.status(409).json({ error: 'This order was cancelled.' });
    return false;
  }
  if (order.paymentStatus !== 'unpaid') {
    res.status(409).json({ error: 'This bill has already been settled.' });
    return false;
  }
  return true;
}

/** Once any guest has paid a share, the bill's total and split are locked. */
function requireNoPaidShares(order, res) {
  if (order.split?.parts.some((p) => p.paid)) {
    res.status(409).json({ error: 'A guest has already paid their share — finish settling the existing split first.' });
    return false;
  }
  return true;
}

/**
 * GET /api/billing — bills. scope=open (unpaid, default) | today | all.
 * Outstanding views exclude paid bills (US5.4).
 */
router.get('/', billingRoles, (req, res) => {
  const { scope = 'open' } = req.query;
  const today = localDate();
  let list = orders.filter((o) => o.status !== 'cancelled');
  if (scope === 'open') list = list.filter((o) => o.paymentStatus === 'unpaid');
  else if (scope === 'today') {
    list = list.filter(
      (o) => o.paymentStatus === 'unpaid' || localDate(new Date(o.paidAt || o.createdAt)) === today,
    );
  }
  list = list.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 300);

  const openOrders = orders.filter((o) => o.status !== 'cancelled' && o.paymentStatus === 'unpaid');
  const paidToday = orders.filter(
    (o) => o.paymentStatus !== 'unpaid' && o.paidAt && localDate(new Date(o.paidAt)) === today,
  );
  res.json({
    bills: list.map(invoice),
    summary: {
      outstanding: fromCents(openOrders.reduce((s, o) => s + toCents(o.total), 0)),
      openCount: openOrders.length,
      paidToday: fromCents(paidToday.reduce((s, o) => s + toCents(o.total) - toCents(o.refund?.amount ?? 0), 0)),
      paidTodayCount: paidToday.length,
    },
  });
});

/** GET /api/billing/:id — full itemized invoice (staff, or the customer who owns it). */
router.get('/:id', (req, res) => {
  const order = loadOrder(req, res);
  if (!order) return;
  if (!canView(order, req.user)) return res.status(403).json({ error: 'Not allowed.' });
  res.json({ invoice: invoice(order) });
});

/** GET /api/billing/:id/receipt — formatted receipt for a settled bill (US5.5). */
router.get('/:id/receipt', (req, res) => {
  const order = loadOrder(req, res);
  if (!order) return;
  if (!canView(order, req.user)) return res.status(403).json({ error: 'Not allowed.' });
  if (order.paymentStatus === 'unpaid') {
    return res.status(409).json({ error: 'A receipt is available once the bill is paid.' });
  }
  res.json({ receipt: { ...invoice(order), issuedAt: iso() } });
});

/** POST /api/billing/:id/tip — add a tip as { amount } or { percent } (US5.2). */
router.post('/:id/tip', billingRoles, (req, res) => {
  const order = loadOrder(req, res);
  if (!order || !requireUnpaid(order, res) || !requireNoPaidShares(order, res)) return;
  const { amount, percent } = req.body || {};
  let tip;
  if (percent !== undefined && percent !== null) {
    const p = number(percent, 'Tip percent', { min: 0, max: 100, message: 'Tip percent must be between 0 and 100.' });
    tip = fromCents(Math.round(toCents(order.subtotal) * (p / 100)));
  } else {
    // A finite amount only: "Infinity" or 1e308 would break every total downstream.
    tip = number(amount, 'Tip', { required: true, min: 0, max: MAX_TIP, message: `Tip must be between 0 and ${MAX_TIP}.` });
  }
  order.tip = tip;
  order.split = null; // totals changed — any split must be redone
  computeTotals(order);
  order.updatedAt = iso();
  res.json({ invoice: invoice(order) });
});

/**
 * POST /api/billing/:id/split — split the bill (US5.3).
 * { mode: 'even', ways } or { mode: 'items', groups: [[itemId, ...], ...] }.
 * Parts always sum exactly to the bill total.
 */
router.post('/:id/split', billingRoles, (req, res) => {
  const order = loadOrder(req, res);
  if (!order || !requireUnpaid(order, res) || !requireNoPaidShares(order, res)) return;
  const { mode, ways, groups } = req.body || {};

  let parts;
  if (mode === 'even') {
    const n = Math.floor(Number(ways));
    if (!(n >= 2 && n <= 20)) return res.status(400).json({ error: 'Split between 2 and 20 payers.' });
    parts = splitEvenCents(toCents(order.total), n).map((cents, i) => ({
      label: `Guest ${i + 1}`,
      amount: fromCents(cents),
      itemIds: [],
      paid: false,
    }));
  } else if (mode === 'items') {
    const result = splitByItems(order, groups);
    if (result.error) return res.status(400).json({ error: result.error });
    parts = result.amounts.map((amount, i) => ({ label: `Guest ${i + 1}`, amount, itemIds: groups[i], paid: false }));
  } else {
    return res.status(400).json({ error: 'mode must be "even" or "items".' });
  }

  order.split = { mode, parts, createdAt: iso() };
  order.updatedAt = iso();
  res.json({ invoice: invoice(order) });
});

/** DELETE /api/billing/:id/split — undo a split. */
router.delete('/:id/split', billingRoles, (req, res) => {
  const order = loadOrder(req, res);
  if (!order || !requireUnpaid(order, res) || !requireNoPaidShares(order, res)) return;
  order.split = null;
  res.json({ invoice: invoice(order) });
});

/** POST /api/billing/:id/split/:index/pay — one payer settles their share. */
router.post('/:id/split/:index/pay', billingRoles, (req, res) => {
  const order = loadOrder(req, res);
  if (!order || !requireUnpaid(order, res)) return;
  const part = order.split?.parts[Number(req.params.index)];
  if (!part) return res.status(404).json({ error: 'Split part not found.' });
  if (part.paid) return res.status(409).json({ error: `${part.label} has already paid.` });

  const method = PAYMENT_METHODS.includes(req.body?.method) ? req.body.method : 'card';
  Object.assign(part, { paid: true, method, paidAt: iso() });
  if (order.split.parts.every((p) => p.paid)) markPaid(order, 'split');
  order.updatedAt = iso();
  res.json({ invoice: invoice(order) });
});

/** POST /api/billing/:id/pay — record payment; the bill leaves outstanding views (US5.4). */
router.post('/:id/pay', billingRoles, (req, res) => {
  const order = loadOrder(req, res);
  if (!order) return;
  if (order.status === 'cancelled') return res.status(409).json({ error: 'This order was cancelled.' });
  if (order.paymentStatus !== 'unpaid') return res.json({ invoice: invoice(order), alreadyPaid: true });
  if (order.split?.parts.some((p) => p.paid)) {
    return res.status(409).json({ error: 'This bill is split — settle the remaining shares individually.' });
  }
  const method = PAYMENT_METHODS.includes(req.body?.method) ? req.body.method : 'card';
  markPaid(order, method);
  order.updatedAt = iso();
  res.json({ invoice: invoice(order), alreadyPaid: false });
});

/** POST /api/billing/:id/unpay — reverse a payment recorded in error (US5.4). */
router.post('/:id/unpay', managerRoles, (req, res) => {
  const order = loadOrder(req, res);
  if (!order) return;
  if (order.paymentStatus !== 'paid' || order.refund) {
    return res.status(409).json({ error: 'Only a paid, un-refunded bill can be marked unpaid.' });
  }
  markUnpaid(order);
  order.updatedAt = iso();
  res.json({ invoice: invoice(order) });
});

/**
 * POST /api/billing/:id/refund — manager refund with a reason (US5.5).
 * Body: { reason, amount? } — amount defaults to the full remaining total.
 * Refunded amounts are excluded from reported revenue.
 */
router.post('/:id/refund', managerRoles, (req, res) => {
  const order = loadOrder(req, res);
  if (!order) return;
  if (order.paymentStatus !== 'paid') return res.status(409).json({ error: 'Only paid bills can be refunded.' });

  const reason = text(req.body?.reason, 'Reason', { max: 500, multiline: true }) ?? '';
  if (reason.length < 3) return res.status(400).json({ error: 'Please give a reason for the refund.' });
  const rawAmount = req.body?.amount;
  if (rawAmount !== undefined && rawAmount !== '' && rawAmount !== null) {
    number(rawAmount, 'Refund amount', { min: 0, message: 'Refund amount must be a number.' });
  }

  const remainingC = toCents(order.total) - toCents(order.refund?.amount ?? 0);
  const amountC = req.body?.amount === undefined || req.body?.amount === '' ? remainingC : toCents(req.body.amount);
  if (!(amountC > 0 && amountC <= remainingC)) {
    return res.status(400).json({ error: `Refund must be between $0.01 and $${fromCents(remainingC).toFixed(2)}.` });
  }

  const totalRefundedC = toCents(order.refund?.amount ?? 0) + amountC;
  order.refund = { amount: fromCents(totalRefundedC), reason, at: iso(), by: req.user.id };
  if (totalRefundedC >= toCents(order.total)) {
    order.paymentStatus = 'refunded';
    const c = order.customerId ? customers.find((x) => x.id === order.customerId) : null;
    if (c && order.pointsEarned) c.loyaltyPoints = Math.max(0, c.loyaltyPoints - order.pointsEarned);
  }
  order.updatedAt = iso();
  res.json({ invoice: invoice(order) });
});

export default router;

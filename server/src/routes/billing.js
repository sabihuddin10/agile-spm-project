import { Router } from 'express';
import { orders, tables } from '../data/store.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();
const billingRoles = requireRole('waiter', 'manager', 'admin');

/** GET /api/billing — list bills (unpaid + paid orders with balance). */
router.get('/', billingRoles, (req, res) => {
  const list = orders
    .filter((o) => o.status !== 'cancelled')
    .map((o) => ({
      id: o.id,
      number: o.number,
      type: o.type,
      fulfillment: o.fulfillment ?? null,
      paymentMethod: o.paymentMethod ?? null,
      tableNumber: o.tableId ? tables.find((t) => t.id === o.tableId)?.number ?? null : null,
      status: o.status,
      subtotal: o.subtotal,
      tax: o.tax,
      discount: o.discount,
      pointsUsed: o.pointsUsed ?? 0,
      pointsEarned: o.pointsEarned ?? 0,
      total: o.total,
      paid: Boolean(o.paidAt),
      paidAt: o.paidAt,
      createdAt: o.createdAt,
    }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ bills: list });
});

/** GET /api/billing/:id — full invoice for an order. */
router.get('/:id', billingRoles, (req, res) => {
  const order = orders.find((o) => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  res.json({
    invoice: {
      id: order.id,
      number: order.number,
      fulfillment: order.fulfillment ?? null,
      paymentMethod: order.paymentMethod ?? null,
      tableNumber: order.tableId ? tables.find((t) => t.id === order.tableId)?.number ?? null : null,
      items: order.items,
      subtotal: order.subtotal,
      tax: order.tax,
      discount: order.discount,
      pointsUsed: order.pointsUsed ?? 0,
      pointsEarned: order.pointsEarned ?? 0,
      total: order.total,
      paid: Boolean(order.paidAt),
      paidAt: order.paidAt,
      createdAt: order.createdAt,
    },
  });
});

/** POST /api/billing/:id/pay — settle an order as paid. */
router.post('/:id/pay', billingRoles, (req, res) => {
  const order = orders.find((o) => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  if (order.status === 'paid') return res.json({ order, alreadyPaid: true });
  order.status = 'paid';
  order.paidAt = new Date().toISOString();
  order.updatedAt = new Date().toISOString();
  // Free the table once a dine-in order is paid.
  if (order.tableId) {
    const t = tables.find((x) => x.id === order.tableId);
    if (t) t.status = 'cleaning';
  }
  res.json({ order, alreadyPaid: false });
});

export default router;

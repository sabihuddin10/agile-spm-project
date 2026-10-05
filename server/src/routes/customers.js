import { Router } from 'express';
import { customers, orders, users, findCustomerByUserId, nextId } from '../data/store.js';
import { requireRole } from '../middleware/auth.js';
import { localDate } from '../lib/time.js';

const router = Router();

// Ledger endpoints are for floor staff and management.
// Self-service /me endpoints are available to the signed-in customer.
const staffOnly = requireRole('waiter', 'manager', 'admin');

const round2 = (n) => Math.round(n * 100) / 100;

/** Past orders for a customer, newest first (US1.4). */
function historyFor(customerId) {
  return orders
    .filter((o) => o.customerId === customerId && o.status !== 'cancelled')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((o) => ({
      id: o.id,
      number: o.number,
      date: localDate(new Date(o.createdAt)),
      createdAt: o.createdAt,
      total: o.total,
      items: o.items.map((i) => (i.qty > 1 ? `${i.qty}× ${i.name}` : i.name)),
      status: o.status,
      paymentStatus: o.paymentStatus,
      paymentMethod: o.paymentMethod,
      pointsEarned: o.pointsEarned,
      type: o.type,
      fulfillment: o.fulfillment,
      refundedAmount: o.refund?.amount ?? 0,
    }));
}

function serialize(customer) {
  const history = historyFor(customer.id);
  const totalSpend = history
    .filter((h) => h.paymentStatus !== 'unpaid')
    .reduce((sum, h) => sum + h.total - h.refundedAmount, 0);
  return { ...customer, orderHistory: history, orderCount: history.length, totalSpend: round2(totalSpend) };
}

function cleanList(value, fallback) {
  return Array.isArray(value) ? value.map((v) => String(v).trim().toLowerCase()).filter(Boolean) : fallback;
}

/** Auto-provision a ledger profile for a Customer-role user. */
function provisionForUser(user) {
  let customer = findCustomerByUserId(user.id);
  if (customer) return customer;
  customer = {
    id: nextId('cus'),
    userId: user.id,
    name: user.name,
    email: user.email,
    phone: '',
    type: 'online',
    loyaltyPoints: 0,
    preferences: { dietary: [], allergies: [] },
    notes: '',
    createdAt: new Date().toISOString(),
  };
  customers.push(customer);
  return customer;
}

/** GET /api/customers/me — the caller's own profile (self-service). */
router.get('/me', (req, res) => {
  const customer = findCustomerByUserId(req.user.id);
  if (!customer) {
    if (req.user.role !== 'customer') {
      return res.status(404).json({ error: 'No customer profile is linked to this account.' });
    }
    return res.status(201).json({ customer: serialize(provisionForUser(req.user)), provisioned: true });
  }
  return res.json({ customer: serialize(customer) });
});

/** PATCH /api/customers/me — edit the caller's own profile. */
router.patch('/me', (req, res) => {
  if (req.user.role !== 'customer') {
    return res.status(403).json({ error: 'Only customers have a self-service profile.' });
  }
  const customer = provisionForUser(req.user);
  const { name, email, phone, preferences, notes } = req.body || {};

  if (name !== undefined && !String(name).trim()) {
    return res.status(400).json({ error: 'Name cannot be empty.' });
  }
  if (email !== undefined) {
    const normalized = String(email).toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    if (users.some((u) => u.id !== req.user.id && u.email === normalized)) {
      return res.status(409).json({ error: 'That email is already used by another account.' });
    }
    customer.email = normalized;
    req.user.email = normalized;
  }
  if (name !== undefined) {
    customer.name = String(name).trim();
    req.user.name = customer.name;
  }
  if (phone !== undefined) customer.phone = String(phone);
  if (preferences !== undefined) {
    customer.preferences = {
      dietary: cleanList(preferences?.dietary, customer.preferences.dietary),
      allergies: cleanList(preferences?.allergies, customer.preferences.allergies),
    };
  }
  if (notes !== undefined) customer.notes = String(notes);

  return res.json({ customer: serialize(customer) });
});

/**
 * GET /api/customers — list the customer ledger with search + filters.
 * Query params: q (name/email/phone), type (walk-in|online), dietary, allergy
 */
router.get('/', staffOnly, (req, res) => {
  let result = [...customers];
  const { q, type, dietary, allergy } = req.query;

  if (q) {
    const needle = String(q).toLowerCase();
    result = result.filter((c) =>
      [c.name, c.email, c.phone].some((f) => String(f || '').toLowerCase().includes(needle)),
    );
  }
  if (type) result = result.filter((c) => c.type === type);
  if (dietary) result = result.filter((c) => (c.preferences.dietary || []).includes(dietary));
  if (allergy) result = result.filter((c) => (c.preferences.allergies || []).includes(allergy));

  result.sort((a, b) => a.name.localeCompare(b.name));
  return res.json({ customers: result.map(serialize) });
});

/** GET /api/customers/:id — single customer with order history. */
router.get('/:id', staffOnly, (req, res) => {
  const customer = customers.find((c) => c.id === req.params.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found.' });
  return res.json({ customer: serialize(customer) });
});

/** POST /api/customers — create a customer record. */
router.post('/', staffOnly, (req, res) => {
  const { name, email = '', phone = '', type = 'walk-in', preferences = {}, notes = '' } = req.body || {};

  if (!String(name || '').trim()) return res.status(400).json({ error: 'Customer name is required.' });

  const customer = {
    id: nextId('cus'),
    userId: null,
    name: String(name).trim(),
    email: String(email).trim(),
    phone: String(phone),
    type: ['walk-in', 'online'].includes(type) ? type : 'walk-in',
    loyaltyPoints: 0,
    preferences: {
      dietary: cleanList(preferences.dietary, []),
      allergies: cleanList(preferences.allergies, []),
    },
    notes: String(notes),
    createdAt: new Date().toISOString(),
  };
  customers.push(customer);

  return res.status(201).json({ customer: serialize(customer) });
});

/** PATCH /api/customers/:id — update a customer record. */
router.patch('/:id', staffOnly, (req, res) => {
  const customer = customers.find((c) => c.id === req.params.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found.' });

  const { name, email, phone, type, preferences, notes } = req.body || {};

  if (name !== undefined) {
    if (!String(name).trim()) return res.status(400).json({ error: 'Customer name is required.' });
    customer.name = String(name).trim();
  }
  if (email !== undefined) customer.email = String(email).trim();
  if (phone !== undefined) customer.phone = String(phone);
  if (type !== undefined && ['walk-in', 'online'].includes(type)) customer.type = type;
  if (preferences !== undefined) {
    customer.preferences = {
      dietary: cleanList(preferences?.dietary, customer.preferences.dietary),
      allergies: cleanList(preferences?.allergies, customer.preferences.allergies),
    };
  }
  if (notes !== undefined) customer.notes = String(notes);

  return res.json({ customer: serialize(customer) });
});

/** DELETE /api/customers/:id — remove a customer record (past orders are kept). */
router.delete('/:id', staffOnly, (req, res) => {
  const idx = customers.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Customer not found.' });
  const [removed] = customers.splice(idx, 1);
  return res.json({ deleted: true, id: removed.id });
});

export default router;

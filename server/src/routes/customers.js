import { Router } from 'express';
import {
  customers,
  customerOrderHistory,
  findCustomerByUserId,
  nextId,
} from '../data/store.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

// Ledger endpoints (list/create/get/patch/delete) are staff-only.
// Self-service /me endpoints are available to any authenticated user.
const staffOnly = requireRole('waiter', 'manager', 'admin');

/** Normalize a customer record for API output. */
function serialize(customer) {
  return {
    ...customer,
    orderHistory: customerOrderHistory[customer.id] || [],
    orderCount: (customerOrderHistory[customer.id] || []).length,
  };
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
    totalSpend: 0,
    preferences: { dietary: [], allergies: [] },
    notes: '',
    createdAt: new Date().toISOString(),
  };
  customerOrderHistory[customer.id] = [];
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
  let customer = findCustomerByUserId(req.user.id);
  if (!customer) {
    if (req.user.role !== 'customer') {
      return res.status(404).json({ error: 'No customer profile is linked to this account.' });
    }
    customer = provisionForUser(req.user);
  }

  const { name, email, phone, preferences, notes } = req.body || {};
  if (name !== undefined) customer.name = name;
  if (email !== undefined) customer.email = email;
  if (phone !== undefined) customer.phone = phone;
  if (preferences !== undefined) {
    customer.preferences = {
      dietary: Array.isArray(preferences.dietary) ? preferences.dietary : customer.preferences.dietary,
      allergies: Array.isArray(preferences.allergies) ? preferences.allergies : customer.preferences.allergies,
    };
  }
  if (notes !== undefined) customer.notes = notes;

  // Keep the linked auth user display data in sync.
  if (req.user && (name !== undefined || email !== undefined)) {
    if (name !== undefined) req.user.name = name;
    if (email !== undefined) req.user.email = email.toLowerCase().trim();
  }

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

  if (!name) return res.status(400).json({ error: 'Customer name is required.' });

  const customer = {
    id: nextId('cus'),
    userId: null,
    name,
    email,
    phone,
    type: ['walk-in', 'online'].includes(type) ? type : 'walk-in',
    loyaltyPoints: 0,
    totalSpend: 0,
    preferences: {
      dietary: preferences.dietary || [],
      allergies: preferences.allergies || [],
    },
    notes,
    createdAt: new Date().toISOString(),
  };
  customerOrderHistory[customer.id] = [];
  customers.push(customer);

  return res.status(201).json({ customer: serialize(customer) });
});

/** PATCH /api/customers/:id — update a customer record. */
router.patch('/:id', staffOnly, (req, res) => {
  const customer = customers.find((c) => c.id === req.params.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found.' });

  const { name, email, phone, type, preferences, notes } = req.body || {};

  if (name !== undefined) customer.name = name;
  if (email !== undefined) customer.email = email;
  if (phone !== undefined) customer.phone = phone;
  if (type !== undefined && ['walk-in', 'online'].includes(type)) customer.type = type;
  if (preferences !== undefined) {
    customer.preferences = {
      dietary: Array.isArray(preferences.dietary) ? preferences.dietary : customer.preferences.dietary,
      allergies: Array.isArray(preferences.allergies) ? preferences.allergies : customer.preferences.allergies,
    };
  }
  if (notes !== undefined) customer.notes = notes;

  return res.json({ customer: serialize(customer) });
});

/** DELETE /api/customers/:id — remove a customer record. */
router.delete('/:id', staffOnly, (req, res) => {
  const idx = customers.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Customer not found.' });
  const [removed] = customers.splice(idx, 1);
  delete customerOrderHistory[removed.id];
  return res.json({ deleted: true, id: removed.id });
});

export default router;

import { Router } from 'express';
import { customers, orders, users, findCustomerByUserId, nextId } from '../data/store.js';
import { requireRole } from '../middleware/auth.js';
import { localDate } from '../lib/time.js';
import { personName, email as readEmail, phone as readPhone, text, object, stringList, oneOf } from '../lib/validate.js';

const router = Router();

// Ledger endpoints are for floor staff and management.
// Self-service /me endpoints are available to the signed-in customer.
const staffOnly = requireRole('waiter', 'manager', 'admin');
// Deleting a customer record is a management decision.
const managerOnly = requireRole('manager', 'admin');

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

const NOTES_MAX = 500;

/** Validated { dietary, allergies } from a request; missing lists keep `current`. */
function readPreferences(raw, current) {
  const prefs = object(raw, 'Preferences');
  if (prefs === undefined) return undefined;
  return {
    dietary: stringList(prefs.dietary, 'Dietary preferences', { lower: true }) ?? current.dietary,
    allergies: stringList(prefs.allergies, 'Allergies', { lower: true }) ?? current.allergies,
  };
}

/**
 * Validate the editable ledger fields of a request body. Everything is checked
 * before anything is saved; fields that were not sent come back undefined.
 */
function readCustomerFields(body, current, { nameRequired }) {
  if (body.name !== undefined && (typeof body.name !== 'string' || !body.name.trim())) {
    return { error: nameRequired };
  }
  return {
    fields: {
      name: personName(body.name, 'Name', { required: false }),
      email: readEmail(body.email, { required: false }),
      phone: readPhone(body.phone),
      notes: text(body.notes, 'Notes', { max: NOTES_MAX, multiline: true }),
      preferences: readPreferences(body.preferences, current?.preferences ?? { dietary: [], allergies: [] }),
    },
  };
}

/** Copy the defined fields onto a customer record. */
function applyFields(customer, fields) {
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) customer[key] = value;
  }
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
  const current = findCustomerByUserId(req.user.id);
  const body = req.body || {};
  const { fields, error } = readCustomerFields(body, current, { nameRequired: 'Name cannot be empty.' });
  if (error) return res.status(400).json({ error });
  // A customer's sign-in email cannot be blank.
  if (body.email !== undefined && !fields.email) return res.status(400).json({ error: 'Please enter a valid email address.' });
  if (fields.email !== undefined && users.some((u) => u.id !== req.user.id && u.email === fields.email)) {
    return res.status(409).json({ error: 'That email is already used by another account.' });
  }

  const customer = provisionForUser(req.user);
  applyFields(customer, fields);
  if (fields.email !== undefined) req.user.email = fields.email;
  if (fields.name !== undefined) req.user.name = fields.name;

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
  const body = req.body || {};
  if (typeof body.name !== 'string' || !body.name.trim()) return res.status(400).json({ error: 'Customer name is required.' });
  const { fields } = readCustomerFields(body, null, { nameRequired: 'Customer name is required.' });
  const type = oneOf(body.type, 'Type', ['walk-in', 'online']) ?? 'walk-in';

  // id, userId, loyaltyPoints and createdAt are always set here, never taken from the body.
  const customer = {
    id: nextId('cus'),
    userId: null,
    name: fields.name,
    email: fields.email ?? '',
    phone: fields.phone ?? '',
    type,
    loyaltyPoints: 0,
    preferences: fields.preferences ?? { dietary: [], allergies: [] },
    notes: fields.notes ?? '',
    createdAt: new Date().toISOString(),
  };
  customers.push(customer);

  return res.status(201).json({ customer: serialize(customer) });
});

/** PATCH /api/customers/:id — update a customer record. */
router.patch('/:id', staffOnly, (req, res) => {
  const customer = customers.find((c) => c.id === req.params.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found.' });

  const body = req.body || {};
  const { fields, error } = readCustomerFields(body, customer, { nameRequired: 'Customer name is required.' });
  if (error) return res.status(400).json({ error });
  const type = oneOf(body.type, 'Type', ['walk-in', 'online']);

  applyFields(customer, fields);
  if (type !== undefined) customer.type = type;

  return res.json({ customer: serialize(customer) });
});

/** DELETE /api/customers/:id — remove a customer record (past orders are kept). */
router.delete('/:id', managerOnly, (req, res) => {
  const idx = customers.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Customer not found.' });
  // Orders keep their customer link, so a customer with history stays on the ledger.
  if (orders.some((o) => o.customerId === customers[idx].id)) {
    return res.status(409).json({ error: "This customer has order history and can't be deleted." });
  }
  const [removed] = customers.splice(idx, 1);
  return res.json({ deleted: true, id: removed.id });
});

export default router;

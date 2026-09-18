import { Router } from 'express';
import bcrypt from 'bcryptjs';
import {
  users,
  findUserByEmail,
  findUserById,
  createUser,
  sanitizeUser,
  customers,
  customerOrderHistory,
  nextId,
  ROLES,
} from '../data/store.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { signToken } from '../lib/jwt.js';

const router = Router();

/** POST /api/auth/register — create a Customer account (public). */
router.post('/register', (req, res) => {
  const { name, email, password } = req.body || {};

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are required.' });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }
  if (findUserByEmail(email)) {
    return res.status(409).json({ error: 'An account with that email already exists.' });
  }

  const user = createUser({ name, email, password, role: 'customer' });

  // A new signup gets a linked customer profile immediately (self-service).
  const profile = {
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
  customerOrderHistory[profile.id] = [];
  customers.push(profile);

  return res.status(201).json({ user: sanitizeUser(user), token: signToken(user) });
});

/** POST /api/auth/login — authenticate any role and return a JWT. */
router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = findUserByEmail(email);

  if (!user || !bcrypt.compareSync(String(password || ''), user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }
  if (!user.active) {
    return res.status(403).json({ error: 'This account has been deactivated.' });
  }

  return res.json({ user: sanitizeUser(user), token: signToken(user) });
});

/** GET /api/auth/me — current user (protected). */
router.get('/me', authenticate, (req, res) => {
  res.json({ user: sanitizeUser(req.user) });
});

/** GET /api/auth/roles — list the five stakeholder roles. */
router.get('/roles', (req, res) => {
  res.json({ roles: ROLES });
});

/** GET /api/auth/users — full user list (admin only). */
router.get('/users', requireAdmin, (req, res) => {
  res.json({ users: users.map(sanitizeUser) });
});

/** PATCH /api/auth/users/:id — change role / active status (admin only). */
router.patch('/users/:id', requireAdmin, (req, res) => {
  const user = findUserById(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  const { role, active } = req.body || {};
  if (role !== undefined) {
    if (!ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role.' });
    user.role = role;
  }
  if (active !== undefined) user.active = Boolean(active);

  return res.json({ user: sanitizeUser(user) });
});

export default router;

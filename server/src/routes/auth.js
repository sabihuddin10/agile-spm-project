import { Router } from 'express';
import bcrypt from 'bcryptjs';
import {
  users,
  findUserByEmail,
  findUserById,
  createUser,
  sanitizeUser,
  customers,
  nextId,
  ROLES,
} from '../data/store.js';
import { authenticate, requireRole, requireAdmin } from '../middleware/auth.js';
import { signToken } from '../lib/jwt.js';

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** POST /api/auth/register — create a Customer account (public). */
router.post('/register', (req, res) => {
  const { name, email, password } = req.body || {};

  if (!String(name || '').trim() || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are required.' });
  }
  if (!EMAIL_RE.test(String(email))) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }
  if (findUserByEmail(email)) {
    return res.status(409).json({ error: 'An account with that email already exists.' });
  }

  const user = createUser({ name, email, password: String(password), role: 'customer' });

  // A new signup gets a linked customer profile immediately (self-service).
  customers.push({
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
  });

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
    return res.status(403).json({ error: 'This account has been suspended. Please contact your manager.' });
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

/** GET /api/auth/users — full user list (Admin; Manager read-only). */
router.get('/users', authenticate, requireRole('manager', 'admin'), (req, res) => {
  res.json({ users: users.map(sanitizeUser) });
});

/** PATCH /api/auth/users/:id — change role / active status (admin only). */
router.patch('/users/:id', requireAdmin, (req, res) => {
  const user = findUserById(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  const { role, active } = req.body || {};
  const isSelf = user.id === req.user.id;

  if (role !== undefined) {
    if (!ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role.' });
    if (isSelf && role !== user.role) return res.status(400).json({ error: 'You cannot change your own role.' });
    user.role = role;
  }
  if (active !== undefined) {
    if (isSelf && !active) return res.status(400).json({ error: 'You cannot suspend your own account.' });
    user.active = Boolean(active);
  }

  return res.json({ user: sanitizeUser(user) });
});

/** DELETE /api/auth/users/:id — remove an account; access is revoked immediately (admin only). */
router.delete('/users/:id', requireAdmin, (req, res) => {
  const idx = users.findIndex((u) => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'User not found.' });
  if (users[idx].id === req.user.id) return res.status(400).json({ error: 'You cannot remove your own account.' });

  const [removed] = users.splice(idx, 1);
  for (const c of customers) if (c.userId === removed.id) c.userId = null;
  return res.json({ deleted: true, id: removed.id });
});

export default router;

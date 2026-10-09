import { Router } from 'express';
import crypto from 'node:crypto';
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
import { canManage, BELOW_RANK_ERROR } from '../lib/hierarchy.js';

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

/**
 * Validate a profile edit ({ name, email, phone }) for `user`. Returns
 * `{ changes }` or `{ status, error }`; nothing is applied here.
 */
function profileChanges(user, body) {
  const changes = {};
  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || !body.name.trim()) return { status: 400, error: 'Name is required.' };
    changes.name = body.name.trim();
  }
  if (body.email !== undefined) {
    const email = typeof body.email === 'string' ? body.email.toLowerCase().trim() : '';
    if (!EMAIL_RE.test(email)) return { status: 400, error: 'Please enter a valid email address.' };
    const owner = findUserByEmail(email);
    if (owner && owner.id !== user.id) return { status: 409, error: 'An account with that email already exists.' };
    if (email !== user.email) changes.email = email;
  }
  if (body.phone !== undefined) {
    const phone = typeof body.phone === 'string' ? body.phone.trim() : null;
    if (phone === null || phone.length > 30 || !/^[0-9+()\-.\s]*$/.test(phone)) {
      return { status: 400, error: 'Please enter a valid phone number.' };
    }
    changes.phone = phone;
  }
  return { changes };
}

// Wrong-password answers are 400, not 401: a 401 means "your session ended" to the client.
const passwordMatches = (user, password) => bcrypt.compareSync(String(password || ''), user.passwordHash);

/** PATCH /api/auth/me — staff edit their own name, email and phone. Changing the email (the login) needs the current password. */
router.patch('/me', authenticate, requireRole('waiter', 'chef', 'manager', 'admin'), (req, res) => {
  const body = req.body || {};
  const { changes, status, error } = profileChanges(req.user, body);
  if (error) return res.status(status).json({ error });
  if (changes.email && !passwordMatches(req.user, body.currentPassword)) {
    return res.status(400).json({ error: 'Enter your current password to change your email.' });
  }
  Object.assign(req.user, changes);
  return res.json({ user: sanitizeUser(req.user) });
});

/**
 * POST /api/auth/me/password — change your own password; other sessions are
 * signed out. Everyone confirms their current password except an admin, who
 * sets a new one directly.
 */
router.post('/me/password', authenticate, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (req.user.role !== 'admin' && !passwordMatches(req.user, currentPassword)) {
    return res.status(400).json({ error: 'Your current password is incorrect.' });
  }
  if (typeof newPassword !== 'string' || newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters.' });
  }
  if (passwordMatches(req.user, newPassword)) {
    return res.status(400).json({ error: 'Choose a password different from your current one.' });
  }
  req.user.passwordHash = bcrypt.hashSync(newPassword, 10);
  req.user.mustChangePassword = false;
  req.user.tokenVersion = (req.user.tokenVersion ?? 0) + 1;
  // A fresh token keeps this session signed in while older ones stop working.
  return res.json({ user: sanitizeUser(req.user), token: signToken(req.user) });
});

/** Load the target account and check the caller outranks it; responds and returns null otherwise. */
function managedTarget(req, res) {
  const target = findUserById(req.params.id);
  if (!target) {
    res.status(404).json({ error: 'User not found.' });
    return null;
  }
  if (!canManage(req.user, target)) {
    res.status(403).json({ error: BELOW_RANK_ERROR });
    return null;
  }
  return target;
}

/** PATCH /api/auth/users/:id/profile — a manager/admin edits the details of a staff account below their rank. */
router.patch('/users/:id/profile', authenticate, requireRole('manager', 'admin'), (req, res) => {
  const target = managedTarget(req, res);
  if (!target) return undefined;
  const { changes, status, error } = profileChanges(target, req.body || {});
  if (error) return res.status(status).json({ error });
  Object.assign(target, changes);
  return res.json({ user: sanitizeUser(target) });
});

/**
 * POST /api/auth/users/:id/reset-password — a manager/admin issues a one-time
 * temporary password for a staff account below their rank. The user must set
 * their own on next sign-in, and their existing sessions are signed out.
 */
router.post('/users/:id/reset-password', authenticate, requireRole('manager', 'admin'), (req, res) => {
  const target = managedTarget(req, res);
  if (!target) return undefined;
  const tempPassword = crypto.randomBytes(6).toString('base64url');
  target.passwordHash = bcrypt.hashSync(tempPassword, 10);
  target.mustChangePassword = true;
  target.tokenVersion = (target.tokenVersion ?? 0) + 1;
  return res.json({ user: sanitizeUser(target), tempPassword });
});

/**
 * POST /api/auth/users/:id/password — an admin types a new password for a staff
 * account below them (no old password needed). Their sessions are signed out.
 */
router.post('/users/:id/password', authenticate, requireRole('admin'), (req, res) => {
  const target = managedTarget(req, res);
  if (!target) return undefined;
  const { newPassword } = req.body || {};
  if (typeof newPassword !== 'string' || newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters.' });
  }
  target.passwordHash = bcrypt.hashSync(newPassword, 10);
  target.mustChangePassword = false;
  target.tokenVersion = (target.tokenVersion ?? 0) + 1;
  return res.json({ user: sanitizeUser(target) });
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
  // Admins manage the staff accounts below them (not other admins) and customer accounts.
  if (!isSelf && user.role !== 'customer' && !canManage(req.user, user)) return res.status(403).json({ error: BELOW_RANK_ERROR });

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
  if (users[idx].role !== 'customer' && !canManage(req.user, users[idx])) return res.status(403).json({ error: BELOW_RANK_ERROR });

  const [removed] = users.splice(idx, 1);
  for (const c of customers) if (c.userId === removed.id) c.userId = null;
  return res.json({ deleted: true, id: removed.id });
});

export default router;

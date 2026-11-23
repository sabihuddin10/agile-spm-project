import { Router } from 'express';
import {
  userDirectory,
  findUserByEmail,
  findUserById,
  sanitizeUser,
  ROLES,
} from '../data/store.js';
import { accounts } from '../domain/accounts.js';
import { AccountError } from '../domain/account-service.js';
import { authenticate, authenticateForAccountRecovery, revokeSession, requireRole, requireAdmin } from '../middleware/auth.js';
import { clearSession, protectSessionIssuance, setSession } from '../lib/session-cookie.js';
import { hashPassword, needsRehash, passwordMatches } from '../lib/passwords.js';
import { ASSIGNABLE_ROLES, canManage, BELOW_RANK_ERROR } from '../lib/hierarchy.js';
import { passwordError, generateTempPassword, PASSWORD_MAX } from '../lib/password-policy.js';
import { personName, email as readEmail, phone as readPhone, bool, oneOf, EMAIL_MAX } from '../lib/validate.js';

const router = Router();

/** POST /api/auth/register — create a Customer account (public). */
router.post('/register', protectSessionIssuance, (req, res) => {
  // Only these three fields are read: a "role" (or anything else) in the body is ignored.
  const body = req.body || {};
  if (!body.name || !body.email || !body.password) {
    return res.status(400).json({ error: 'Name, email and password are required.' });
  }
  const name = personName(body.name);
  const email = readEmail(body.email);
  const { password } = body;
  if (typeof password !== 'string') return res.status(400).json({ error: 'Password must be text.' });
  const weak = passwordError(password, { email, name });
  if (weak) return res.status(400).json({ error: weak });

  // A new signup gets a linked customer profile immediately (self-service); the account service does both.
  let user;
  try {
    user = accounts.registerCustomer({ name, email, password });
  } catch (err) {
    if (err instanceof AccountError && err.code === 'EMAIL_TAKEN') return res.status(409).json({ error: err.message });
    throw err;
  }

  setSession(res, user);
  return res.status(201).json({ user: sanitizeUser(user) });
});

/** POST /api/auth/login — authenticate any role and set a session cookie. */
router.post('/login', protectSessionIssuance, (req, res) => {
  // No password policy here: existing accounts (and the demo ones) keep signing in.
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string' || email.length > EMAIL_MAX || password.length > PASSWORD_MAX) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }
  const user = findUserByEmail(email);

  if (!passwordMatches(user, password) || !user) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }
  if (!user.active) {
    return res.status(403).json({ error: 'This account has been suspended. Please contact your manager.' });
  }
  // Upgrade an older hash to the current work factor now that the password is known to be right.
  if (needsRehash(user.passwordHash)) user.passwordHash = hashPassword(password);

  setSession(res, user);
  return res.json({ user: sanitizeUser(user) });
});

/** POST /api/auth/logout — revoke all sessions and expire the browser cookie. */
router.post('/logout', revokeSession, (req, res) => {
  clearSession(res);
  res.status(204).end();
});

/** GET /api/auth/me — current user (protected). */
router.get('/me', authenticateForAccountRecovery, (req, res) => {
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
    changes.name = personName(body.name);
  }
  if (body.email !== undefined) {
    const email = readEmail(body.email);
    const owner = findUserByEmail(email);
    if (owner && owner.id !== user.id) return { status: 409, error: 'An account with that email already exists.' };
    if (email !== user.email) changes.email = email;
  }
  if (body.phone !== undefined) {
    if (typeof body.phone !== 'string') return { status: 400, error: 'Please enter a valid phone number.' };
    changes.phone = readPhone(body.phone, 'Phone', { current: user.phone });
  }
  return { changes };
}

/** PATCH /api/auth/me — staff edit their own name, email and phone. Changing the email (the login) needs the current password. */
router.patch('/me', authenticate, requireRole('waiter', 'chef', 'manager', 'admin'), (req, res) => {
  const body = req.body || {};
  const { changes, status, error } = profileChanges(req.user, body);
  if (error) return res.status(status).json({ error });
  // The super admin role is bound to this email (store.js SUPERADMIN_EMAIL).
  if (changes.email && req.user.role === 'superadmin') {
    return res.status(403).json({ error: "The super admin's email is bound to the role and cannot be changed." });
  }
  if (changes.email && !passwordMatches(req.user, body.currentPassword)) {
    return res.status(400).json({ error: 'Enter your current password to change your email.' });
  }
  Object.assign(req.user, changes);
  return res.json({ user: sanitizeUser(req.user) });
});

/**
 * POST /api/auth/me/password — change your own password; other sessions are
 * signed out. Everyone confirms their current password.
 */
router.post('/me/password', authenticateForAccountRecovery, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!passwordMatches(req.user, currentPassword)) {
    return res.status(400).json({ error: 'Your current password is incorrect.' });
  }
  if (typeof newPassword !== 'string' || !newPassword) {
    return res.status(400).json({ error: 'Enter a new password.' });
  }
  if (passwordMatches(req.user, newPassword)) {
    return res.status(400).json({ error: 'Choose a password different from your current one.' });
  }
  const weak = passwordError(newPassword, req.user);
  if (weak) return res.status(400).json({ error: weak });
  req.user.passwordHash = hashPassword(newPassword);
  req.user.mustChangePassword = false;
  req.user.tokenVersion = (req.user.tokenVersion ?? 0) + 1;
  // A fresh token keeps this session signed in while older ones stop working.
  setSession(res, req.user);
  return res.json({ user: sanitizeUser(req.user) });
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
  const tempPassword = generateTempPassword();
  target.passwordHash = hashPassword(tempPassword);
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
  if (typeof newPassword !== 'string' || !newPassword) {
    return res.status(400).json({ error: 'Enter a new password.' });
  }
  const weak = passwordError(newPassword, target);
  if (weak) return res.status(400).json({ error: weak });
  target.passwordHash = hashPassword(newPassword);
  target.mustChangePassword = false;
  target.tokenVersion = (target.tokenVersion ?? 0) + 1;
  return res.json({ user: sanitizeUser(target) });
});

/** GET /api/auth/roles — list the five stakeholder roles and the super admin. */
router.get('/roles', (req, res) => {
  res.json({ roles: ROLES });
});

/** GET /api/auth/users — full user list (Admin; Manager read-only). */
router.get('/users', authenticate, requireRole('manager', 'admin'), (req, res) => {
  res.json({ users: userDirectory.all.map(sanitizeUser) });
});

/** PATCH /api/auth/users/:id — change role / active status (admin only). */
router.patch('/users/:id', requireAdmin, (req, res) => {
  const user = findUserById(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  const body = req.body || {};
  // The super admin role is bound to one account by scripts/superadmin.js, never assigned here.
  if (body.role === 'superadmin') {
    return res.status(403).json({ error: 'The super admin role is bound to one account and cannot be assigned.' });
  }
  const role = oneOf(body.role, 'Role', ASSIGNABLE_ROLES, { message: 'Invalid role.' });
  const active = bool(body.active, 'active');
  const isSelf = user.id === req.user.id;
  // Admins manage the staff accounts below them (not other admins) and customer accounts.
  if (!isSelf && user.role !== 'customer' && !canManage(req.user, user)) return res.status(403).json({ error: BELOW_RANK_ERROR });

  if (role !== undefined) {
    if (isSelf && role !== user.role) return res.status(400).json({ error: 'You cannot change your own role.' });
    user.role = role;
  }
  if (active !== undefined) {
    if (isSelf && !active) return res.status(400).json({ error: 'You cannot suspend your own account.' });
    if (user.active !== active) user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    user.active = active;
  }

  return res.json({ user: sanitizeUser(user) });
});

/** DELETE /api/auth/users/:id — remove an account; access is revoked immediately (admin only). */
router.delete('/users/:id', requireAdmin, (req, res) => {
  const target = findUserById(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found.' });
  if (target.id === req.user.id) return res.status(400).json({ error: 'You cannot remove your own account.' });
  if (target.role !== 'customer' && !canManage(req.user, target)) return res.status(403).json({ error: BELOW_RANK_ERROR });

  const removed = accounts.removeAccount(target.id);
  return res.json({ deleted: true, id: removed.id });
});

export default router;

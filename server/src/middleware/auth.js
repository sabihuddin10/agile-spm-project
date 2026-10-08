import { verifyToken } from '../lib/jwt.js';
import { findUserById } from '../data/store.js';

function userFromRequest(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return { error: 'Authentication required.' };
  const payload = verifyToken(token);
  if (!payload) return { error: 'Invalid or expired token.' };
  const user = findUserById(payload.sub);
  if (!user || !user.active) return { error: 'User not found or deactivated.' };
  // A password change or reset bumps the version, signing out older sessions.
  if ((payload.tv ?? 0) !== (user.tokenVersion ?? 0)) return { error: 'Your session has ended. Please sign in again.' };
  return { user };
}

/**
 * Attach the authenticated user (from the Bearer token) to req.user.
 * Responds 401 when the token is missing/invalid or the user is suspended or
 * removed — so suspension takes effect on the very next request (US9.4).
 */
export function authenticate(req, res, next) {
  const { user, error } = userFromRequest(req);
  if (!user) return res.status(401).json({ error });
  req.user = user;
  return next();
}

/** Attach req.user when a valid token is present; otherwise continue as a guest. */
export function optionalAuth(req, res, next) {
  const { user } = userFromRequest(req);
  if (user) req.user = user;
  return next();
}

/**
 * Role guard factory: allow only the listed roles. Must run after
 * `authenticate` or `optionalAuth`.
 */
export function requireRole(...allowedRoles) {
  const guard = (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to perform this action.' });
    }
    return next();
  };
  // Read by the API catalogue (lib/api-catalog.js) so documented roles come from the code.
  guard.allowedRoles = Object.freeze([...allowedRoles]);
  return guard;
}

/** Admin-only guard. */
export const requireAdmin = [authenticate, requireRole('admin')];

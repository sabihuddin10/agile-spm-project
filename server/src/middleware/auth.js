import { verifyToken } from '../lib/jwt.js';
import { findUserById, sanitizeUser, roleRank, ROLES } from '../data/store.js';

/**
 * Attach the authenticated user (from the Bearer token) to req.user.
 * Responds 401 when the token is missing/invalid or the user is inactive.
 */
export function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }

  const user = findUserById(payload.sub);
  if (!user || !user.active) {
    return res.status(401).json({ error: 'User not found or deactivated.' });
  }

  req.user = user;
  return next();
}

/**
 * Role guard factory. Restrict a route to one or more roles.
 * Order matters: `requireRole(...)` must run after `authenticate`.
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    const rank = roleRank(req.user.role);
    const allowed = allowedRoles.map(roleRank);
    const maxAllowed = Math.max(...allowed);
    if (rank < maxAllowed) {
      return res.status(403).json({ error: 'You do not have permission to perform this action.' });
    }
    return next();
  };
}

/** Convenience: any authenticated role. */
export const requireAuth = [authenticate];

/** Admin-only guard (highest rank). */
export const requireAdmin = [authenticate, requireRole('admin')];

export function attachUser(req, res, next) {
  res.locals.user = sanitizeUser(req.user);
  next();
}

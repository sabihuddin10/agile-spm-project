/**
 * Fixed-window rate limit for the public forms (table bookings, job
 * applications), which anyone can submit and which notify staff.
 *
 * Counts are kept in memory per client IP, so on serverless hosting each
 * instance counts on its own: this stops a single client hammering a form, it
 * is not a global quota. Signed-in staff are never limited.
 */
import { STAFF_ROLES } from '../data/store.js';

const MAX_KEYS = 5000;
const clientAddress = (req) => req.ip || req.socket?.remoteAddress || 'unknown';

export function rateLimit({
  limit, windowMs, message = 'Too many requests. Please try again later.',
  now = Date.now, keyFor = clientAddress, exemptStaff = true, failuresOnly = false,
} = {}) {
  const hits = new Map();

  return function limiter(req, res, next) {
    if (exemptStaff && req.user && STAFF_ROLES.includes(req.user.role)) return next();

    const time = now();
    const key = keyFor(req);
    if (!key) return next();
    let entry = hits.get(key);
    if (!entry || time >= entry.resetAt) {
      if (hits.size >= MAX_KEYS) {
        for (const [k, e] of hits) if (time >= e.resetAt) hits.delete(k);
        if (hits.size >= MAX_KEYS) {
          res.setHeader('Retry-After', String(Math.ceil(windowMs / 1000)));
          return res.status(429).json({ error: message });
        }
      }
      entry = { count: 0, resetAt: time + windowMs };
      hits.set(key, entry);
    }
    if (entry.count >= limit) {
      res.setHeader('Retry-After', String(Math.ceil((entry.resetAt - time) / 1000)));
      return res.status(429).json({ error: message });
    }
    entry.count += 1;
    if (failuresOnly) {
      res.once('finish', () => {
        if (res.statusCode !== 401 && res.statusCode !== 403) entry.count -= 1;
      });
    }
    return next();
  };
}

/** Limit only `POST <mount>/<path>`; every other request on the mount passes straight through. */
export function limitPost(path, limiter) {
  return (req, res, next) => {
    const requestPath = req.path.toLowerCase().replace(/\/$/, '') || '/';
    return req.method === 'POST' && requestPath === path ? limiter(req, res, next) : next();
  };
}

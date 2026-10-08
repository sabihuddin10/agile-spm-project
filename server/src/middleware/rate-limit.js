/**
 * Fixed-window rate limit for the public forms (table bookings, job
 * applications), which anyone can submit and which notify staff.
 *
 * Counts are kept in memory per client IP, so on serverless hosting each
 * instance counts on its own: this stops a single client hammering a form, it
 * is not a global quota. Signed-in staff are never limited.
 */
import { STAFF_ROLES } from '../data/store.js';

export function rateLimit({ limit, windowMs, message = 'Too many requests. Please try again later.', now = Date.now } = {}) {
  const hits = new Map();

  return function limiter(req, res, next) {
    if (req.user && STAFF_ROLES.includes(req.user.role)) return next();

    const time = now();
    const key = req.ip || req.socket?.remoteAddress || 'unknown';
    let entry = hits.get(key);
    if (!entry || time >= entry.resetAt) {
      entry = { count: 0, resetAt: time + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;

    // Drop expired windows now and then so the map can't grow without bound.
    if (hits.size > 5000) {
      for (const [k, e] of hits) if (time >= e.resetAt) hits.delete(k);
    }

    if (entry.count > limit) {
      res.setHeader('Retry-After', String(Math.ceil((entry.resetAt - time) / 1000)));
      return res.status(429).json({ error: message });
    }
    return next();
  };
}

/** Limit only `POST <mount>/<path>`; every other request on the mount passes straight through. */
export function limitPost(path, limiter) {
  return (req, res, next) => (req.method === 'POST' && req.path === path ? limiter(req, res, next) : next());
}

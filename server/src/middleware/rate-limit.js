/**
 * Fixed-window rate limit for sensitive endpoints: sign-in, registration, and the public forms (table
 * bookings, job applications), which anyone can submit and which notify staff.
 *
 * This file is the policy (what is limited, who is exempt, the responses). Where the counts live is the
 * store's business (lib/rate-limit-store.js): in production a PostgreSQL table every API instance shares,
 * so scaling out cannot multiply a client's quota; in development and tests, process memory.
 * Signed-in staff are never limited on the public forms.
 */
import { STAFF_ROLES } from '../data/store.js';
import { MemoryStore } from '../lib/rate-limit-store.js';

const clientAddress = (req) => req.ip || req.socket?.remoteAddress || 'unknown';

/** Seconds a client is told to wait when the limiter itself cannot reach its store. */
export const STORE_OUTAGE_RETRY_SECONDS = 5;
export const STORE_OUTAGE_MESSAGE = 'The service is temporarily unavailable. Please try again shortly.';

/**
 * @param {object} options
 * @param {number} options.limit            attempts allowed per window
 * @param {number} options.windowMs         window length
 * @param {string} [options.message]        the 429 message
 * @param {() => number} [options.now]      clock for the default in-memory store (tests)
 * @param {(req) => string | null} [options.keyFor]  what is counted; null skips the limit. Default: client address
 * @param {boolean} [options.exemptStaff]   signed-in staff are not limited (default true)
 * @param {boolean} [options.failuresOnly]  only 401/403 responses stay counted; a success gives the attempt back
 * @param {object} [options.store]          shared counters. Without one, a private in-memory store is used
 * @param {string} [options.name]           stable name of this limit across instances; REQUIRED with a shared store
 * @param {'deny' | 'allow'} [options.onStoreError]  when the store is unreachable: answer 503 (default, the safe
 *                                          choice for anything sensitive) or let the request through
 */
export function rateLimit({
  limit, windowMs, message = 'Too many requests. Please try again later.',
  now = Date.now, keyFor = clientAddress, exemptStaff = true, failuresOnly = false,
  store, name, onStoreError = 'deny',
} = {}) {
  if (store && !name) throw new Error('rateLimit: a shared store needs a stable "name" so every instance counts the same limit.');
  const namespace = name ?? 'default';
  const counters = store ?? new MemoryStore({ now });

  return function limiter(req, res, next) {
    if (exemptStaff && req.user && STAFF_ROLES.includes(req.user.role)) return next();
    const key = keyFor(req);
    if (!key) return next();

    const decide = (result) => {
      if (!result.allowed) {
        res.setHeader('Retry-After', String(result.retryAfterSeconds));
        return res.status(429).json({ error: message });
      }
      if (failuresOnly) {
        res.once('finish', () => {
          if (res.statusCode === 401 || res.statusCode === 403) return;
          // The attempt succeeded, so it does not count. Best effort: never let this surface as an error.
          Promise.resolve()
            .then(() => counters.refund({ namespace, key }))
            .catch((err) => console.error(`[rate-limit] could not give back a counted attempt (${namespace}): ${err?.message ?? err}`));
        });
      }
      return next();
    };

    const storeUnavailable = (err) => {
      // Observable, and never includes the counted key (an IP or an email).
      console.error(`[rate-limit] store unavailable for "${namespace}", ${onStoreError === 'allow' ? 'letting the request through' : 'refusing the request'}: ${err?.message ?? err}`);
      if (onStoreError === 'allow') return next();
      res.setHeader('Retry-After', String(STORE_OUTAGE_RETRY_SECONDS));
      return res.status(503).json({ error: STORE_OUTAGE_MESSAGE });
    };

    // The in-memory store answers synchronously, a shared store with a promise; both are handled.
    let outcome;
    try {
      outcome = counters.consume({ namespace, key, limit, windowMs });
    } catch (err) {
      return storeUnavailable(err);
    }
    if (outcome && typeof outcome.then === 'function') return outcome.then(decide, storeUnavailable);
    return decide(outcome);
  };
}

/** Limit only `POST <mount>/<path>`; every other request on the mount passes straight through. */
export function limitPost(path, limiter) {
  return (req, res, next) => {
    const requestPath = req.path.toLowerCase().replace(/\/$/, '') || '/';
    return req.method === 'POST' && requestPath === path ? limiter(req, res, next) : next();
  };
}

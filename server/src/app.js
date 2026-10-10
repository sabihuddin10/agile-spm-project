import express from 'express';
import cors from 'cors';
import morgan from 'morgan';

import authRoutes from './routes/auth.js';
import customerRoutes from './routes/customers.js';
import menuRoutes from './routes/menu.js';
import orderRoutes from './routes/orders.js';
import tableRoutes from './routes/tables.js';
import inventoryRoutes from './routes/inventory.js';
import reservationRoutes from './routes/reservations.js';
import billingRoutes from './routes/billing.js';
import analyticsRoutes from './routes/analytics.js';
import notificationRoutes from './routes/notifications.js';
import settingsRoutes from './routes/settings.js';
import staffRoutes from './routes/staff.js';
import attendanceRoutes from './routes/attendance.js';
import workforceRoutes from './routes/workforce.js';
import healthRoutes from './routes/health.js';
import { PROBE_HEADER } from './lib/health-probe.js';
import { authenticate, optionalAuth } from './middleware/auth.js';
import { rateLimit, limitPost } from './middleware/rate-limit.js';
import { persistState } from './data/persist.js';
import { hasUnsafeKeys, isPlainObject } from './lib/validate.js';

/**
 * `persistence` keeps the store in Postgres (on by default when DATABASE_URL is set);
 * `rateLimits` throttles the public booking and application forms.
 */
export function createApp({ logging = true, persistence = Boolean(process.env.DATABASE_URL), rateLimits = true } = {}) {
  const app = express();
  // Behind Vercel's proxy the client address is in X-Forwarded-For. Elsewhere the
  // header is client-controlled, so it is only trusted on Vercel.
  if (process.env.VERCEL) app.set('trust proxy', 1);

  app.use(cors());
  // The largest real body (a recipe or reorder form) is a few KB; 100 KB is generous.
  app.use(express.json({ limit: '100kb' }));
  app.use(guardInput);
  // The status page's own probes are not worth a log line each.
  if (logging) app.use(morgan('dev', { skip: (req) => req.headers[PROBE_HEADER] === '1' }));

  app.locals.persistence = persistence;

  // Health routes (status page, endpoint catalogue, live probes) stay above
  // persistence: they never open a transaction, and the probes they send back
  // through this app would otherwise queue behind their own request's lock.
  app.use('/api/health', healthRoutes);

  // Everything below the health check reads and writes the persisted store.
  if (persistence) app.use('/api', persistState());

  app.use('/api/auth', authRoutes);

  // Public reads (menu, settings, table numbers, booking availability, staff
  // applications) use optionalAuth; every mutation is role-guarded per route.
  app.use('/api/menu', optionalAuth, menuRoutes);
  app.use('/api/settings', optionalAuth, settingsRoutes);
  app.use('/api/tables', optionalAuth, tableRoutes);
  // Public forms notify staff, so guests get a per-IP limit (signed-in staff are exempt).
  const bookingLimit = rateLimits
    ? limitPost('/', rateLimit({ limit: 5, windowMs: 10 * 60_000, message: 'Too many booking requests. Please try again in a few minutes.' }))
    : (req, res, next) => next();
  const applicationLimit = rateLimits
    ? limitPost('/applications', rateLimit({ limit: 3, windowMs: 60 * 60_000, message: 'Too many applications from this connection. Please try again later.' }))
    : (req, res, next) => next();
  app.use('/api/reservations', optionalAuth, bookingLimit, reservationRoutes);
  app.use('/api/staff', optionalAuth, applicationLimit, staffRoutes);

  app.use('/api/customers', authenticate, customerRoutes);
  app.use('/api/orders', authenticate, orderRoutes);
  app.use('/api/inventory', authenticate, inventoryRoutes);
  app.use('/api/billing', authenticate, billingRoutes);
  app.use('/api/analytics', authenticate, analyticsRoutes);
  app.use('/api/notifications', authenticate, notificationRoutes);
  app.use('/api/attendance', authenticate, attendanceRoutes);
  app.use('/api/workforce', authenticate, workforceRoutes);

  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Malformed JSON body.' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request body is too large.' });
    // Validation errors thrown by lib/validate.js, and body-parser's other 4xx (bad charset, encoding).
    if (err.expose && err.status >= 400 && err.status < 500) return res.status(err.status).json({ error: err.message });
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

/**
 * Reject input shapes no route expects before any handler sees them: a JSON
 * body must be an object (not an array or a bare value), no key anywhere in it
 * may be __proto__ / constructor / prototype, and each query parameter must be
 * a single string (no ?a[]=1 arrays or ?a[b]=1 objects).
 */
function guardInput(req, res, next) {
  for (const [key, value] of Object.entries(req.query ?? {})) {
    if (typeof value !== 'string') return res.status(400).json({ error: `Query parameter "${key}" must be a single value.` });
  }
  const { body } = req;
  if (body === undefined || (isPlainObject(body) && Object.keys(body).length === 0)) return next();
  if (!isPlainObject(body)) return res.status(400).json({ error: 'Request body must be a JSON object.' });
  if (hasUnsafeKeys(body)) return res.status(400).json({ error: 'Request body contains a reserved key.' });
  return next();
}

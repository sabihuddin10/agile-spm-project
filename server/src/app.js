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
import { authenticate, optionalAuth } from './middleware/auth.js';
import { persistState } from './data/persist.js';

/** `persistence` keeps the store in Postgres; on by default when DATABASE_URL is set. */
export function createApp({ logging = true, persistence = Boolean(process.env.DATABASE_URL) } = {}) {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  if (logging) app.use(morgan('dev'));

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'restaurant-ops-api', time: new Date().toISOString() });
  });

  // Everything below the health check reads and writes the persisted store.
  if (persistence) app.use('/api', persistState());

  app.use('/api/auth', authRoutes);

  // Public reads (menu, settings, table numbers, booking availability, staff
  // applications) use optionalAuth; every mutation is role-guarded per route.
  app.use('/api/menu', optionalAuth, menuRoutes);
  app.use('/api/settings', optionalAuth, settingsRoutes);
  app.use('/api/tables', optionalAuth, tableRoutes);
  app.use('/api/reservations', optionalAuth, reservationRoutes);
  app.use('/api/staff', optionalAuth, staffRoutes);

  app.use('/api/customers', authenticate, customerRoutes);
  app.use('/api/orders', authenticate, orderRoutes);
  app.use('/api/inventory', authenticate, inventoryRoutes);
  app.use('/api/billing', authenticate, billingRoutes);
  app.use('/api/analytics', authenticate, analyticsRoutes);
  app.use('/api/notifications', authenticate, notificationRoutes);

  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Malformed JSON body.' });
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

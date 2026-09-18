import 'dotenv/config';
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
import { authenticate, requireRole } from './middleware/auth.js';
import { ROLES } from './data/store.js';

const app = express();
const PORT = Number(process.env.PORT) || 4000;

/* ------------------------------------------------------------- middleware */

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

/* ------------------------------------------------------------------ routes */

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'restaurant-ops-api', time: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);

// Customers: any authenticated user may access their own /me record;
// full ledger endpoints are guarded per-route to Waiter/Manager/Admin.
app.use('/api/customers', authenticate, customerRoutes);

// Menu: public read (storefront), mutations guarded per-route in menu.js
// to Chef/Manager/Admin.
app.use('/api/menu', menuRoutes);

// Orders: customers place/view their own; staff manage all.
app.use('/api/orders', authenticate, orderRoutes);

// Tables: staff.
app.use('/api/tables', authenticate, tableRoutes);

// Inventory.
app.use('/api/inventory', authenticate, inventoryRoutes);

// Reservations: public booking (POST), staff management, customer self-service.
app.use('/api/reservations', reservationRoutes);

// Billing.
app.use('/api/billing', authenticate, billingRoutes);

// Analytics.
app.use('/api/analytics', authenticate, analyticsRoutes);

/* -------------------------------------------------------------- error/404 */

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

/* ------------------------------------------------------------------ listen */

app.listen(PORT, () => {
  console.log(`[server] Restaurant Ops API listening on http://localhost:${PORT}`);
  console.log(`[server] Roles: ${ROLES.join(', ')}`);
});

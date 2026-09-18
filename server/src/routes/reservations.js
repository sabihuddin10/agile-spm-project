import { Router } from 'express';
import { reservations, reservationStatuses, tables, customers, nextId, findCustomerByUserId } from '../data/store.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();
const staffRoles = requireRole('waiter', 'manager', 'admin');

/** GET /api/reservations — list (staff) with filters. */
router.get('/', staffRoles, (req, res) => {
  const { status } = req.query;
  let result = [...reservations];
  if (status) result = result.filter((r) => r.status === status);
  result.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  res.json({ reservations: result });
});

/** GET /api/reservations/mine — customer's own bookings. */
router.get('/mine', authenticate, (req, res) => {
  if (req.user.role === 'customer') {
    const c = customers.find((x) => x.userId === req.user.id) ?? findCustomerByUserId(req.user.id);
    if (!c) return res.json({ reservations: [] });
    return res.json({ reservations: reservations.filter((r) => r.customerId === c.id) });
  }
  return res.json({ reservations: [] });
});

/** POST /api/reservations — create a booking (anyone; public booking). */
router.post('/', (req, res) => {
  const { customerName, email, phone, partySize, date, time, specialRequests = '', tableId = null } = req.body || {};

  const name = customerName || (req.user ? req.user.name : '');
  if (!name || !partySize || !date || !time) {
    return res.status(400).json({ error: 'Name, party size, date and time are required.' });
  }
  if (Number(partySize) > 12) {
    return res.status(400).json({ error: 'Max party size is 12 — please call the restaurant for larger groups.' });
  }

  let customerId = null;
  if (req.user && req.user.role === 'customer') {
    const c = customers.find((x) => x.userId === req.user.id) ?? findCustomerByUserId(req.user.id);
    customerId = c ? c.id : null;
  }

  if (tableId && !tables.some((t) => t.id === tableId)) {
    return res.status(400).json({ error: 'Unknown table.' });
  }

  const reservation = {
    id: nextId('res'),
    customerName: name,
    email: email || (req.user ? req.user.email : ''),
    phone: phone || '',
    partySize: Number(partySize),
    date,
    time,
    tableId,
    status: 'pending',
    specialRequests,
    customerId,
    createdAt: new Date().toISOString(),
  };
  reservations.push(reservation);
  return res.status(201).json({ reservation });
});

/** PATCH /api/reservations/:id — confirm/seat/cancel (staff). */
router.patch('/:id', staffRoles, (req, res) => {
  const reservation = reservations.find((r) => r.id === req.params.id);
  if (!reservation) return res.status(404).json({ error: 'Reservation not found.' });
  const { status, tableId, partySize, time, date } = req.body || {};
  if (status !== undefined) {
    if (!reservationStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status.' });
    reservation.status = status;
    if (status === 'seated' && tableId) reservation.tableId = tableId;
  }
  if (tableId !== undefined) reservation.tableId = tableId;
  if (partySize !== undefined) reservation.partySize = Number(partySize);
  if (time !== undefined) reservation.time = time;
  if (date !== undefined) reservation.date = date;
  return res.json({ reservation });
});

/** DELETE /api/reservations/:id — cancel (staff or owner). */
router.delete('/:id', (req, res) => {
  const idx = reservations.findIndex((r) => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Reservation not found.' });
  const r = reservations[idx];
  if (req.user && req.user.role === 'customer') {
    const c = customers.find((x) => x.userId === req.user.id) ?? findCustomerByUserId(req.user.id);
    if (!c || r.customerId !== c.id) return res.status(403).json({ error: 'Not allowed.' });
  }
  const [removed] = reservations.splice(idx, 1);
  return res.json({ deleted: true, id: removed.id });
});

export default router;

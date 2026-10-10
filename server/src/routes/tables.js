import { Router } from 'express';
import { tables, tableStatuses, orders, reservations, users, ZONES, nextId } from '../data/store.js';
import { requireRole } from '../middleware/auth.js';
import { isActive, userName } from '../lib/orders.js';
import { syncTableHolds, isLate } from '../lib/reservations.js';
import { localDate } from '../lib/time.js';
import { text, number, bool } from '../lib/validate.js';

const router = Router();
const FLOOR_STAFF = ['waiter', 'manager', 'admin'];
const floorRoles = requireRole(...FLOOR_STAFF);
const managerRoles = requireRole('manager', 'admin');
const LAYOUT_FIELDS = ['number', 'seats', 'zone'];
const ZONE_MAX = 40;

const readTableNumber = (value) =>
  number(value, 'Table number', { min: 1, max: 9999, integer: true, message: 'Table number must be a positive whole number.' });
const readSeats = (value) => number(value, 'Seats', { min: 1, max: 20, message: 'Seats must be between 1 and 20.' });
const readZone = (value) => {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !value.trim()) return text('', 'Zone', { required: true });
  return text(value, 'Zone', { max: ZONE_MAX });
};

/** Floor-plan view of a table: live orders and today's next booking. */
function serialize(table) {
  const today = localDate();
  const activeOrders = orders
    .filter((o) => o.tableId === table.id && isActive(o))
    .map((o) => ({ id: o.id, number: o.number, status: o.status, total: o.total, paymentStatus: o.paymentStatus }));
  const nextBooking = reservations
    .filter((r) => r.tableId === table.id && r.date === today && ['requested', 'confirmed'].includes(r.status))
    .sort((a, b) => a.time.localeCompare(b.time))[0];
  return {
    ...table,
    waiterName: userName(table.waiterId),
    activeOrders,
    nextReservation: nextBooking
      ? { id: nextBooking.id, customerName: nextBooking.customerName, time: nextBooking.time, partySize: nextBooking.partySize, status: nextBooking.status, late: isLate(nextBooking) }
      : null,
  };
}

const sorted = () => tables.slice().sort((a, b) => a.number - b.number);

/** GET /api/tables/public — table numbers for customers ordering at their table. */
router.get('/public', (req, res) => {
  res.json({ tables: sorted().map(({ id, number, seats, zone }) => ({ id, number, seats, zone })) });
});

/** GET /api/tables — live floor plan (US6.2). */
router.get('/', floorRoles, (req, res) => {
  syncTableHolds();
  const zones = [...new Set([...ZONES, ...tables.map((t) => t.zone)])];
  res.json({ tables: sorted().map(serialize), zones, statuses: tableStatuses });
});

/** POST /api/tables — add a table to the floor plan (US6.1). */
router.post('/', managerRoles, (req, res) => {
  const body = req.body || {};
  const n = readTableNumber(body.number ?? '');
  const seats = readSeats(body.seats ?? 4);
  const zone = readZone(body.zone ?? ZONES[0]);
  if (tables.some((t) => t.number === n)) return res.status(409).json({ error: 'A table with that number already exists.' });

  const table = { id: nextId('tab'), number: n, seats, zone, status: 'free', waiterId: null, held: false, reservedFor: null };
  tables.push(table);
  return res.status(201).json({ table: serialize(table) });
});

/**
 * PATCH /api/tables/:id — floor staff change status, waiter and hold;
 * managers also edit number, seats and zone.
 */
router.patch('/:id', floorRoles, (req, res) => {
  const table = tables.find((t) => t.id === req.params.id);
  if (!table) return res.status(404).json({ error: 'Table not found.' });
  const body = req.body || {};

  if (LAYOUT_FIELDS.some((k) => body[k] !== undefined) && !['manager', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Only managers can change the floor layout.' });
  }

  const { status, waiterId } = body;
  // Validate every field before changing anything.
  const n = body.number === undefined ? undefined : readTableNumber(body.number);
  const seats = body.seats === undefined ? undefined : readSeats(body.seats);
  const zone = readZone(body.zone);
  const held = bool(body.held, 'held');
  if (status !== undefined && !tableStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status.' });
  if (waiterId !== undefined && waiterId !== null && typeof waiterId !== 'string') return res.status(400).json({ error: 'Unknown staff member.' });
  if (n !== undefined && tables.some((t) => t.id !== table.id && t.number === n)) {
    return res.status(409).json({ error: 'A table with that number already exists.' });
  }

  if (n !== undefined) table.number = n;
  if (seats !== undefined) table.seats = seats;
  if (zone !== undefined) table.zone = zone;
  if (status !== undefined) {
    table.status = status;
    if (status !== 'reserved') table.reservedFor = null;
    if (status === 'free') table.waiterId = null;
  }
  if (waiterId !== undefined) {
    if (waiterId && !users.some((u) => u.id === waiterId && u.role !== 'customer')) {
      return res.status(400).json({ error: 'Unknown staff member.' });
    }
    if (waiterId && !users.some((u) => u.id === waiterId && FLOOR_STAFF.includes(u.role) && u.active)) {
      return res.status(400).json({ error: 'Only active floor staff (waiters and managers) can look after a table.' });
    }
    table.waiterId = waiterId || null;
  }
  if (held !== undefined) table.held = held;

  return res.json({ table: serialize(table) });
});

/** DELETE /api/tables/:id — remove a table (manager/admin). */
router.delete('/:id', managerRoles, (req, res) => {
  const idx = tables.findIndex((t) => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Table not found.' });
  if (orders.some((o) => o.tableId === tables[idx].id && isActive(o))) {
    return res.status(409).json({ error: 'This table has active orders.' });
  }
  const [removed] = tables.splice(idx, 1);
  return res.json({ deleted: true, id: removed.id });
});

export default router;

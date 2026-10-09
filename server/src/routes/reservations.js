import { Router } from 'express';
import { reservations, reservationStatuses, tables, customers, findCustomerByUserId, nextId, TIME_SLOTS, settings } from '../data/store.js';
import { requireRole } from '../middleware/auth.js';
import { availability, canAccommodate, suggestAlternatives, syncTableHolds, releaseHold, isLate } from '../lib/reservations.js';
import { occupyTable } from '../lib/orders.js';
import { notify } from '../lib/notify.js';
import { combine, isValidDate, isValidTime, localDate, iso } from '../lib/time.js';
import { personName, email as readEmail, phone as readPhone, text, id } from '../lib/validate.js';

const router = Router();
const staffRoles = requireRole('waiter', 'manager', 'admin');
const MAX_PARTY = 12;
const REQUESTS_MAX = 500;

function serialize(r) {
  const c = r.customerId ? customers.find((x) => x.id === r.customerId) : null;
  return {
    ...r,
    tableNumber: r.tableId ? tables.find((t) => t.id === r.tableId)?.number ?? null : null,
    late: isLate(r),
    hasAccount: Boolean(c?.userId),
  };
}

function ownReservation(r, user) {
  if (!user || user.role !== 'customer') return false;
  const c = findCustomerByUserId(user.id);
  return Boolean(c && r.customerId === c.id);
}

/** Tell the guest their booking is confirmed — in-app if they have an account, plus an email log (US7.2). */
function notifyConfirmed(r) {
  const c = r.customerId ? customers.find((x) => x.id === r.customerId) : null;
  const message = `Your table for ${r.partySize} on ${r.date} at ${r.time} is confirmed. See you soon!`;
  if (c?.userId) {
    notify({ userId: c.userId, type: 'reservation_confirmed', title: 'Booking confirmed', message, link: '/account', reservationId: r.id });
  }
  if (r.email) {
    notify({ channel: 'email', to: r.email, type: 'reservation_confirmed', title: `${settings.restaurantName}: booking confirmed`, message, reservationId: r.id });
  }
  r.notifiedAt = iso();
}

function cancel(r) {
  r.status = 'cancelled';
  r.cancelledAt = iso();
  releaseHold(r);
}

/** GET /api/reservations/availability?date=&partySize= — open time slots (public). */
router.get('/availability', (req, res) => {
  const { date } = req.query;
  const partySize = Math.min(Math.max(Math.floor(Number(req.query.partySize)) || 2, 1), 100);
  if (!isValidDate(date)) return res.status(400).json({ error: 'A valid date is required.' });
  res.json({ date, partySize, slots: availability(date, partySize) });
});

/**
 * GET /api/reservations — reservation book (staff).
 * scope=upcoming (today onward, default) | past | all · status=...
 */
router.get('/', staffRoles, (req, res) => {
  syncTableHolds();
  const { status, scope = 'upcoming' } = req.query;
  const today = localDate();
  let result = [...reservations];
  if (scope === 'upcoming') result = result.filter((r) => r.date >= today);
  if (scope === 'past') result = result.filter((r) => r.date < today);
  if (status) result = result.filter((r) => r.status === status);
  result.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  if (scope === 'past' || scope === 'all') result = result.reverse().slice(0, 150);
  res.json({ reservations: result.map(serialize), slots: TIME_SLOTS });
});

/** GET /api/reservations/mine — the signed-in customer's bookings. */
router.get('/mine', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
  if (req.user.role !== 'customer') return res.json({ reservations: [] });
  const c = findCustomerByUserId(req.user.id);
  if (!c) return res.json({ reservations: [] });
  const mine = reservations
    .filter((r) => r.customerId === c.id)
    .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  return res.json({ reservations: mine.map(serialize) });
});

/**
 * POST /api/reservations — request a booking (guests and customers, US7.1).
 * Fully booked slots are rejected with up to three alternative slots.
 */
router.post('/', (req, res) => {
  const body = req.body || {};
  const { partySize, date, time } = body;
  const user = req.user && req.user.role === 'customer' ? req.user : null;

  const name = personName(body.customerName || undefined, 'Name', { required: false }) || user?.name || '';
  const rawContact = body.email || undefined;
  const contact = rawContact === undefined ? user?.email || '' : readEmail(rawContact);
  const phone = readPhone(body.phone) ?? '';
  const specialRequests = text(body.specialRequests, 'Special requests', { max: REQUESTS_MAX, multiline: true }) ?? '';
  const size = typeof partySize === 'number' || (typeof partySize === 'string' && partySize.trim()) ? Number(partySize) : NaN;

  if (!name || !contact || !partySize || !date || !time) {
    return res.status(400).json({ error: 'Name, email, party size, date and time are required.' });
  }
  if (!Number.isInteger(size) || size < 1) return res.status(400).json({ error: 'Party size must be at least 1.' });
  if (size > MAX_PARTY) {
    return res.status(400).json({ error: `Max party size is ${MAX_PARTY} — please call the restaurant for larger groups.` });
  }
  if (!isValidDate(date) || !isValidTime(time)) return res.status(400).json({ error: 'Please choose a valid date and time.' });
  if (combine(date, time).getTime() < Date.now()) return res.status(400).json({ error: 'That time has already passed.' });

  if (!canAccommodate({ date, time, partySize: size })) {
    return res.status(409).json({
      error: `Sorry — ${time} on ${date} is fully booked for a party of ${size}.`,
      alternatives: suggestAlternatives(date, time, size),
    });
  }

  const linked = user ? findCustomerByUserId(user.id) : null;
  const reservation = {
    id: nextId('res'),
    customerName: name,
    email: contact,
    phone,
    partySize: size,
    date,
    time,
    tableId: null,
    status: 'requested',
    specialRequests,
    customerId: linked?.id ?? null,
    createdAt: iso(),
    confirmedAt: null,
    seatedAt: null,
    cancelledAt: null,
    notifiedAt: null,
  };
  reservations.push(reservation);

  for (const role of ['manager', 'waiter']) {
    notify({
      role,
      type: 'reservation_requested',
      title: 'New booking request',
      message: `${name} · ${size} guests · ${date} at ${time}`,
      link: '/staff/reservations',
      reservationId: reservation.id,
    });
  }

  return res.status(201).json({ reservation: serialize(reservation) });
});

/**
 * PATCH /api/reservations/:id — staff manage status, table and details
 * (US7.2–US7.4).
 */
router.patch('/:id', staffRoles, (req, res) => {
  const r = reservations.find((x) => x.id === req.params.id);
  if (!r) return res.status(404).json({ error: 'Reservation not found.' });
  const { status, partySize, date, time } = req.body || {};
  const tableId = id(req.body?.tableId, 'Table', { nullable: true });
  const specialRequests = text(req.body?.specialRequests, 'Special requests', { max: REQUESTS_MAX, multiline: true });
  const sizeValue = typeof partySize === 'number' || (typeof partySize === 'string' && partySize.trim()) ? Number(partySize) : NaN;

  const next = {
    date: date ?? r.date,
    time: time ?? r.time,
    partySize: partySize !== undefined ? sizeValue : r.partySize,
    tableId: tableId !== undefined ? tableId : r.tableId,
  };
  if (!isValidDate(next.date) || !isValidTime(next.time)) return res.status(400).json({ error: 'Please choose a valid date and time.' });
  if (!(Number.isInteger(next.partySize) && next.partySize >= 1 && next.partySize <= MAX_PARTY)) {
    return res.status(400).json({ error: `Party size must be between 1 and ${MAX_PARTY}.` });
  }
  if (next.tableId) {
    const table = tables.find((t) => t.id === next.tableId);
    if (!table) return res.status(400).json({ error: 'Unknown table.' });
    if (table.seats < next.partySize) {
      return res.status(400).json({ error: `Table ${table.number} seats ${table.seats} — too small for ${next.partySize}.` });
    }
  }
  const detailsChanged = ['date', 'time', 'partySize', 'tableId'].some((k) => next[k] !== r[k]);
  if (detailsChanged && ['requested', 'confirmed'].includes(r.status) && !canAccommodate(next, r.id)) {
    return res.status(409).json({ error: 'That table or time is already booked.' });
  }

  if (status !== undefined) {
    if (!reservationStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status.' });
    if (status === 'confirmed' && r.status !== 'requested') {
      return res.status(409).json({ error: 'Only requested bookings can be confirmed.' });
    }
    if (status === 'seated' && r.status !== 'confirmed') {
      return res.status(409).json({ error: 'Confirm the booking before seating the party.' });
    }
    if (status === 'no_show') {
      if (r.status !== 'confirmed') return res.status(409).json({ error: 'Only confirmed bookings can be marked no-show.' });
      if (!isLate(r)) {
        return res.status(409).json({ error: `The ${settings.reservationGraceMinutes}-minute grace period has not passed yet.` });
      }
    }
  }

  if (r.tableId && r.tableId !== next.tableId) releaseHold(r);
  Object.assign(r, next);
  if (specialRequests !== undefined) r.specialRequests = specialRequests;

  if (status !== undefined && status !== r.status) {
    if (status === 'confirmed') {
      r.status = 'confirmed';
      r.confirmedAt = iso();
      notifyConfirmed(r);
    } else if (status === 'seated') {
      r.status = 'seated';
      r.seatedAt = iso();
      if (r.tableId) occupyTable(r.tableId, req.user.role === 'waiter' ? req.user.id : null);
    } else if (status === 'cancelled') {
      cancel(r);
    } else if (status === 'no_show') {
      r.status = 'no_show';
      releaseHold(r);
    } else {
      r.status = status;
    }
  }

  syncTableHolds();
  return res.json({ reservation: serialize(r) });
});

/** POST /api/reservations/:id/cancel — staff, or the customer who made it (US7.4). */
router.post('/:id/cancel', (req, res) => {
  const r = reservations.find((x) => x.id === req.params.id);
  if (!r) return res.status(404).json({ error: 'Reservation not found.' });
  const staff = req.user && ['waiter', 'manager', 'admin'].includes(req.user.role);
  if (!staff && !ownReservation(r, req.user)) {
    return res.status(req.user ? 403 : 401).json({ error: req.user ? 'Not allowed.' : 'Authentication required.' });
  }
  if (!['requested', 'confirmed'].includes(r.status)) {
    return res.status(409).json({ error: 'This booking can no longer be cancelled.' });
  }
  cancel(r);
  syncTableHolds();
  return res.json({ reservation: serialize(r) });
});

export default router;

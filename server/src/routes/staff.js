import { Router } from 'express';

import { users, applications, shifts, orders, STAFF_ROLES, createUser, findUserByEmail, sanitizeUser, nextId } from '../data/store.js';
import { requireRole } from '../middleware/auth.js';
import { notify } from '../lib/notify.js';
import { MINUTE, addDays, combine, isValidDate, isValidTime, localDate, iso } from '../lib/time.js';
import { toCents, fromCents } from '../lib/order-math.js';
import { generateTempPassword } from '../lib/password-policy.js';
import { personName, email as readEmail, phone as readPhone, text, oneOf, id } from '../lib/validate.js';

const router = Router();
const managerRoles = requireRole('manager', 'admin');
const staffRoles = requireRole(...STAFF_ROLES);


const nameOf = (userId) => users.find((u) => u.id === userId)?.name ?? 'Former staff';
const shiftHours = (s) => (combine(s.date, s.end) - combine(s.date, s.start)) / (60 * MINUTE);

function serializeShift(s) {
  const u = users.find((x) => x.id === s.userId);
  return { ...s, userName: u?.name ?? 'Former staff', role: u?.role ?? null, hours: Math.round(shiftHours(s) * 10) / 10 };
}

function rangeFromQuery(query, defaultFrom, defaultTo) {
  const from = isValidDate(query.from) ? query.from : defaultFrom;
  const to = isValidDate(query.to) ? query.to : defaultTo;
  return { from, to };
}

/* ---------------------------------------------------------------- roster */

/** GET /api/staff/roster — active and suspended staff accounts (manager/admin). */
router.get('/roster', managerRoles, (req, res) => {
  res.json({ staff: users.filter((u) => STAFF_ROLES.includes(u.role)).map(sanitizeUser) });
});

/* ---------------------------------------------------------- applications */

/** POST /api/staff/applications — public "join our team" form (US9.1). */
router.post('/applications', (req, res) => {
  const body = req.body || {};
  if (!body.name || !body.email) return res.status(400).json({ error: 'Name and email are required.' });
  const name = personName(body.name);
  const cleanEmail = readEmail(body.email);
  const phone = readPhone(body.phone) ?? '';
  const desiredRole = oneOf(body.desiredRole, 'Role', ['waiter', 'chef'], { required: true, message: 'Choose the role you are applying for.' });
  const experience = text(body.experience, 'Experience', { max: 1000, multiline: true }) ?? '';
  if (findUserByEmail(cleanEmail)) return res.status(409).json({ error: 'An account with that email already exists.' });
  if (applications.some((a) => a.email === cleanEmail && a.status === 'pending')) {
    return res.status(409).json({ error: 'You already have an application under review.' });
  }

  const application = {
    id: nextId('app'),
    name,
    email: cleanEmail,
    phone,
    desiredRole,
    experience,
    status: 'pending',
    createdAt: iso(),
    decidedAt: null,
    decidedBy: null,
    userId: null,
  };
  applications.push(application);
  notify({ role: 'manager', type: 'application', title: 'New staff application', message: `${application.name} applied to join as a ${desiredRole}.`, link: '/staff/users#applications' });
  notify({ role: 'admin', type: 'application', title: 'New staff application', message: `${application.name} applied to join as a ${desiredRole}.`, link: '/staff/users#applications' });
  return res.status(201).json({ application });
});

/** GET /api/staff/applications — review queue (manager/admin). */
router.get('/applications', managerRoles, (req, res) => {
  const list = applications
    .filter((a) => !req.query.status || a.status === req.query.status)
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((a) => ({ ...a, decidedByName: a.decidedBy ? nameOf(a.decidedBy) : null }));
  res.json({ applications: list });
});

/**
 * POST /api/staff/applications/:id/approve — create the staff account with the
 * approved role and a temporary password. Managers may approve waiters and
 * chefs; admins may also approve managers.
 */
router.post('/applications/:id/approve', managerRoles, (req, res) => {
  const application = applications.find((a) => a.id === req.params.id);
  if (!application) return res.status(404).json({ error: 'Application not found.' });
  if (application.status !== 'pending') return res.status(409).json({ error: `Application already ${application.status}.` });

  const role = oneOf(req.body?.role, 'Role', ['waiter', 'chef', 'manager', 'admin', 'customer'], { message: 'Invalid role.' }) || application.desiredRole;
  const allowed = req.user.role === 'admin' ? ['waiter', 'chef', 'manager'] : ['waiter', 'chef'];
  if (!allowed.includes(role)) return res.status(403).json({ error: `You cannot approve staff as ${role}.` });
  if (findUserByEmail(application.email)) return res.status(409).json({ error: 'An account with that email already exists.' });

  const tempPassword = generateTempPassword();
  const user = createUser({ name: application.name, email: application.email, password: tempPassword, role, mustChangePassword: true });
  Object.assign(application, { status: 'approved', decidedAt: iso(), decidedBy: req.user.id, userId: user.id, approvedRole: role });
  return res.json({ application, user: sanitizeUser(user), tempPassword });
});

/** POST /api/staff/applications/:id/reject */
router.post('/applications/:id/reject', managerRoles, (req, res) => {
  const application = applications.find((a) => a.id === req.params.id);
  if (!application) return res.status(404).json({ error: 'Application not found.' });
  if (application.status !== 'pending') return res.status(409).json({ error: `Application already ${application.status}.` });
  Object.assign(application, { status: 'rejected', decidedAt: iso(), decidedBy: req.user.id });
  return res.json({ application });
});

/* ---------------------------------------------------------------- shifts */

/** GET /api/staff/shifts/mine — the signed-in staff member's schedule (US9.3). */
router.get('/shifts/mine', staffRoles, (req, res) => {
  const { from, to } = rangeFromQuery(req.query, localDate(addDays(new Date(), -7)), localDate(addDays(new Date(), 14)));
  const mine = shifts
    .filter((s) => s.userId === req.user.id && s.date >= from && s.date <= to)
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  res.json({ shifts: mine.map(serializeShift), from, to });
});

/** GET /api/staff/shifts — full rota (manager/admin). */
router.get('/shifts', managerRoles, (req, res) => {
  const { from, to } = rangeFromQuery(req.query, localDate(), localDate(addDays(new Date(), 6)));
  const list = shifts
    .filter((s) => s.date >= from && s.date <= to && (!req.query.userId || s.userId === req.query.userId))
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  res.json({ shifts: list.map(serializeShift), from, to });
});

function validateShift({ userId, date, start, end }, excludeId) {
  const user = users.find((u) => u.id === userId);
  if (!user || !STAFF_ROLES.includes(user.role)) return 'Choose a staff member.';
  if (!user.active) return `${user.name} is suspended.`;
  if (!isValidDate(date)) return 'Choose a valid date.';
  if (!isValidTime(start) || !isValidTime(end)) return 'Choose valid start and end times.';
  if (start >= end) return 'The shift must end after it starts.';
  const clash = shifts.find((s) => s.id !== excludeId && s.userId === userId && s.date === date && s.start < end && start < s.end);
  if (clash) return `${user.name} already has a shift ${clash.start}–${clash.end} that day.`;
  return null;
}

/** POST /api/staff/shifts — assign a shift (manager/admin). */
router.post('/shifts', managerRoles, (req, res) => {
  const { userId, date, start, end } = req.body || {};
  const notes = text(req.body?.notes, 'Notes', { max: 500, multiline: true }) ?? '';
  const error = validateShift({ userId, date, start, end });
  if (error) return res.status(400).json({ error });
  const shift = { id: nextId('shf'), userId, date, start, end, notes, status: 'scheduled', createdBy: req.user.id, createdAt: iso() };
  shifts.push(shift);
  notify({ userId, type: 'shift', title: 'New shift', message: `You're on ${date}, ${start}–${end}.`, link: '/staff/schedule' });
  return res.status(201).json({ shift: serializeShift(shift) });
});

/** PATCH /api/staff/shifts/:id — reschedule or mark completed/missed. */
router.patch('/shifts/:id', managerRoles, (req, res) => {
  const shift = shifts.find((s) => s.id === req.params.id);
  if (!shift) return res.status(404).json({ error: 'Shift not found.' });
  const { status, date, start, end, userId } = req.body || {};
  id(userId, 'Staff member');
  const notes = text(req.body?.notes, 'Notes', { max: 500, multiline: true });
  const next = { userId: userId ?? shift.userId, date: date ?? shift.date, start: start ?? shift.start, end: end ?? shift.end };
  const error = validateShift(next, shift.id);
  if (error) return res.status(400).json({ error });
  if (status !== undefined && !['scheduled', 'completed', 'missed'].includes(status)) {
    return res.status(400).json({ error: 'Status must be scheduled, completed or missed.' });
  }
  Object.assign(shift, next);
  if (status !== undefined) shift.status = status;
  if (notes !== undefined) shift.notes = notes;
  return res.json({ shift: serializeShift(shift) });
});

/** DELETE /api/staff/shifts/:id */
router.delete('/shifts/:id', managerRoles, (req, res) => {
  const idx = shifts.findIndex((s) => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Shift not found.' });
  const [removed] = shifts.splice(idx, 1);
  return res.json({ deleted: true, id: removed.id });
});

/* ----------------------------------------------------------- performance */

/**
 * GET /api/staff/performance?from=&to= — per-staff metrics (US9.5): orders
 * taken/served, revenue and tips handled, items prepared and average prep time,
 * and shifts completed/missed.
 */
router.get('/performance', managerRoles, (req, res) => {
  const { from, to } = rangeFromQuery(req.query, localDate(addDays(new Date(), -29)), localDate());
  const inRange = orders.filter((o) => {
    const d = localDate(new Date(o.createdAt));
    return d >= from && d <= to && o.status !== 'cancelled';
  });

  const staff = users.filter((u) => STAFF_ROLES.includes(u.role));
  const rows = staff.map((u) => {
    const taken = inRange.filter((o) => o.waiterId === u.id);
    const settled = taken.filter((o) => o.paymentStatus !== 'unpaid');
    const prepared = inRange.flatMap((o) => o.items.filter((i) => i.preparedBy === u.id).map((i) => ({ i, o })));
    const prepTimes = prepared
      .filter(({ i, o }) => i.readyAt && o.confirmedAt)
      .map(({ i, o }) => (new Date(i.readyAt) - new Date(o.confirmedAt)) / MINUTE);
    const myShifts = shifts.filter((s) => s.userId === u.id && s.date >= from && s.date <= to);
    const completed = myShifts.filter((s) => s.status === 'completed');

    return {
      userId: u.id,
      name: u.name,
      role: u.role,
      active: u.active,
      ordersTaken: taken.length,
      ordersServed: inRange.filter((o) => o.servedBy === u.id).length,
      revenueHandled: fromCents(settled.reduce((s, o) => s + toCents(o.total) - toCents(o.refund?.amount ?? 0), 0)),
      tips: fromCents(settled.reduce((s, o) => s + toCents(o.tip), 0)),
      itemsPrepared: prepared.reduce((s, { i }) => s + i.qty, 0),
      avgPrepMinutes: prepTimes.length ? Math.round(prepTimes.reduce((s, m) => s + m, 0) / prepTimes.length) : null,
      shiftsCompleted: completed.length,
      shiftsMissed: myShifts.filter((s) => s.status === 'missed').length,
      hoursWorked: Math.round(completed.reduce((s, x) => s + shiftHours(x), 0) * 10) / 10,
    };
  });

  res.json({ from, to, staff: rows });
});

export default router;

import { Router } from 'express';
import {
  users, shifts, attendance, payAdjustments, orders, settings, STAFF_ROLES, findUserById, nextId,
} from '../data/store.js';
import { requireRole } from '../middleware/auth.js';
import {
  buildSeries, currentState, monthKey, paidMinutes, rulesFrom, serializeSession, shiftStatus, summarize,
} from '../lib/attendance.js';
import { MONTH_RE, monthRange, monthTips, payBreakdown, round2, wageOf } from '../lib/payroll.js';
import { NOT_ALLOWED_ERROR, overviewRoles, seesPay, workforceAccess } from '../lib/workforce.js';
import { combine, localDate, iso } from '../lib/time.js';

const router = Router();
const staffRoles = requireRole(...STAFF_ROLES);
const adminOnly = requireRole('admin');

const MAX_RANGE_DAYS = 366;
const MAX_ADJUSTMENT = 10000;
const MAX_WAGE = 500;

/** A real calendar date (rejects 2026-02-31, which Date would roll over). */
const isStrictDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value)) && localDate(combine(value, '00:00')) === value;

/**
 * { from, to } from the query, or { error }. Defaults: `to` today, `from` the
 * first day of `to`'s month. At most a year.
 */
function parseRange(query, now) {
  const to = query.to ?? localDate(now);
  if (!isStrictDate(to)) return { error: '"to" must be a date (YYYY-MM-DD).' };
  const from = query.from ?? `${monthKey(to)}-01`;
  if (!isStrictDate(from)) return { error: '"from" must be a date (YYYY-MM-DD).' };
  if (from > to) return { error: '"from" must be on or before "to".' };
  const days = Math.round((combine(to, '12:00') - combine(from, '12:00')) / 86400000) + 1;
  if (days > MAX_RANGE_DAYS) return { error: 'The range can be at most a year.' };
  return { from, to };
}

const staffTarget = (id) => {
  const user = findUserById(id);
  return user && STAFF_ROLES.includes(user.role) ? user : null;
};

const between = (date, from, to) => date >= from && date <= to;

/** PayBreakdown for one person and month. */
function payFor(user, month, now) {
  const rules = rulesFrom(settings);
  const { from, to } = monthRange(month);
  const sessions = attendance.filter((s) => s.userId === user.id && between(s.date, from, to));
  return payBreakdown({
    month,
    hourlyWage: wageOf(user),
    paidMinutes: sessions.reduce((sum, s) => sum + paidMinutes(s, rules, now.getTime()), 0),
    tips: user.role === 'waiter' ? monthTips(orders, user.id, month) : 0,
    adjustments: payAdjustments.filter((a) => a.userId === user.id && between(a.date, from, to)),
    lateSessions: sessions.filter((s) => s.late),
    latePenalty: rules.latePenalty,
    today: localDate(now),
  });
}

/** StaffAnalytics for one person over [from, to]; pay only with full access. */
function analytics(user, { from, to }, access, now = new Date()) {
  const rules = rulesFrom(settings);
  const at = now.getTime();
  const all = attendance.filter((s) => s.userId === user.id);
  const sessions = all.filter((s) => between(s.date, from, to));
  const myShifts = shifts
    .filter((s) => s.userId === user.id && between(s.date, from, to))
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  return {
    user: { id: user.id, name: user.name, role: user.role },
    range: { from, to },
    summary: summarize(sessions, myShifts, rules, at, all),
    series: buildSeries(sessions, myShifts, from, to, rules, at),
    sessions: sessions
      .slice()
      .sort((a, b) => b.clockIn.localeCompare(a.clockIn))
      .map((s) => serializeSession(s, rules, at)),
    shifts: myShifts.map((s) => ({ id: s.id, date: s.date, start: s.start, end: s.end, status: shiftStatus(s, all, at) })),
    pay: access === 'full' ? payFor(user, monthKey(to), now) : null,
  };
}

/** GET /api/workforce/me?from&to — the signed-in staff member's attendance and pay. */
router.get('/me', staffRoles, (req, res) => {
  const range = parseRange(req.query, new Date());
  if (range.error) return res.status(400).json({ error: range.error });
  return res.json(analytics(req.user, range, 'full'));
});

/**
 * GET /api/workforce/users/:id?from&to — one person's attendance (and pay for
 * the admin or the person themselves). Managers see waiters and chefs only,
 * without pay.
 */
router.get('/users/:id', staffRoles, (req, res) => {
  const target = staffTarget(req.params.id);
  if (!target) return res.status(404).json({ error: 'Staff member not found.' });
  const access = workforceAccess(req.user, target);
  if (!access) return res.status(403).json({ error: NOT_ALLOWED_ERROR });
  const range = parseRange(req.query, new Date());
  if (range.error) return res.status(400).json({ error: range.error });
  return res.json(analytics(target, range, access));
});

/**
 * GET /api/workforce/overview?month=YYYY-MM — everyone the caller may see,
 * with the month's attendance; pay and payroll for the admin only.
 */
router.get('/overview', requireRole('manager', 'admin'), (req, res) => {
  const now = new Date();
  const month = req.query.month ?? monthKey(localDate(now));
  if (!MONTH_RE.test(String(month))) return res.status(400).json({ error: '"month" must be YYYY-MM.' });
  const roles = overviewRoles(req.user);
  const money = seesPay(req.user);
  const rules = rulesFrom(settings);
  const { from, to } = monthRange(month);
  const at = now.getTime();

  const visible = users.filter((u) => roles.includes(u.role));
  const ids = new Set(visible.map((u) => u.id));
  const rows = visible
    .map((u) => {
      const all = attendance.filter((s) => s.userId === u.id);
      const sessions = all.filter((s) => between(s.date, from, to));
      const monthShifts = shifts.filter((s) => s.userId === u.id && between(s.date, from, to));
      return {
        user: { id: u.id, name: u.name, role: u.role, active: u.active },
        state: currentState(all).state,
        summary: summarize(sessions, monthShifts, rules, at, all),
        pay: money ? payFor(u, month, now) : null,
      };
    });

  const totals = {
    paidMinutes: rows.reduce((sum, r) => sum + r.summary.paidMinutes, 0),
    lateCount: rows.reduce((sum, r) => sum + r.summary.lateCount, 0),
    payroll: money ? round2(rows.reduce((sum, r) => sum + r.pay.net, 0)) : null,
  };
  // Team charts: the same buckets as one person's series, over everyone shown.
  const team = buildSeries(
    attendance.filter((s) => ids.has(s.userId) && between(s.date, from, to)),
    shifts.filter((s) => ids.has(s.userId) && between(s.date, from, to)),
    from, to, rules, at,
  );
  return res.json({ month, rows, totals, series: { day: team.day, week: team.week, hour: team.hour } });
});

/** PUT /api/workforce/users/:id/wage — set an hourly wage (admin). */
router.put('/users/:id/wage', adminOnly, (req, res) => {
  const target = staffTarget(req.params.id);
  if (!target) return res.status(404).json({ error: 'Staff member not found.' });
  const wage = req.body?.hourlyWage;
  if (typeof wage !== 'number' || !Number.isFinite(wage) || wage <= 0 || wage > MAX_WAGE) {
    return res.status(400).json({ error: `hourlyWage must be a number above 0 and at most ${MAX_WAGE}.` });
  }
  target.hourlyWage = round2(wage);
  return res.json({ hourlyWage: target.hourlyWage });
});

/** POST /api/workforce/users/:id/adjustments — add a bonus (or a deduction, negative) (admin). */
router.post('/users/:id/adjustments', adminOnly, (req, res) => {
  const target = staffTarget(req.params.id);
  if (!target) return res.status(404).json({ error: 'Staff member not found.' });
  const { amount, reason, date } = req.body || {};
  if (typeof amount !== 'number' || !Number.isFinite(amount) || round2(amount) === 0 || Math.abs(amount) > MAX_ADJUSTMENT) {
    return res.status(400).json({ error: `amount must be a non-zero number between -${MAX_ADJUSTMENT} and ${MAX_ADJUSTMENT}.` });
  }
  if (typeof reason !== 'string' || !reason.trim()) return res.status(400).json({ error: 'A reason is required.' });
  if (reason.trim().length > 200) return res.status(400).json({ error: 'The reason can be at most 200 characters.' });
  if (date !== undefined && !isStrictDate(date)) return res.status(400).json({ error: '"date" must be a date (YYYY-MM-DD).' });

  const adjustment = {
    id: nextId('adj'),
    userId: target.id,
    amount: round2(amount),
    reason: reason.trim(),
    date: date ?? localDate(),
    createdBy: req.user.id,
    createdAt: iso(),
  };
  payAdjustments.push(adjustment);
  return res.status(201).json({ adjustment });
});

/** DELETE /api/workforce/users/:id/adjustments/:adjId (admin) */
router.delete('/users/:id/adjustments/:adjId', adminOnly, (req, res) => {
  const target = staffTarget(req.params.id);
  if (!target) return res.status(404).json({ error: 'Staff member not found.' });
  const idx = payAdjustments.findIndex((a) => a.id === req.params.adjId && a.userId === target.id);
  if (idx === -1) return res.status(404).json({ error: 'Adjustment not found.' });
  const [removed] = payAdjustments.splice(idx, 1);
  return res.json({ deleted: true, id: removed.id });
});

export default router;

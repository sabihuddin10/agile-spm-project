import { Router } from 'express';
import { users, shifts, attendance, settings, STAFF_ROLES, nextId } from '../data/store.js';
import { requireRole } from '../middleware/auth.js';
import { currentState, lateness, matchShift, rulesFrom, serializeSession } from '../lib/attendance.js';
import { presenceRoles } from '../lib/workforce.js';
import { localDate, iso } from '../lib/time.js';

const router = Router();
const staffRoles = requireRole(...STAFF_ROLES);

const sessionsOf = (userId) => attendance.filter((s) => s.userId === userId);

/**
 * Today's shift for the status card: the one the open session belongs to, else
 * the one in progress or next up, else the last one today.
 */
function todayShift(userId, openSession, now) {
  const today = localDate(now);
  const mine = shifts
    .filter((s) => s.userId === userId && s.date === today)
    .sort((a, b) => a.start.localeCompare(b.start));
  if (!mine.length) return null;
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const pick = mine.find((s) => s.id === openSession?.shiftId) ?? mine.find((s) => s.end > hhmm) ?? mine[mine.length - 1];
  return { start: pick.start, end: pick.end };
}

/** MyStatus: state, since when, the current (or today's latest) session and today's shift. */
function myStatus(userId, now = new Date()) {
  const rules = rulesFrom(settings);
  const mine = sessionsOf(userId);
  const { state, since, session } = currentState(mine);
  const today = localDate(now);
  const shown = session ?? mine.filter((s) => s.date === today).sort((a, b) => b.clockIn.localeCompare(a.clockIn))[0] ?? null;
  return {
    state,
    since,
    session: shown ? serializeSession(shown, rules, now.getTime()) : null,
    todayShift: todayShift(userId, session, now),
  };
}

const openSession = (userId) => attendance.find((s) => s.userId === userId && !s.clockOut);
const openBreak = (session) => session?.breaks.find((b) => !b.end);

/** GET /api/attendance/me — the signed-in staff member's clock status. */
router.get('/me', staffRoles, (req, res) => {
  res.json(myStatus(req.user.id));
});

/** POST /api/attendance/clock-in — start a session, matched to today's shift for lateness. */
router.post('/clock-in', staffRoles, (req, res) => {
  if (openSession(req.user.id)) return res.status(409).json({ error: 'You are already clocked in.' });
  const now = new Date();
  const clockIn = iso(now);
  const shift = matchShift(shifts, req.user.id, clockIn);
  const { late, lateMinutes } = lateness(shift, clockIn, rulesFrom(settings).lateGraceMinutes);
  attendance.push({
    id: nextId('att'),
    userId: req.user.id,
    date: localDate(now),
    clockIn,
    clockOut: null,
    breaks: [],
    shiftId: shift?.id ?? null,
    late,
    lateMinutes,
  });
  res.json(myStatus(req.user.id, now));
});

/** POST /api/attendance/clock-out — end the session (an open break ends with it). */
router.post('/clock-out', staffRoles, (req, res) => {
  const session = openSession(req.user.id);
  if (!session) return res.status(409).json({ error: 'You are not clocked in.' });
  const now = new Date();
  const brk = openBreak(session);
  if (brk) brk.end = iso(now);
  session.clockOut = iso(now);
  const shift = shifts.find((s) => s.id === session.shiftId);
  if (shift && shift.status === 'scheduled') shift.status = 'completed';
  res.json(myStatus(req.user.id, now));
});

/** POST /api/attendance/break/start */
router.post('/break/start', staffRoles, (req, res) => {
  const session = openSession(req.user.id);
  if (!session) return res.status(409).json({ error: 'You are not clocked in.' });
  if (openBreak(session)) return res.status(409).json({ error: 'You are already on a break.' });
  const now = new Date();
  session.breaks.push({ start: iso(now), end: null });
  res.json(myStatus(req.user.id, now));
});

/** POST /api/attendance/break/end */
router.post('/break/end', staffRoles, (req, res) => {
  const session = openSession(req.user.id);
  if (!session) return res.status(409).json({ error: 'You are not clocked in.' });
  const brk = openBreak(session);
  if (!brk) return res.status(409).json({ error: 'You are not on a break.' });
  const now = new Date();
  brk.end = iso(now);
  res.json(myStatus(req.user.id, now));
});

/**
 * GET /api/attendance/presence — who is working, on a break or off right now.
 * Waiters see waiters, chefs see chefs, managers see managers, waiters and
 * chefs, the admin sees all staff. Suspended accounts are left out.
 */
router.get('/presence', staffRoles, (req, res) => {
  const now = new Date();
  const roles = presenceRoles(req.user);
  const people = users
    .filter((u) => u.active && roles.includes(u.role))
    .map((u) => {
      const { state, since, session } = currentState(sessionsOf(u.id));
      return { userId: u.id, name: u.name, role: u.role, state, since, todayShift: todayShift(u.id, session, now) };
    });
  res.json({ people });
});

export default router;

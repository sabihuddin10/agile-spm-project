/** staff_applications, shifts, attendance_sessions, attendance_breaks, pay_adjustments. */
import { iso, hm, num, ref, byParent } from './sql.js';

export function save(s, ids) {
  let brk = 0;
  return [
    ['staff_applications', 'id bigint, ext_id text, name text, email text, phone text, desired_role application_desired_role, experience text, status application_status, created_at timestamptz, decided_at timestamptz, decided_by bigint, user_id bigint',
      s.applications.map((a, i) => ({
        id: i + 1, ext_id: a.id, name: a.name, email: a.email, phone: a.phone, desired_role: a.desiredRole,
        experience: a.experience, status: a.status, created_at: a.createdAt, decided_at: a.decidedAt,
        decided_by: ref(ids.users, a.decidedBy), user_id: ref(ids.users, a.userId),
      }))],
    ['shifts', 'id bigint, ext_id text, user_id bigint, date date, "start" time, "end" time, notes text, status shift_status, created_by bigint, created_at timestamptz',
      s.shifts.map((h, i) => ({
        id: i + 1, ext_id: h.id, user_id: ref(ids.users, h.userId), date: h.date, start: h.start, end: h.end,
        notes: h.notes, status: h.status, created_by: ref(ids.users, h.createdBy), created_at: h.createdAt,
      }))],
    ['attendance_sessions', 'id bigint, ext_id text, user_id bigint, date date, clock_in timestamptz, clock_out timestamptz, shift_id bigint, late boolean, late_minutes integer',
      s.attendance.map((a, i) => ({
        id: i + 1, ext_id: a.id, user_id: ref(ids.users, a.userId), date: a.date, clock_in: a.clockIn,
        clock_out: a.clockOut, shift_id: ref(ids.shifts, a.shiftId), late: a.late, late_minutes: a.lateMinutes,
      }))],
    ['attendance_breaks', 'id bigint, session_id bigint, "start" timestamptz, "end" timestamptz',
      s.attendance.flatMap((a, i) => a.breaks.map((b) => ({ id: ++brk, session_id: i + 1, start: b.start, end: b.end })))],
    ['pay_adjustments', 'id bigint, ext_id text, user_id bigint, amount numeric, reason text, date date, created_by bigint, created_at timestamptz',
      s.payAdjustments.map((p, i) => ({
        id: i + 1, ext_id: p.id, user_id: ref(ids.users, p.userId), amount: p.amount, reason: p.reason, date: p.date,
        created_by: ref(ids.users, p.createdBy), created_at: p.createdAt,
      }))],
  ];
}

export function load(r, x) {
  const breaksOf = byParent(r.attendance_breaks, 'session_id');
  return {
    applications: r.staff_applications.map((a) => ({
      id: a.ext_id, name: a.name, email: a.email, phone: a.phone, desiredRole: a.desired_role, experience: a.experience,
      status: a.status, createdAt: iso(a.created_at), decidedAt: iso(a.decided_at), decidedBy: ref(x.users, a.decided_by),
      userId: ref(x.users, a.user_id),
    })),
    shifts: r.shifts.map((h) => ({
      id: h.ext_id, userId: ref(x.users, h.user_id), date: h.date, start: hm(h.start), end: hm(h.end), notes: h.notes,
      status: h.status, createdBy: ref(x.users, h.created_by), createdAt: iso(h.created_at),
    })),
    attendance: r.attendance_sessions.map((a) => ({
      id: a.ext_id, userId: ref(x.users, a.user_id), date: a.date, clockIn: iso(a.clock_in), clockOut: iso(a.clock_out),
      breaks: breaksOf(a.id).map((b) => ({ start: iso(b.start), end: iso(b.end) })),
      shiftId: ref(x.shifts, a.shift_id), late: a.late, lateMinutes: a.late_minutes,
    })),
    payAdjustments: r.pay_adjustments.map((p) => ({
      id: p.ext_id, userId: ref(x.users, p.user_id), amount: num(p.amount), reason: p.reason, date: p.date,
      createdBy: ref(x.users, p.created_by), createdAt: iso(p.created_at),
    })),
  };
}

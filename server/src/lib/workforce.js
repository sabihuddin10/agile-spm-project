/**
 * Who sees whose attendance and pay.
 *
 * - Everyone sees their own attendance and pay.
 * - The admin sees everything about every staff member.
 * - Managers see waiters' and chefs' attendance, never wages or pay.
 * - Nobody else sees another person's records.
 *
 * Presence (who is working right now): waiters see waiters, chefs see chefs,
 * managers see managers, waiters and chefs, the admin sees all staff.
 */
export const WORKFORCE_ROLES = ['waiter', 'chef', 'manager', 'admin'];

const MANAGER_SEES = ['waiter', 'chef'];

const PRESENCE = {
  waiter: ['waiter'],
  chef: ['chef'],
  manager: ['manager', 'waiter', 'chef'],
  admin: WORKFORCE_ROLES,
};

/** 'full' (attendance and pay), 'attendance' (no pay) or null (not allowed). */
export function workforceAccess(actor, target) {
  if (!actor || !target || !WORKFORCE_ROLES.includes(target.role)) return null;
  if (actor.id === target.id) return 'full';
  if (actor.role === 'admin') return 'full';
  if (actor.role === 'manager' && MANAGER_SEES.includes(target.role)) return 'attendance';
  return null;
}

/** Roles whose people the actor may list in the workforce overview (null: no access). */
export function overviewRoles(actor) {
  if (actor?.role === 'admin') return WORKFORCE_ROLES;
  if (actor?.role === 'manager') return MANAGER_SEES;
  return null;
}

/** Whether the actor sees money (wages, pay, payroll) for others. */
export const seesPay = (actor) => actor?.role === 'admin';

/** Roles shown on the actor's presence board. */
export function presenceRoles(actor) {
  return PRESENCE[actor?.role] ?? [];
}

export const NOT_ALLOWED_ERROR = 'You can only see your own attendance and pay.';

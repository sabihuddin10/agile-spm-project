/**
 * Staff account hierarchy: superadmin > admin > manager > chef = waiter.
 *
 * A manager, admin or the super admin may manage another staff account only
 * when its rank is strictly lower than their own. Nobody manages their own
 * account through these rules (that is self-service), and peers cannot manage
 * each other, so an admin cannot act on another admin and a manager not on
 * another manager; only the super admin manages admins, and nobody manages the
 * super admin. Customers are outside the hierarchy; their records live in the
 * customer ledger.
 */
export const RANK = { superadmin: 4, admin: 3, manager: 2, chef: 1, waiter: 1 };

/** Roles the API can give an account. The super admin is bound to one account, never assigned. */
export const ASSIGNABLE_ROLES = ['customer', 'waiter', 'chef', 'manager', 'admin'];

export const rankOf = (role) => RANK[role] ?? 0;

export function canManage(actor, target) {
  if (!actor || !target || actor.id === target.id) return false;
  if (rankOf(actor.role) < RANK.manager) return false;
  if (!(target.role in RANK)) return false;
  return rankOf(actor.role) > rankOf(target.role);
}

/** Whether `user` holds one of `roles`. The super admin holds every admin permission. */
export function hasRole(user, ...roles) {
  if (!user) return false;
  return roles.includes(user.role) || (user.role === 'superadmin' && roles.includes('admin'));
}

export const BELOW_RANK_ERROR = 'You can only manage accounts below your own rank.';

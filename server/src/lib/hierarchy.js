/**
 * Staff account hierarchy: admin > manager > chef = waiter.
 *
 * A manager or admin may manage another staff account only when its rank is
 * strictly lower than their own. Nobody manages their own account through
 * these rules (that is self-service), and peers cannot manage each other, so
 * an admin cannot act on another admin and a manager not on another manager.
 * Customers are outside the hierarchy; their records live in the customer ledger.
 */
export const RANK = { admin: 3, manager: 2, chef: 1, waiter: 1 };

export const rankOf = (role) => RANK[role] ?? 0;

export function canManage(actor, target) {
  if (!actor || !target || actor.id === target.id) return false;
  if (!['manager', 'admin'].includes(actor.role)) return false;
  if (!(target.role in RANK)) return false;
  return rankOf(actor.role) > rankOf(target.role);
}

export const BELOW_RANK_ERROR = 'You can only manage accounts below your own rank.';

import type { Role, StaffRole, User } from '@/types';

/**
 * Single source of truth for which roles may open each staff section. Mirrors
 * the server's requireRole guards so the UI never offers what the API refuses.
 */
export const STAFF_ROLES: Role[] = ['waiter', 'chef', 'manager', 'admin'];

export const SECTION_ROLES = {
  overview: STAFF_ROLES,
  orders: ['waiter', 'manager', 'admin'],
  kitchen: ['chef', 'manager', 'admin'],
  billing: ['waiter', 'manager', 'admin'],
  tables: ['waiter', 'manager', 'admin'],
  reservations: ['waiter', 'manager', 'admin'],
  customers: ['waiter', 'manager', 'admin'],
  menu: STAFF_ROLES,
  inventory: ['chef', 'manager', 'admin'],
  staff: ['manager', 'admin'],
  schedule: STAFF_ROLES,
  analytics: ['manager', 'admin'],
  settings: ['manager', 'admin'],
  account: STAFF_ROLES,
} satisfies Record<string, Role[]>;

export type Section = keyof typeof SECTION_ROLES;

export function canAccess(role: Role | null | undefined, section: Section): boolean {
  return Boolean(role && (SECTION_ROLES[section] as Role[]).includes(role));
}

export function isStaff(role: Role | null | undefined): boolean {
  return Boolean(role && STAFF_ROLES.includes(role));
}

const anyOf = (...roles: Role[]) => (role: Role | null | undefined) => Boolean(role && roles.includes(role));

/** Fine-grained actions within a section. */
export const can = {
  placeStaffOrders: anyOf('waiter', 'manager', 'admin'),
  confirmOrders: anyOf('waiter', 'manager', 'admin'),
  serveOrders: anyOf('waiter', 'manager', 'admin'),
  cookOrders: anyOf('chef', 'manager', 'admin'),
  reprioritizeKitchen: anyOf('chef', 'manager', 'admin'),
  manageMenu: anyOf('manager', 'admin'),
  toggleAvailability: anyOf('chef', 'manager', 'admin'),
  editRecipes: anyOf('manager', 'admin'),
  manageInventory: anyOf('manager', 'admin'),
  adjustStock: anyOf('chef', 'manager', 'admin'),
  editFloorLayout: anyOf('manager', 'admin'),
  refund: anyOf('manager', 'admin'),
  reversePayment: anyOf('manager', 'admin'),
  cancelPaidOrders: anyOf('manager', 'admin'),
  deleteCustomers: anyOf('manager', 'admin'),
  viewRecipes: anyOf('chef', 'manager', 'admin'),
  approveStaff: anyOf('manager', 'admin'),
  scheduleShifts: anyOf('manager', 'admin'),
  assignRoles: anyOf('admin'),
  suspendStaff: anyOf('admin'),
  /** Type a new password for someone else, without their old one. */
  setPasswords: anyOf('admin'),
  editSettings: anyOf('manager', 'admin'),
};

/**
 * Staff hierarchy for account management: admin > manager > chef = waiter.
 * Customers sit outside it and manage their own account.
 */
export const ROLE_RANK: Record<StaffRole, number> = { admin: 3, manager: 2, chef: 1, waiter: 1 };

type Account = Pick<User, 'id' | 'role'>;

function rankOf(role: Role | null | undefined): number {
  return role && role !== 'customer' ? ROLE_RANK[role] : 0;
}

/**
 * Whether `actor` may edit `target`'s details or reset their password: the actor
 * is a manager or admin, the target is another staff account, and the target's
 * rank is strictly lower. Your own account is self-service (My account).
 */
export function canManageAccount(actor: Account | null | undefined, target: Account | null | undefined): boolean {
  if (!actor || !target || actor.id === target.id) return false;
  if (actor.role !== 'manager' && actor.role !== 'admin') return false;
  if (!isStaff(target.role)) return false;
  return rankOf(target.role) < rankOf(actor.role);
}

/**
 * Whether `actor` may change `target`'s role, suspend or remove them: admin only,
 * never themselves and never another admin. Customer accounts rank below every
 * staff role, so an admin can still promote a customer.
 */
export function canAdministerAccount(actor: Account | null | undefined, target: Account | null | undefined): boolean {
  if (!actor || !target || actor.id === target.id) return false;
  if (!can.assignRoles(actor.role)) return false;
  return rankOf(target.role) < rankOf(actor.role);
}

import type { Role } from '@/types';

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
  approveStaff: anyOf('manager', 'admin'),
  scheduleShifts: anyOf('manager', 'admin'),
  assignRoles: anyOf('admin'),
  suspendStaff: anyOf('admin'),
  editSettings: anyOf('manager', 'admin'),
};

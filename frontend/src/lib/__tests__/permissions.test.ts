import { describe, expect, it } from 'vitest';
import {
  can,
  canAccess,
  canAdministerAccount,
  canManageAccount,
  isStaff,
  ROLE_RANK,
  SECTION_ROLES,
  STAFF_ROLES,
} from '@/lib/permissions';
import type { Section } from '@/lib/permissions';
import type { Role } from '@/types';

const ALL_ROLES: Role[] = ['customer', 'waiter', 'chef', 'manager', 'admin'];

describe('canAccess', () => {
  it('matches SECTION_ROLES for every role x section combination', () => {
    // Arrange
    const sections = Object.keys(SECTION_ROLES) as Section[];

    // Act / Assert
    for (const section of sections) {
      for (const role of ALL_ROLES) {
        const expected = (SECTION_ROLES[section] as Role[]).includes(role);
        expect(canAccess(role, section)).toBe(expected);
      }
    }
  });

  it('denies access for a null/undefined role', () => {
    // Arrange / Act / Assert
    expect(canAccess(null, 'overview')).toBe(false);
    expect(canAccess(undefined, 'overview')).toBe(false);
  });
});

describe('isStaff', () => {
  it('is true for every staff role and false for customer or no role', () => {
    // Arrange / Act / Assert
    for (const role of STAFF_ROLES) expect(isStaff(role)).toBe(true);
    expect(isStaff('customer')).toBe(false);
    expect(isStaff(null)).toBe(false);
  });
});

describe('can.*', () => {
  const cases: [keyof typeof can, Role[]][] = [
    ['placeStaffOrders', ['waiter', 'manager', 'admin']],
    ['confirmOrders', ['waiter', 'manager', 'admin']],
    ['serveOrders', ['waiter', 'manager', 'admin']],
    ['cookOrders', ['chef', 'manager', 'admin']],
    ['reprioritizeKitchen', ['chef', 'manager', 'admin']],
    ['manageMenu', ['manager', 'admin']],
    ['toggleAvailability', ['chef', 'manager', 'admin']],
    ['editRecipes', ['manager', 'admin']],
    ['manageInventory', ['manager', 'admin']],
    ['adjustStock', ['chef', 'manager', 'admin']],
    ['editFloorLayout', ['manager', 'admin']],
    ['refund', ['manager', 'admin']],
    ['reversePayment', ['manager', 'admin']],
    ['cancelPaidOrders', ['manager', 'admin']],
    ['deleteCustomers', ['manager', 'admin']],
    ['viewRecipes', ['chef', 'manager', 'admin']],
    ['approveStaff', ['manager', 'admin']],
    ['scheduleShifts', ['manager', 'admin']],
    ['assignRoles', ['admin']],
    ['suspendStaff', ['admin']],
    ['editSettings', ['manager', 'admin']],
  ];

  for (const [action, allowed] of cases) {
    it(`${action} allows exactly ${allowed.join(', ')}`, () => {
      // Arrange / Act / Assert
      for (const role of ALL_ROLES) {
        expect(can[action](role)).toBe(allowed.includes(role));
      }
      expect(can[action](null)).toBe(false);
    });
  }
});

describe('account section', () => {
  it('is open to every staff role and closed to customers', () => {
    // Arrange / Act / Assert
    for (const role of STAFF_ROLES) expect(canAccess(role, 'account')).toBe(true);
    expect(canAccess('customer', 'account')).toBe(false);
  });
});

describe('ROLE_RANK', () => {
  it('ranks admin over manager over chef and waiter, which are equal', () => {
    // Arrange / Act / Assert
    expect(ROLE_RANK).toEqual({ admin: 3, manager: 2, chef: 1, waiter: 1 });
  });
});

/** An account with the given role and id. */
const acct = (role: Role, id = `usr_${role}`) => ({ id, role });

describe('canManageAccount', () => {
  // Expected result for every actor (row) x target (column) pair of distinct accounts.
  const matrix: Record<Role, Record<Role, boolean>> = {
    admin: { admin: false, manager: true, chef: true, waiter: true, customer: false },
    manager: { admin: false, manager: false, chef: true, waiter: true, customer: false },
    chef: { admin: false, manager: false, chef: false, waiter: false, customer: false },
    waiter: { admin: false, manager: false, chef: false, waiter: false, customer: false },
    customer: { admin: false, manager: false, chef: false, waiter: false, customer: false },
  };

  for (const actorRole of ALL_ROLES) {
    for (const targetRole of ALL_ROLES) {
      const expected = matrix[actorRole][targetRole];
      it(`${actorRole} ${expected ? 'can' : 'cannot'} manage another ${targetRole}`, () => {
        // Arrange
        const actor = acct(actorRole, 'actor');
        const target = acct(targetRole, 'target');

        // Act
        const result = canManageAccount(actor, target);

        // Assert
        expect(result).toBe(expected);
      });
    }
  }

  it('never lets anyone manage their own account here', () => {
    // Arrange / Act / Assert
    for (const role of ALL_ROLES) expect(canManageAccount(acct(role, 'same'), acct(role, 'same'))).toBe(false);
  });

  it('is false when either side is missing', () => {
    // Arrange / Act / Assert
    expect(canManageAccount(null, acct('waiter'))).toBe(false);
    expect(canManageAccount(acct('admin'), undefined)).toBe(false);
  });
});

describe('canAdministerAccount', () => {
  it('lets an admin change, suspend or remove anyone below admin, customers included', () => {
    // Arrange
    const admin = acct('admin', 'actor');

    // Act / Assert
    for (const role of ['manager', 'chef', 'waiter', 'customer'] as Role[]) {
      expect(canAdministerAccount(admin, acct(role, 'target'))).toBe(true);
    }
    expect(canAdministerAccount(admin, acct('admin', 'other-admin'))).toBe(false);
    expect(canAdministerAccount(admin, acct('admin', 'actor'))).toBe(false);
  });

  it('is never allowed for non-admins', () => {
    // Arrange / Act / Assert
    for (const actorRole of ['manager', 'chef', 'waiter', 'customer'] as Role[]) {
      for (const targetRole of ALL_ROLES) {
        expect(canAdministerAccount(acct(actorRole, 'actor'), acct(targetRole, 'target'))).toBe(false);
      }
    }
    expect(canAdministerAccount(null, acct('waiter'))).toBe(false);
  });
});

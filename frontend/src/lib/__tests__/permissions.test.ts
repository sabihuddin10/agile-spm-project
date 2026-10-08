import { describe, expect, it } from 'vitest';
import { can, canAccess, isStaff, SECTION_ROLES, STAFF_ROLES } from '@/lib/permissions';
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

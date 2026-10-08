import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { RoleCapabilities } from '@/components/staff/role-capabilities';
import { ROLE_CAPABILITIES } from '@/components/staff/role-meta';
import type { StaffRole } from '@/types';

const ROLES: StaffRole[] = ['waiter', 'chef', 'manager', 'admin'];

describe('RoleCapabilities', () => {
  for (const role of ROLES) {
    it(`lists what a ${role} can and cannot do`, () => {
      // Arrange
      const { can, cannot } = ROLE_CAPABILITIES[role];

      // Act
      render(<RoleCapabilities role={role} />);

      // Assert
      const canList = within(screen.getByRole('region', { name: 'You can' })).getAllByRole('listitem');
      const cannotList = within(screen.getByRole('region', { name: "You can't" })).getAllByRole('listitem');
      expect(canList.map((li) => li.textContent)).toEqual(can);
      expect(cannotList.map((li) => li.textContent)).toEqual(cannot);
    });
  }

  it('names the role it describes', () => {
    // Arrange / Act
    render(<RoleCapabilities role="chef" />);

    // Assert
    expect(screen.getByText('Access for the chef role. An admin can change your role.')).toBeInTheDocument();
  });
});

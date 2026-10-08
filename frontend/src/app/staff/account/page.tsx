'use client';

import { StaffLayout } from '@/components/layout/staff-layout';
import { MyAccount } from '@/components/staff/my-account';

/** My account — every staff member's own profile, password and role summary. */
export default function MyAccountPage() {
  return (
    <StaffLayout section="account">
      <MyAccount />
    </StaffLayout>
  );
}

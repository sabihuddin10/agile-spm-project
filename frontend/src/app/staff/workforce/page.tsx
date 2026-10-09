'use client';

import { StaffLayout } from '@/components/layout/staff-layout';
import { WorkforceHub } from '@/components/workforce/workforce-hub';

/** Workforce hub — attendance, hours and (admin) payroll for the team. */
export default function WorkforcePage() {
  return (
    <StaffLayout section="workforce">
      <WorkforceHub />
    </StaffLayout>
  );
}

'use client';

import { StaffLayout } from '@/components/layout/staff-layout';
import { MyWork } from '@/components/workforce/my-work';

/** My work — time clock, hours, pay estimate and colleagues now (every staff role). */
export default function MyWorkPage() {
  return (
    <StaffLayout section="mywork">
      <MyWork />
    </StaffLayout>
  );
}

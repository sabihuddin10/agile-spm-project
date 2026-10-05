'use client';

import { StaffLayout } from '@/components/layout/staff-layout';
import { MySchedule } from '@/components/staff/my-schedule';

/** My schedule — every staff member's own shifts (US9.3). */
export default function MySchedulePage() {
  return (
    <StaffLayout section="schedule">
      <MySchedule />
    </StaffLayout>
  );
}

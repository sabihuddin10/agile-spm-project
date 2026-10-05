'use client';

import { useAuth } from '@/context/auth-context';
import { StaffLayout } from '@/components/layout/staff-layout';
import { OverviewDashboard } from '@/components/overview/overview-dashboard';

/** Staff overview — a role-tailored live dashboard for every staff role. */
export default function StaffOverviewPage() {
  const { user } = useAuth();
  return <StaffLayout section="overview">{user ? <OverviewDashboard user={user} /> : null}</StaffLayout>;
}

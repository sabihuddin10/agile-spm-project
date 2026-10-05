'use client';

import { StaffLayout } from '@/components/layout/staff-layout';
import { AnalyticsDashboard } from '@/components/analytics/analytics-dashboard';

/** Manager/admin analytics dashboard (US10.1–US10.6). */
export default function AnalyticsPage() {
  return (
    <StaffLayout section="analytics">
      <AnalyticsDashboard />
    </StaffLayout>
  );
}

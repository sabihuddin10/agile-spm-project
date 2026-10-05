'use client';

import { StaffLayout } from '@/components/layout/staff-layout';
import { PageHeader } from '@/components/ui/page-header';
import { SettingsForm } from '@/components/settings/settings-form';

/** Restaurant settings — tax/service rates (US5.2), KDS threshold (US4.5), booking policy (US7.4). */
export default function SettingsPage() {
  return (
    <StaffLayout section="settings">
      <PageHeader
        title="Settings"
        subtitle="Restaurant details and the policies used by billing, the kitchen display and reservations."
      />
      <SettingsForm />
    </StaffLayout>
  );
}

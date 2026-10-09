'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AttendanceSettings, MyStatus, PresenceEntry, StaffAnalytics } from '@/types';
import { workforceApi } from '@/lib/workforce-api';
import { errorMessage } from '@/lib/format';
import { useAuth } from '@/context/auth-context';
import { usePolling } from '@/hooks/use-polling';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/toast';
import { MonthPicker } from '@/components/workforce/month-picker';
import { PresenceList } from '@/components/workforce/presence-list';
import { StaffWorkView } from '@/components/workforce/staff-work-view';
import { TimeClock, type ClockAction } from '@/components/workforce/time-clock';
import { currentMonth, monthBounds, recentMonths, trendBounds } from '@/components/workforce/workforce-format';

const ACTION_CALL: Record<ClockAction, () => Promise<MyStatus>> = {
  'clock-in': () => workforceApi.clockIn(),
  'break-start': () => workforceApi.startBreak(),
  'break-end': () => workforceApi.endBreak(),
  'clock-out': () => workforceApi.clockOut(),
};

const ACTION_DONE: Record<ClockAction, string> = {
  'clock-in': 'Checked in.',
  'break-start': 'Break started — enjoy it.',
  'break-end': 'Break ended. Welcome back.',
  'clock-out': 'Checked out. See you next shift.',
};

/**
 * My work — every staff member's own time clock, progress, pay estimate,
 * hours charts, sessions and who else is in right now.
 */
export function MyWork() {
  const { user } = useAuth();
  const toast = useToast();
  const [status, setStatus] = useState<MyStatus | null>(null);
  const [people, setPeople] = useState<PresenceEntry[]>([]);
  const [settings, setSettings] = useState<AttendanceSettings | undefined>(undefined);
  const [month, setMonth] = useState(() => currentMonth());
  const [data, setData] = useState<StaffAnalytics | null>(null);
  const [trend, setTrend] = useState<StaffAnalytics | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadLive = useCallback(async () => {
    try {
      const [s, p] = await Promise.all([workforceApi.me(), workforceApi.presence()]);
      setStatus(s);
      setPeople(p.people);
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  }, [toast]);

  const loadAnalytics = useCallback(async () => {
    try {
      const [m, t] = await Promise.all([workforceApi.myAnalytics(monthBounds(month)), workforceApi.myAnalytics(trendBounds(month))]);
      setData(m);
      setTrend(t);
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setLoading(false);
    }
  }, [month, toast]);

  useEffect(() => {
    loadLive();
    workforceApi
      .getSettings()
      .then(setSettings)
      .catch(() => undefined);
  }, [loadLive]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  usePolling(loadLive, 30000);

  async function act(action: ClockAction) {
    setBusy(true);
    try {
      const next = await ACTION_CALL[action]();
      setStatus(next);
      toast(ACTION_DONE[action], 'success');
      await Promise.all([loadLive(), loadAnalytics()]);
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="My work"
        subtitle={`Check in and out, and see your hours and pay${user ? `, ${user.name.split(' ')[0]}` : ''}.`}
      />

      <div className="space-y-6">
        {status ? (
          <TimeClock status={status} onAction={act} busy={busy} settings={settings} />
        ) : (
          <Card>
            <Spinner label="Loading your time clock…" />
          </Card>
        )}

        {loading || !data ? (
          <Card>
            <Spinner label="Loading your hours…" />
          </Card>
        ) : (
          <StaffWorkView
            data={data}
            trend={trend}
            month={month}
            monthPicker={<MonthPicker value={month} months={recentMonths(4)} onChange={setMonth} id="my-work-month" />}
          />
        )}

        <PresenceList
          people={people}
          selfId={user?.id}
          title="Colleagues now"
          subtitle={
            user?.role === 'waiter'
              ? 'Waiters on today, live.'
              : user?.role === 'chef'
                ? 'Kitchen team on today, live.'
                : undefined
          }
        />
      </div>
    </>
  );
}

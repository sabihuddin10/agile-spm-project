import type { StaffAnalytics, WorkSummary } from '@/types';
import { money } from '@/lib/format';
import { hoursText, projectedPay, ratePct } from '@/components/workforce/workforce-format';
import { WORKFORCE_CHART_COLORS } from '@/components/workforce/chart-tokens';

type RingTone = 'neutral' | 'warning';

const ARC: Record<RingTone, string> = {
  neutral: WORKFORCE_CHART_COLORS.label,
  warning: WORKFORCE_CHART_COLORS.warning, // below target
};

/**
 * Circular progress ring (SVG). Exposed to assistive tech as one image whose
 * label carries the numbers, e.g. "Hours this month: 62.5 of 140 h".
 */
export function ProgressRing({
  value,
  max,
  ariaLabel,
  center,
  size = 72,
  stroke = 7,
  tone = 'neutral',
}: {
  value: number;
  max: number;
  ariaLabel: string;
  /** Short text in the middle (e.g. '45%'); omitted on mini rings. */
  center?: string;
  size?: number;
  stroke?: number;
  tone?: RingTone;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const fraction = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={ariaLabel} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={WORKFORCE_CHART_COLORS.track} strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={ARC[tone]}
        strokeWidth={stroke}
        strokeLinecap={fraction > 0 ? 'round' : 'butt'}
        strokeDasharray={`${c * fraction} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      {center ? (
        <text
          x="50%"
          y="50%"
          dominantBaseline="central"
          textAnchor="middle"
          className="fill-stone-800 text-[13px] font-semibold tabular-nums"
          aria-hidden="true"
        >
          {center}
        </text>
      ) : null}
    </svg>
  );
}

/** Below this the on-time and attendance rings switch to the warning colour. */
export const RATE_TARGET = 0.9;

export interface RingSpec {
  key: string;
  title: string;
  value: number;
  max: number;
  center: string;
  detail: string;
  ariaLabel: string;
  tone: RingTone;
}

/** Hours vs scheduled, on-time rate, attendance rate and (when pay is visible) pay so far vs projected. */
export function ringSpecs(summary: WorkSummary, data?: Pick<StaffAnalytics, 'pay' | 'shifts'> | null): RingSpec[] {
  const noSessions = summary.shiftsWorked === 0 && summary.lateCount === 0;
  const due = summary.shiftsWorked + summary.shiftsMissed;
  const specs: RingSpec[] = [
    {
      key: 'hours',
      title: 'Hours',
      value: summary.paidMinutes,
      max: summary.scheduledMinutes,
      center: summary.scheduledMinutes ? ratePct(summary.paidMinutes / summary.scheduledMinutes) : '—',
      detail: `${hoursText(summary.paidMinutes)} paid of ${hoursText(summary.scheduledMinutes)} scheduled`,
      ariaLabel: `Hours: ${hoursText(summary.paidMinutes)} paid of ${hoursText(summary.scheduledMinutes)} scheduled`,
      tone: 'neutral',
    },
    {
      key: 'ontime',
      title: 'On time',
      value: summary.onTimeRate,
      max: 1,
      center: noSessions ? '—' : ratePct(summary.onTimeRate),
      detail: noSessions
        ? 'No check-ins yet'
        : `${summary.lateCount} late arrival${summary.lateCount === 1 ? '' : 's'}${summary.lateMinutes ? `, ${summary.lateMinutes} min in total` : ''}`,
      ariaLabel: noSessions
        ? 'On time: no check-ins yet'
        : `On time: ${ratePct(summary.onTimeRate)}, ${summary.lateCount} late arrival${summary.lateCount === 1 ? '' : 's'}`,
      tone: !noSessions && summary.onTimeRate < RATE_TARGET ? 'warning' : 'neutral',
    },
    {
      key: 'attendance',
      title: 'Attendance',
      value: summary.attendanceRate,
      max: 1,
      center: due ? ratePct(summary.attendanceRate) : '—',
      detail: due ? `${summary.shiftsWorked} of ${due} shifts worked, ${summary.shiftsMissed} missed` : 'No shifts due yet',
      ariaLabel: due
        ? `Attendance: ${ratePct(summary.attendanceRate)}, ${summary.shiftsWorked} of ${due} shifts worked, ${summary.shiftsMissed} missed`
        : 'Attendance: no shifts due yet',
      tone: due && summary.attendanceRate < RATE_TARGET ? 'warning' : 'neutral',
    },
  ];
  const pay = data?.pay;
  if (pay && data) {
    const projected = projectedPay(data) ?? pay.net;
    specs.push({
      key: 'pay',
      title: 'Pay so far',
      value: Math.max(0, pay.net),
      max: Math.max(projected, pay.net, 0),
      center: projected > 0 ? ratePct(Math.max(0, pay.net) / projected) : '—',
      detail: `${money(pay.net)} of ${money(projected)} projected`,
      ariaLabel: `Pay so far: ${money(pay.net)} of ${money(projected)} projected`,
      tone: 'neutral',
    });
  }
  return specs;
}

/** Row of rings. One per row on phones, each as a compact ring + text line. */
export function WorkRings({
  summary,
  data,
  periodLabel,
}: {
  summary: WorkSummary;
  data?: Pick<StaffAnalytics, 'pay' | 'shifts'> | null;
  periodLabel: string;
}) {
  const specs = ringSpecs(summary, data);
  return (
    <section aria-label={`Progress for ${periodLabel}`}>
      <ul className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${specs.length === 4 ? 'xl:grid-cols-4' : 'xl:grid-cols-3'}`}>
        {specs.map((s) => (
          <li key={s.key} className="card flex items-center gap-4 !p-4">
            <ProgressRing value={s.value} max={s.max} center={s.center} ariaLabel={s.ariaLabel} tone={s.tone} />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{s.title}</p>
              <p className="mt-0.5 text-sm text-stone-700">{s.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

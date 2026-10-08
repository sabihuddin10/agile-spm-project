/**
 * Monthly pay (pure functions, no store access).
 *
 *   base = paid hours × hourly wage
 *   net  = base + tips + bonuses − late penalties
 *
 * Money is rounded to 2 decimals (via cents). A month's pay is an estimate
 * until the month has ended.
 */
import { toCents, fromCents } from './order-math.js';
import { localDate } from './time.js';

/** Default hourly wage by role, for staff created without one. */
export const DEFAULT_WAGES = Object.freeze({ waiter: 12, chef: 15, manager: 20, admin: 25 });

export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export const round2 = (n) => fromCents(toCents(n));

export function wageOf(user) {
  return Number.isFinite(user?.hourlyWage) ? user.hourlyWage : DEFAULT_WAGES[user?.role] ?? 0;
}

/** { from, to } dates of a 'YYYY-MM' month. */
export function monthRange(month) {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
}

/**
 * Tips a waiter earned in a month: the tips on paid bills they were the waiter
 * for (falling back to who served it), dated by payment time. Refunded and
 * unpaid bills earn nothing.
 */
export function monthTips(orders, userId, month) {
  const cents = orders
    .filter((o) => o.paymentStatus === 'paid' && o.paidAt && (o.waiterId ?? o.servedBy) === userId)
    .filter((o) => localDate(new Date(o.paidAt)).startsWith(month))
    .reduce((sum, o) => sum + toCents(o.tip), 0);
  return fromCents(cents);
}

/**
 * PayBreakdown for one person and month.
 * `lateSessions` are { date, lateMinutes } of late sessions in the month;
 * `adjustments` are the month's bonuses / deductions.
 */
export function payBreakdown({ month, hourlyWage, paidMinutes, tips = 0, adjustments = [], lateSessions = [], latePenalty = 5, today = localDate() }) {
  const paidHours = round2(paidMinutes / 60);
  const base = round2(paidHours * hourlyWage);
  const bonuses = adjustments
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((a) => ({ id: a.id, amount: round2(a.amount), reason: a.reason, date: a.date }));
  const bonusTotal = fromCents(bonuses.reduce((sum, b) => sum + toCents(b.amount), 0));
  const penalty = round2(latePenalty);
  const latePenalties = lateSessions
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((s) => ({ date: s.date, minutes: s.lateMinutes ?? 0, amount: penalty }));
  const latePenaltyTotal = fromCents(latePenalties.length * toCents(penalty));
  const net = fromCents(toCents(base) + toCents(tips) + toCents(bonusTotal) - toCents(latePenaltyTotal));
  return {
    month,
    hourlyWage: round2(hourlyWage),
    paidHours,
    base,
    tips: round2(tips),
    bonuses,
    bonusTotal,
    latePenalties,
    latePenaltyTotal,
    net,
    estimated: monthRange(month).to >= today,
  };
}

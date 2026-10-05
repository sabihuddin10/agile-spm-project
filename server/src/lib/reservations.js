/**
 * Reservation capacity, alternative-slot suggestions and table holds.
 *
 * A booking occupies a table for `reservationDurationMinutes`. A slot is
 * available for a party when every overlapping active booking (plus the new
 * one) can be seated at a distinct table large enough for it — tables already
 * assigned stay fixed, the rest are matched greedily largest-party-first to the
 * smallest table that fits.
 */
import { reservations, tables, settings, TIME_SLOTS } from '../data/store.js';
import { MINUTE, combine, localDate, addDays } from './time.js';

export const ACTIVE_BOOKING = ['requested', 'confirmed', 'seated'];

const startOf = (r) => combine(r.date, r.time).getTime();

function overlaps(r, date, time) {
  const duration = settings.reservationDurationMinutes * MINUTE;
  return r.date === date && Math.abs(startOf(r) - combine(date, time).getTime()) < duration;
}

export function canAccommodate({ date, time, partySize, tableId = null }, excludeId = null) {
  const others = reservations.filter(
    (r) => r.id !== excludeId && ACTIVE_BOOKING.includes(r.status) && overlaps(r, date, time),
  );
  const candidate = { id: '__new__', partySize: Number(partySize), tableId };
  const bookings = [...others, candidate];

  const taken = new Set(others.filter((b) => b.tableId).map((b) => b.tableId));
  if (tableId) {
    const t = tables.find((x) => x.id === tableId);
    if (!t || t.seats < candidate.partySize || taken.has(tableId)) return false;
    taken.add(tableId);
  }

  const unassigned = bookings.filter((b) => !b.tableId).sort((a, b) => b.partySize - a.partySize);
  for (const b of unassigned) {
    const fit = tables
      .filter((t) => !taken.has(t.id) && t.seats >= b.partySize)
      .sort((x, y) => x.seats - y.seats)[0];
    if (!fit) return false;
    taken.add(fit.id);
  }
  return true;
}

function slotIsPast(date, time, now = new Date()) {
  return combine(date, time).getTime() < now.getTime();
}

/** Every slot for a date with its availability for the given party size. */
export function availability(date, partySize) {
  return TIME_SLOTS.map((time) => ({
    time,
    available: !slotIsPast(date, time) && canAccommodate({ date, time, partySize }),
  }));
}

/** Up to `limit` open slots nearest the requested time (same day, then next day). */
export function suggestAlternatives(date, time, partySize, limit = 3) {
  const target = combine(date, time).getTime();
  const nextDay = localDate(addDays(combine(date, '12:00'), 1));
  const options = [date, nextDay].flatMap((d) =>
    availability(d, partySize)
      .filter((s) => s.available && !(d === date && s.time === time))
      .map((s) => ({ date: d, time: s.time, distance: Math.abs(combine(d, s.time).getTime() - target) })),
  );
  return options
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit)
    .map(({ date: d, time: t }) => ({ date: d, time: t }));
}

/**
 * Hold tables for confirmed bookings: a table shows 'reserved' from one hour
 * before the booking until it ends, and is released when the booking is
 * seated, cancelled or marked no-show (US7.3, US7.4).
 */
export function syncTableHolds(now = Date.now()) {
  const duration = settings.reservationDurationMinutes * MINUTE;
  for (const t of tables) {
    const booking = reservations.find((r) => {
      if (r.tableId !== t.id || r.status !== 'confirmed') return false;
      const start = startOf(r);
      return now >= start - 60 * MINUTE && now <= start + duration;
    });
    if (booking && t.status === 'free') {
      t.status = 'reserved';
      t.reservedFor = booking.id;
    } else if (!booking && t.status === 'reserved' && t.reservedFor) {
      t.reservedFor = null;
      if (!t.held) t.status = 'free';
    }
  }
}

/** Release a table held for this booking (cancellation / no-show). */
export function releaseHold(reservation) {
  const t = tables.find((x) => x.id === reservation.tableId);
  if (t && t.reservedFor === reservation.id) {
    t.reservedFor = null;
    if (!t.held) t.status = 'free';
  }
}

/** True once a confirmed booking is past its grace period without check-in. */
export function isLate(reservation, now = Date.now()) {
  return (
    reservation.status === 'confirmed' &&
    now > startOf(reservation) + settings.reservationGraceMinutes * MINUTE
  );
}

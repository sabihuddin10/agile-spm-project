/** Local-time date helpers. Dates are 'YYYY-MM-DD', times are 'HH:MM' (server local time). */

export const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;

export function pad(n) {
  return String(n).padStart(2, '0');
}

export function localDate(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function localTime(d = new Date()) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Combine a 'YYYY-MM-DD' date and 'HH:MM' time into a local Date. */
export function combine(date, time) {
  const [y, m, d] = String(date).split('-').map(Number);
  const [h, min] = String(time).split(':').map(Number);
  return new Date(y, m - 1, d, h || 0, min || 0);
}

export function addDays(d, n) {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

export function isValidDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value)) && !Number.isNaN(combine(value, '00:00').getTime());
}

export function isValidTime(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value));
}

/** Monday of the week containing `d`, as 'YYYY-MM-DD'. */
export function weekStart(d) {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const offset = (out.getDay() + 6) % 7;
  out.setDate(out.getDate() - offset);
  return localDate(out);
}

export function iso(d = new Date()) {
  return d.toISOString();
}

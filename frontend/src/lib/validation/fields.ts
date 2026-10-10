/**
 * Field validators for the public, customer and account forms. Each takes the
 * raw input and returns an error message, or undefined when the value is fine.
 * The limits match the server's (server/src/lib/validate.js).
 */

export const NAME_MAX = 80;
export const EMAIL_MAX = 254;
export const PHONE_MIN_DIGITS = 7;
export const PHONE_MAX_DIGITS = 20;
export const PHONE_MAX = 30;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+()\-.\s]*$/;
/** Letters (any script, with combining marks), spaces, apostrophes (straight or curly), hyphens, full stops. */
// Built with RegExp() because the TS target predates the `u` flag in literals; every supported browser has it.
const NAME_CHARS_RE = new RegExp("^[\\p{L}\\p{M}' ’.-]+$", 'u');
const LETTER_RE = new RegExp('\\p{L}', 'u');
const LETTERS_RE = new RegExp('\\p{L}', 'gu');
const NAME_MIN_LETTERS = 3;
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u001F\u007F]/;

export type FieldValidator<T = string> = (value: T) => string | undefined;

export function validateRequired(value: string, message = 'This field is required.'): string | undefined {
  return value.trim() ? undefined : message;
}

/** Trim and collapse runs of whitespace — how a person's name is sent to the server. */
export function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

/**
 * A person's name: at most 80 characters of letters, spaces and ' - . only, and
 * either two or more words or at least three letters ("Li Na" and "Ana" pass,
 * "SS" does not).
 */
export function validateName(value: string, { required = true, missing = 'Please enter your name.' } = {}): string | undefined {
  const clean = normalizeName(value);
  if (!clean) return required ? missing : undefined;
  if (clean.length > NAME_MAX) return `Keep it to ${NAME_MAX} characters or fewer.`;
  if (CONTROL_RE.test(clean)) return 'Remove the unsupported characters.';
  if (!NAME_CHARS_RE.test(clean)) return 'Use letters, spaces, apostrophes, hyphens and full stops only.';
  const words = clean.split(' ').filter((w) => LETTER_RE.test(w)).length;
  const letters = (clean.match(LETTERS_RE) ?? []).length;
  if (words < 2 && letters < NAME_MIN_LETTERS) return 'Enter a full name: at least 3 letters, or a first and last name.';
  return undefined;
}

export function isValidEmail(value: string): boolean {
  const clean = value.trim();
  return clean.length <= EMAIL_MAX && EMAIL_RE.test(clean);
}

export function validateEmail(value: string, { required = true, missing = 'Please enter your email address.' } = {}): string | undefined {
  const clean = value.trim();
  if (!clean) return required ? missing : undefined;
  if (clean.length > EMAIL_MAX) return `Email addresses are at most ${EMAIL_MAX} characters.`;
  if (!EMAIL_RE.test(clean)) return 'Enter an email address like name@example.com.';
  return undefined;
}

/** Digits, spaces, + ( ) - . with 7–20 digits. Optional unless `required`. */
export function validatePhone(value: string, { required = false } = {}): string | undefined {
  const clean = value.trim();
  if (!clean) return required ? 'Please enter a phone number.' : undefined;
  if (!PHONE_RE.test(clean)) return 'Use digits, spaces and + ( ) - . only.';
  const digits = clean.replace(/\D/g, '').length;
  if (digits < PHONE_MIN_DIGITS || digits > PHONE_MAX_DIGITS || clean.length > PHONE_MAX) {
    return `Phone numbers have ${PHONE_MIN_DIGITS} to ${PHONE_MAX_DIGITS} digits.`;
  }
  return undefined;
}

export function validateMaxLength(value: string, max: number, label = 'This'): string | undefined {
  return value.length > max ? `${label} can be at most ${max} characters (${value.length} now).` : undefined;
}

/** An order can have at most 50 distinct lines (MAX_LINES in server/src/routes/orders.js). */
export const MAX_ORDER_LINES = 50;
export const ORDER_LINES_FULL = `An order can have at most ${MAX_ORDER_LINES} different dishes. Add to an existing line or place a second order.`;

export const CONTACT_MISSING = 'Add an email or phone so we can reach them.';

/** At least one way to reach someone: returns CONTACT_MISSING when both are blank. */
export function validateContact(email: string, phone: string): string | undefined {
  return email.trim() || phone.trim() ? undefined : CONTACT_MISSING;
}

/** A number within [min, max] (decimals allowed). Blank counts as missing unless `required` is false. */
export function validateNumberInRange(
  value: number | string,
  min: number,
  max: number,
  label = 'This',
  { required = true } = {},
): string | undefined {
  const blank = typeof value === 'string' && value.trim() === '';
  if (blank) return required ? `${label} is required.` : undefined;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return `${label} must be a number.`;
  if (n < min || n > max) return `${label} must be between ${min.toLocaleString('en-US')} and ${max.toLocaleString('en-US')}.`;
  return undefined;
}

/** A whole number within [min, max]. Accepts numbers or numeric strings. */
export function validateIntegerInRange(value: number | string, min: number, max: number, label = 'This'): string | undefined {
  const n = typeof value === 'number' ? value : value.trim() === '' ? NaN : Number(value);
  if (!Number.isInteger(n)) return `${label} must be a whole number.`;
  if (n < min || n > max) return `${label} must be between ${min} and ${max}.`;
  return undefined;
}

/** A 'YYYY-MM-DD' date that is today (`today`, same format) or later. */
export function validateFutureDate(value: string, today: string): string | undefined {
  if (!value) return 'Please choose a date.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Choose a valid date.';
  if (today && value < today) return 'Please choose today or a later date.';
  return undefined;
}

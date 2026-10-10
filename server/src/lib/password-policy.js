/**
 * Password policy — the one place the server decides what a new password must
 * look like. It applies whenever a password is set (registration, changing your
 * own, an admin setting one, generated temporary passwords), never at sign-in,
 * so the seeded demo accounts keep signing in with "password".
 *
 * The web app mirrors these rules in frontend/src/lib/validation/password.ts.
 */
import crypto from 'node:crypto';

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

/** Printable ASCII that is not a letter or digit, plus any non-ASCII symbol. */
const SPECIAL_RE = /[^A-Za-z0-9\s]/;

/** Very common passwords (compared case-insensitively). */
export const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password12', 'password123', 'password1!', 'password!', 'passw0rd', 'passw0rd!', 'p@ssword',
  'p@ssw0rd', 'p@ssw0rd!', 'p@ssword1', '12345678', '123456789', '1234567890', '87654321', '11111111', '00000000',
  'qwerty12', 'qwerty123', 'qwerty1!', 'qwertyuiop', 'asdfghjk', 'abc12345', 'abcd1234', 'abcd1234!', 'iloveyou',
  'iloveyou1', 'letmein1', 'letmein!', 'welcome1', 'welcome1!', 'welcome123', 'admin123', 'admin123!', 'administrator',
  'changeme', 'changeme1', 'changeme!', 'sunshine1', 'football1', 'baseball1', 'monkey123', 'dragon123', 'trustno1',
  'master123', 'superman1', 'qazwsx123', '1q2w3e4r', '1q2w3e4r!', 'zaq12wsx', 'test1234', 'test1234!', 'restaurant1',
]);

/**
 * The character rules shown as a live checklist. `test` receives the raw
 * password. Messages read as "Password needs: …".
 */
export const PASSWORD_RULES = [
  { id: 'length', label: `At least ${PASSWORD_MIN} characters`, message: `at least ${PASSWORD_MIN} characters`, test: (pw) => pw.length >= PASSWORD_MIN },
  { id: 'lower', label: 'A lowercase letter', message: 'a lowercase letter', test: (pw) => /[a-z]/.test(pw) },
  { id: 'upper', label: 'An uppercase letter', message: 'an uppercase letter', test: (pw) => /[A-Z]/.test(pw) },
  { id: 'number', label: 'A number', message: 'a number', test: (pw) => /[0-9]/.test(pw) },
  { id: 'special', label: 'A special character (e.g. ! ? # @)', message: 'a special character (e.g. ! ? # @)', test: (pw) => SPECIAL_RE.test(pw) },
];

const norm = (value) => String(value ?? '').trim().toLowerCase();

/**
 * Every rule `password` fails, as short messages (empty when it passes).
 * `email` and `name` are the account's, so the password cannot simply repeat them.
 */
export function checkPassword(password, { email, name } = {}) {
  if (typeof password !== 'string') return ['a password (text)'];
  const problems = PASSWORD_RULES.filter((r) => !r.test(password)).map((r) => r.message);
  if (password.length > PASSWORD_MAX) problems.push(`at most ${PASSWORD_MAX} characters`);
  const lower = password.toLowerCase();
  const mail = norm(email);
  const personal = [mail, mail.split('@')[0], norm(name), norm(name).replace(/\s+/g, '')].filter((v) => v.length >= 3);
  if (personal.includes(lower)) problems.push('to be different from your email and name');
  if (COMMON_PASSWORDS.has(lower)) problems.push('to be less common (that one is on a list of frequently used passwords)');
  return problems;
}

/** One sentence for a 400 response, or null when the password is acceptable. */
export function passwordError(password, account) {
  const problems = checkPassword(password, account);
  return problems.length ? `Password needs: ${problems.join(', ')}.` : null;
}

// Look-alike characters (0/O, 1/l/I) are left out so a temporary password can be read aloud.
const LOWER = 'abcdefghijkmnpqrstuvwxyz';
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '23456789';
const SYMBOLS = '!@#$%*?-_';
const ALL = LOWER + UPPER + DIGITS + SYMBOLS;

const pick = (chars) => chars[crypto.randomInt(chars.length)];

/** A random 12-character temporary password that always satisfies the policy. */
export function generateTempPassword(length = 12) {
  const chars = [pick(LOWER), pick(UPPER), pick(DIGITS), pick(SYMBOLS)];
  while (chars.length < length) chars.push(pick(ALL));
  // Fisher–Yates so the guaranteed characters are not always first.
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

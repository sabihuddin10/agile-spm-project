/**
 * Password policy for the web app. Mirrors server/src/lib/password-policy.js —
 * change both together. The server is the authority; these rules exist so
 * people see what is missing while they type instead of after submitting.
 */

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

export type PasswordRuleId = 'length' | 'lower' | 'upper' | 'number' | 'special';

export interface PasswordRule {
  id: PasswordRuleId;
  /** Checklist wording, e.g. "At least 8 characters". */
  label: string;
  test: (password: string) => boolean;
}

const SPECIAL_RE = /[^A-Za-z0-9\s]/;

export const PASSWORD_RULES: PasswordRule[] = [
  { id: 'length', label: `At least ${PASSWORD_MIN} characters`, test: (pw) => pw.length >= PASSWORD_MIN },
  { id: 'lower', label: 'A lowercase letter', test: (pw) => /[a-z]/.test(pw) },
  { id: 'upper', label: 'An uppercase letter', test: (pw) => /[A-Z]/.test(pw) },
  { id: 'number', label: 'A number', test: (pw) => /[0-9]/.test(pw) },
  { id: 'special', label: 'A special character (e.g. ! ? # @)', test: (pw) => SPECIAL_RE.test(pw) },
];

/** Very common passwords, compared case-insensitively (same list as the server). */
export const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password12', 'password123', 'password1!', 'password!', 'passw0rd', 'passw0rd!', 'p@ssword',
  'p@ssw0rd', 'p@ssw0rd!', 'p@ssword1', '12345678', '123456789', '1234567890', '87654321', '11111111', '00000000',
  'qwerty12', 'qwerty123', 'qwerty1!', 'qwertyuiop', 'asdfghjk', 'abc12345', 'abcd1234', 'abcd1234!', 'iloveyou',
  'iloveyou1', 'letmein1', 'letmein!', 'welcome1', 'welcome1!', 'welcome123', 'admin123', 'admin123!', 'administrator',
  'changeme', 'changeme1', 'changeme!', 'sunshine1', 'football1', 'baseball1', 'monkey123', 'dragon123', 'trustno1',
  'master123', 'superman1', 'qazwsx123', '1q2w3e4r', '1q2w3e4r!', 'zaq12wsx', 'test1234', 'test1234!', 'restaurant1',
]);

export interface PasswordContext {
  email?: string;
  name?: string;
}

export interface PasswordCheck {
  /** Each checklist rule and whether it is met. */
  rules: { id: PasswordRuleId; label: string; met: boolean }[];
  metCount: number;
  /** Problems outside the checklist (too long, matches your email/name, too common). */
  extra: string[];
  /** True when every rule passes and there are no extra problems. */
  valid: boolean;
}

const norm = (value?: string) => (value ?? '').trim().toLowerCase();

export function checkPassword(password: string, { email, name }: PasswordContext = {}): PasswordCheck {
  const rules = PASSWORD_RULES.map((r) => ({ id: r.id, label: r.label, met: r.test(password) }));
  const metCount = rules.filter((r) => r.met).length;
  const extra: string[] = [];
  if (password.length > PASSWORD_MAX) extra.push(`Use at most ${PASSWORD_MAX} characters.`);
  const lower = password.toLowerCase();
  const mail = norm(email);
  const personal = [mail, mail.split('@')[0], norm(name), norm(name).replace(/\s+/g, '')].filter((v) => v.length >= 3);
  if (password && personal.includes(lower)) extra.push("Don't use your email or name as your password.");
  if (COMMON_PASSWORDS.has(lower)) extra.push('That password is too common. Choose something harder to guess.');
  return { rules, metCount, extra, valid: metCount === rules.length && extra.length === 0 };
}

export type PasswordStrength = 'empty' | 'weak' | 'fair' | 'strong';

/**
 * Weak: misses rules (or is common / personal). Fair: meets every rule.
 * Strong: meets every rule and is 12+ characters long.
 */
export function passwordStrength(password: string, context: PasswordContext = {}): PasswordStrength {
  if (!password) return 'empty';
  const { valid } = checkPassword(password, context);
  if (!valid) return 'weak';
  return password.length >= 12 ? 'strong' : 'fair';
}

/** One message for a field error, or undefined when the password is acceptable. */
export function passwordError(password: string, context: PasswordContext = {}): string | undefined {
  if (!password) return 'Choose a password.';
  const { valid, extra } = checkPassword(password, context);
  if (valid) return undefined;
  return extra[0] ?? 'Your password does not meet all the requirements yet.';
}

/** Error for a "confirm password" field. */
export function confirmError(password: string, confirm: string): string | undefined {
  if (!confirm) return 'Type the password again to confirm it.';
  if (confirm !== password) return "Passwords don't match.";
  return undefined;
}

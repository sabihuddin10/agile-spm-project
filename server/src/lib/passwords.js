/**
 * Password hashing: the one place that knows how passwords are hashed and checked. Everything that
 * creates or verifies a password hash (registration, changing and resetting passwords, the seed data,
 * the super admin script) goes through here, so the work factor is set in one spot.
 *
 * bcrypt cost: 2^cost rounds of work per hash. The default (10) is what every existing hash uses. Set
 * BCRYPT_COST (10 to 14) to make new hashes more expensive to crack; accounts are upgraded to the new
 * cost the next time their owner signs in (see needsRehash). A missing, non-numeric or out-of-range
 * value falls back to a safe bound instead of failing, so a typo can neither weaken hashing below the
 * default nor make every sign-in take seconds.
 */
import bcrypt from 'bcryptjs';
import { PASSWORD_MAX } from './password-policy.js';

export const DEFAULT_BCRYPT_COST = 10;
export const MIN_BCRYPT_COST = 10;
export const MAX_BCRYPT_COST = 14;

/** The cost new hashes are made with. */
export function bcryptCost(env = process.env) {
  const raw = Number.parseInt(String(env.BCRYPT_COST ?? '').trim(), 10);
  if (!Number.isInteger(raw)) return DEFAULT_BCRYPT_COST;
  return Math.min(Math.max(raw, MIN_BCRYPT_COST), MAX_BCRYPT_COST);
}

/** Hash a password for storage. */
export function hashPassword(password, env = process.env) {
  return bcrypt.hashSync(password, bcryptCost(env));
}

/**
 * True when a stored hash was made with less work than is configured now, so it can be replaced the next time
 * the user proves they know the password. Unreadable hashes count as needing a rehash.
 */
export function needsRehash(hash, env = process.env) {
  try {
    const rounds = bcrypt.getRounds(hash);
    // getRounds answers NaN, not an error, for text that is not a bcrypt hash.
    return !Number.isInteger(rounds) || rounds < bcryptCost(env);
  } catch {
    return true;
  }
}

// An unknown email is checked against this, so signing in with it costs the same as a real account.
const DUMMY_HASH = hashPassword('unused-login-placeholder');

export function passwordMatches(user, password) {
  return typeof password === 'string' && password.length <= PASSWORD_MAX
    && bcrypt.compareSync(password, user?.passwordHash ?? DUMMY_HASH);
}

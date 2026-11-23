/**
 * Bind the super admin role (lib/hierarchy.js) to one account in the in-memory
 * store. scripts/superadmin.js runs this on a database (data/superadmin.js);
 * the API itself never assigns the role.
 */
import { hashPassword } from './passwords.js';
import { users, findUserByEmail, createUser, sanitizeUser } from '../data/store.js';
import { email as readEmail, personName } from './validate.js';
import { passwordError } from './password-policy.js';

/**
 * Make the account with `email` the super admin, with `password`. An existing
 * account is promoted and reactivated; with no account, one is created from
 * `name`. Every bind sets the new password and ends the account's sessions:
 * registration has no email verification and the bound email is public, so an
 * account someone created with it beforehand (or a seed password) must never
 * become the super admin's credential. Every other super admin becomes an admin
 * and is signed out. Input is checked before anything changes.
 *
 * Returns { user (sanitized), created, demoted (emails of former holders) }.
 */
export function bindSuperadmin({ email, name, password } = {}) {
  const address = readEmail(email);
  const existing = findUserByEmail(address);
  const fullName = existing ? existing.name : personName(name);
  if (typeof password !== 'string' || !password) throw new Error('A password is required to bind the super admin.');
  const weak = passwordError(password, { email: address, name: fullName });
  if (weak) throw new Error(weak);

  const demoted = users.filter((u) => u.role === 'superadmin' && u !== existing);
  for (const u of demoted) {
    u.role = 'admin';
    u.tokenVersion = (u.tokenVersion ?? 0) + 1;
  }

  const user = existing ?? createUser({ name: fullName, email: address, password, role: 'superadmin' });
  if (existing) {
    user.passwordHash = hashPassword(password);
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  }
  user.role = 'superadmin';
  user.active = true;
  user.mustChangePassword = false;
  return { user: sanitizeUser(user), created: !existing, demoted: demoted.map((u) => u.email) };
}

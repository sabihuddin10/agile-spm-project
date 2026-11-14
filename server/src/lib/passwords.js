import bcrypt from 'bcryptjs';
import { PASSWORD_MAX } from './password-policy.js';

// Match the work done for a real account even when the email is unknown.
const DUMMY_HASH = bcrypt.hashSync('unused-login-placeholder', 10);

export function passwordMatches(user, password) {
  return typeof password === 'string' && password.length <= PASSWORD_MAX
    && bcrypt.compareSync(password, user?.passwordHash ?? DUMMY_HASH);
}

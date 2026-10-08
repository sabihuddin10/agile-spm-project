import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'dev-insecure-secret-change-me';
const EXPIRES_IN = '12h';

export function signToken(user) {
  // `tv` (token version) lets a password change or reset revoke older tokens.
  return jwt.sign({ sub: user.id, role: user.role, tv: user.tokenVersion ?? 0 }, SECRET, { expiresIn: EXPIRES_IN });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}

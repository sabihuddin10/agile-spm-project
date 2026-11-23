import jwt from 'jsonwebtoken';

const DEV_SECRET = 'dev-insecure-secret-change-me';
export const SESSION_TTL_MS = 12 * 60 * 60_000;

export function signingSecret() {
  const secret = process.env.JWT_SECRET?.trim();
  if (process.env.NODE_ENV === 'production' && (!secret || secret === DEV_SECRET)) {
    throw new Error('JWT_SECRET must be configured for production.');
  }
  return secret || DEV_SECRET;
}

export function signToken(user) {
  // `tv` (token version) lets a password change or reset revoke older tokens.
  return jwt.sign({ sub: user.id, role: user.role, tv: user.tokenVersion ?? 0 }, signingSecret(), {
    algorithm: 'HS256', expiresIn: SESSION_TTL_MS / 1000,
  });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, signingSecret(), { algorithms: ['HS256'] });
  } catch {
    return null;
  }
}

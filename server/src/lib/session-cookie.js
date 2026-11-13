import { SESSION_TTL_MS, signToken } from './jwt.js';

const NAME = 'restaurant_ops_session';
const options = () => ({ httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/api' });

export function sessionCookie(req) {
  const prefix = `${NAME}=`;
  const cookies = (req.headers.cookie || '').split(';').map((part) => part.trim());
  return cookies.find((part) => part.startsWith(prefix))?.slice(prefix.length);
}

export function setSession(res, user) {
  res.cookie(NAME, signToken(user), { ...options(), maxAge: SESSION_TTL_MS });
}

export function clearSession(res) {
  res.clearCookie(NAME, options());
}

export function protectCookieWrites(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || sessionCookie(req) === undefined) return next();
  return requireBrowserHeader(req, res, next);
}

// Also protect sign-in and registration, which can set a cookie on a guest request.
export function protectSessionIssuance(req, res, next) {
  if (!req.headers.origin) return next();
  return requireBrowserHeader(req, res, next);
}

function requireBrowserHeader(req, res, next) {
  if (req.headers['x-requested-with'] === 'RestaurantOps') return next();
  return res.status(403).json({ error: 'Missing browser request header.' });
}

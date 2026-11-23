/**
 * Where the web app sends /api/* traffic. One validator, used by next.config.mjs (the rewrite) and the
 * /api/health route, so the two can never disagree about the API address.
 *
 * - Development and tests: API_URL is optional and defaults to the local API.
 * - Production (NODE_ENV=production, which `next build` and `next start` set, or VERCEL_ENV=production):
 *   API_URL is required and must be an https origin that is not this machine. A missing value used to fall
 *   back to localhost silently and produce a deployed site that cannot reach its API.
 * - Always: a valid absolute http(s) URL with no username, password, path, query or fragment. Only the
 *   origin is accepted ("https://api.example.com", optionally with a trailing slash).
 * - ALLOW_LOCAL_API=1 opts out of the production rules for a production build that is deliberately local
 *   (CI's build step, the browser tests, `pnpm build` on a laptop). It is ignored on Vercel Production
 *   (VERCEL_ENV=production), where the rules always apply.
 *
 * Errors name the setting and the fix, and never print the configured value: it may carry credentials.
 */

export const LOCAL_API_URL = 'http://localhost:4000';

const LOOPBACK = /^(localhost|.*\.localhost|0\.0\.0\.0|127(\.\d{1,3}){3}|\[?::1?\]?)$/i;

/**
 * @param {Record<string, string | undefined>} [env]
 * @returns {string} the API origin without a trailing slash, e.g. "https://api.example.com"
 */
export function resolveApiOrigin(env = process.env) {
  const onVercelProduction = env.VERCEL_ENV === 'production';
  const strict = onVercelProduction || (env.NODE_ENV === 'production' && env.ALLOW_LOCAL_API !== '1');
  const raw = env.API_URL?.trim();

  if (!raw) {
    if (strict) {
      throw new Error(
        'API_URL is not set. A production build needs the API\'s https URL, for example '
        + 'https://your-api.vercel.app. Set it in the web project\'s environment variables '
        + '(for a deliberately local production build, set ALLOW_LOCAL_API=1).',
      );
    }
    return LOCAL_API_URL;
  }

  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('API_URL is not a valid URL. Use a full URL such as https://your-api.vercel.app.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('API_URL must start with http:// or https://.');
  }
  if (url.username || url.password) {
    throw new Error('API_URL must not contain a username or password.');
  }
  if (url.pathname !== '/' || url.search || url.hash) {
    throw new Error('API_URL must be an origin only, with no path, query or fragment, for example https://your-api.vercel.app.');
  }
  if (strict) {
    if (url.protocol !== 'https:') {
      throw new Error('API_URL must use https:// in production.');
    }
    if (LOOPBACK.test(url.hostname)) {
      throw new Error(
        'API_URL points at this machine (localhost) but this is a production build. '
        + 'Use the API\'s public https URL (for a deliberately local production build, set ALLOW_LOCAL_API=1).',
      );
    }
  }
  return url.origin;
}

/** The name the same function has on `main`; kept so both names work. */
export const apiOrigin = resolveApiOrigin;

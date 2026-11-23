const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0']);
const DEV_SECRET = 'dev-insecure-secret-change-me';
export const MIN_SECRET_LENGTH = 32;

function isLocalHost(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return LOCAL_HOSTS.has(host) || host.endsWith('.localhost') || /^127(?:\.\d{1,3}){3}$/.test(host);
}

/**
 * Fail fast on deployment configuration without including any secret values. Runs when the API starts.
 *
 * Two kinds of rule, because this runs on a live API that must not be taken down by a setting nobody
 * has been able to check:
 *
 *  - Always refuse to start (these were already enforced before this check existed, or can never work):
 *      JWT_SECRET missing or the built-in development secret; DATABASE_URL that is set but malformed,
 *      not PostgreSQL, or pointing at this machine.
 *  - Warn loudly, but keep running, unless STRICT_PRODUCTION_CONFIG=1 (then they refuse to start too):
 *      JWT_SECRET shorter than 32 characters; DATABASE_URL not set at all (data would live in memory and
 *      be lost on restart, and rate limits would not be shared).
 *
 * Set STRICT_PRODUCTION_CONFIG=1 on a deployment once its values are known to satisfy every rule.
 *
 * @param {Record<string, string | undefined>} [env]
 * @param {(message: string) => void} [log]  where warnings go
 * @returns {string[]} the warnings that were raised (empty when the configuration is fully compliant)
 */
export function validateProductionConfig(env = process.env, log = console.warn) {
  if (env.NODE_ENV !== 'production') return [];

  const strict = env.STRICT_PRODUCTION_CONFIG === '1';
  const warnings = [];
  /** Throws when strict; otherwise records a warning. */
  const softRule = (violation, warning) => {
    if (strict) throw new Error(violation);
    warnings.push(warning);
  };

  const secret = env.JWT_SECRET?.trim();
  if (!secret || secret === DEV_SECRET) {
    throw new Error('JWT_SECRET must be configured for production.');
  }
  if (secret.length < MIN_SECRET_LENGTH) {
    softRule(
      `JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters for production.`,
      `JWT_SECRET is shorter than ${MIN_SECRET_LENGTH} characters, which makes login tokens easier to guess. Set a longer random value (the API keeps running with this one; STRICT_PRODUCTION_CONFIG=1 makes it refuse to start).`,
    );
  }

  const configured = env.DATABASE_URL?.trim();
  if (!configured) {
    softRule(
      'DATABASE_URL must be configured for production.',
      'DATABASE_URL is not set, so this API keeps its data in memory (lost on every restart) and its rate limits are not shared between instances. Set it to a remote PostgreSQL database (STRICT_PRODUCTION_CONFIG=1 makes the API refuse to start without it).',
    );
  } else {
    let url;
    try {
      url = new URL(configured);
    } catch {
      throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL.');
    }
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname) {
      throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL.');
    }
    if (isLocalHost(url.hostname)) {
      throw new Error('DATABASE_URL must not point to localhost in production.');
    }
  }

  for (const warning of warnings) log(`[config] ${warning}`);
  return warnings;
}

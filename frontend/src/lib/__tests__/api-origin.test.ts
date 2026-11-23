/**
 * API origin validation (bolt 008): src/lib/api-origin.mjs, shared by next.config.mjs and the
 * /api/health route. A production build must fail early on a missing or unusable API_URL instead of
 * deploying a site that quietly proxies to localhost.
 */
import { afterEach, describe, expect, test, vi } from 'vitest';
import { LOCAL_API_URL, resolveApiOrigin } from '@/lib/api-origin.mjs';

const production = (extra: Record<string, string | undefined> = {}) => ({ NODE_ENV: 'production', ...extra });

describe('development and tests', () => {
  test('API_URL is optional and defaults to the local API', () => {
    // Arrange / Act
    const unset = resolveApiOrigin({ NODE_ENV: 'development' });
    const blank = resolveApiOrigin({ NODE_ENV: 'test', API_URL: '   ' });
    const noEnv = resolveApiOrigin({});

    // Assert
    expect(unset).toBe(LOCAL_API_URL);
    expect(blank).toBe(LOCAL_API_URL);
    expect(noEnv).toBe(LOCAL_API_URL);
  });

  test('a localhost or plain-http API_URL is accepted', () => {
    // Arrange / Act / Assert
    expect(resolveApiOrigin({ NODE_ENV: 'development', API_URL: 'http://localhost:4100' })).toBe('http://localhost:4100');
    expect(resolveApiOrigin({ NODE_ENV: 'development', API_URL: 'http://192.168.1.20:4000' })).toBe('http://192.168.1.20:4000');
  });

  test('a malformed or non-HTTP(S) value is still rejected, with a key-specific message', () => {
    // Arrange
    const bad = ['not a url', 'ftp://files.example.com', 'javascript:alert(1)', 'localhost:4000x/'];

    for (const API_URL of bad) {
      // Act / Assert
      expect(() => resolveApiOrigin({ NODE_ENV: 'development', API_URL }), API_URL).toThrow(/API_URL/);
    }
  });
});

describe('production', () => {
  test('a missing or blank API_URL fails with an actionable error', () => {
    // Arrange / Act / Assert
    expect(() => resolveApiOrigin(production())).toThrow(/API_URL is not set/);
    expect(() => resolveApiOrigin(production({ API_URL: '' }))).toThrow(/API_URL is not set/);
    expect(() => resolveApiOrigin(production({ API_URL: '   ' }))).toThrow(/API_URL is not set/);
    expect(() => resolveApiOrigin(production())).toThrow(/ALLOW_LOCAL_API=1/);
  });

  test('a valid https origin is accepted, with any trailing slash and surrounding space removed', () => {
    // Arrange / Act / Assert
    expect(resolveApiOrigin(production({ API_URL: 'https://plate-and-flame-api.vercel.app' }))).toBe('https://plate-and-flame-api.vercel.app');
    expect(resolveApiOrigin(production({ API_URL: 'https://plate-and-flame-api.vercel.app/' }))).toBe('https://plate-and-flame-api.vercel.app');
    expect(resolveApiOrigin(production({ API_URL: '  https://api.example.com:8443/  ' }))).toBe('https://api.example.com:8443');
  });

  test('only an origin is accepted: a path, query or fragment is rejected, in every environment', () => {
    // Arrange
    const withExtras = ['https://api.example.com/v1', 'https://api.example.com/?x=1', 'https://api.example.com/#frag', 'http://localhost:4000/api'];

    for (const API_URL of withExtras) {
      // Act / Assert
      expect(() => resolveApiOrigin(production({ API_URL })), API_URL).toThrow(/origin only/);
      expect(() => resolveApiOrigin({ NODE_ENV: 'development', API_URL }), API_URL).toThrow(/origin only/);
    }
  });

  test('a preview environment with its own explicit https API is accepted', () => {
    // Arrange / Act
    const origin = resolveApiOrigin(production({ API_URL: 'https://agspm-api-git-feature-team.vercel.app' }));

    // Assert
    expect(origin).toBe('https://agspm-api-git-feature-team.vercel.app');
  });

  test('plain http is rejected in production', () => {
    // Arrange / Act / Assert
    expect(() => resolveApiOrigin(production({ API_URL: 'http://api.example.com' }))).toThrow(/https:\/\/ in production/);
  });

  test('a localhost-style address is rejected, so production can never fall back to this machine', () => {
    // Arrange
    const local = [
      'https://localhost:4000',
      'https://LOCALHOST',
      'https://127.0.0.1:4000',
      'https://127.1.2.3',
      'https://0.0.0.0',
      'https://[::1]:4000',
      'https://api.localhost',
    ];

    for (const API_URL of local) {
      // Act / Assert
      expect(() => resolveApiOrigin(production({ API_URL })), API_URL).toThrow(/points at this machine/);
    }
  });

  test('a value that is not an http(s) URL is rejected', () => {
    // Arrange / Act / Assert
    expect(() => resolveApiOrigin(production({ API_URL: 'not a url' }))).toThrow(/not a valid URL/);
    expect(() => resolveApiOrigin(production({ API_URL: 'ftp://api.example.com' }))).toThrow(/http:\/\/ or https:\/\//);
  });

  test('credentials in the URL are rejected, and the error never reveals the value', () => {
    // Arrange
    const secret = 'hunter2-super-secret';

    // Act
    const run = () => resolveApiOrigin(production({ API_URL: `https://admin:${secret}@api.example.com` }));

    // Assert
    expect(run).toThrow(/username or password/);
    expect(run).not.toThrow(new RegExp(secret));
    try { run(); } catch (err) { expect(String((err as Error).message)).not.toContain(secret); }
  });

  test('errors for bad values never echo the configured value', () => {
    // Arrange
    const values = ['http://api.private.example.com', 'https://localhost:4000', 'https://token-in-host-abc123.localhost'];

    for (const API_URL of values) {
      // Act
      let message = '';
      try { resolveApiOrigin(production({ API_URL })); } catch (err) { message = (err as Error).message; }

      // Assert
      expect(message, API_URL).not.toBe('');
      expect(message).not.toContain(API_URL);
      // The rule may mention the word "localhost"; the configured host itself must not appear.
      const { hostname } = new URL(API_URL);
      if (hostname !== 'localhost') expect(message).not.toContain(hostname);
    }
  });
});

describe('Vercel Production', () => {
  test('is always strict, and ALLOW_LOCAL_API=1 cannot switch the rules off there', () => {
    // Arrange
    const vercel = (extra: Record<string, string | undefined> = {}) => ({ NODE_ENV: 'production', VERCEL_ENV: 'production', ALLOW_LOCAL_API: '1', ...extra });

    // Act / Assert
    expect(() => resolveApiOrigin(vercel())).toThrow(/API_URL is not set/);
    expect(() => resolveApiOrigin(vercel({ API_URL: 'http://localhost:4000' }))).toThrow(/https:\/\/ in production/);
    expect(() => resolveApiOrigin(vercel({ API_URL: 'https://localhost:4000' }))).toThrow(/points at this machine/);
    expect(resolveApiOrigin(vercel({ API_URL: 'https://api.example.com' }))).toBe('https://api.example.com');
  });

  test('applies even when NODE_ENV is not "production"', () => {
    // Arrange / Act / Assert
    expect(() => resolveApiOrigin({ NODE_ENV: 'development', VERCEL_ENV: 'production' })).toThrow(/API_URL is not set/);
  });

  test('a Preview build is strict too, so it needs its own https API_URL', () => {
    // Arrange / Act / Assert
    expect(() => resolveApiOrigin({ NODE_ENV: 'production', VERCEL_ENV: 'preview' })).toThrow(/API_URL is not set/);
    expect(resolveApiOrigin({ NODE_ENV: 'production', VERCEL_ENV: 'preview', API_URL: 'https://api-preview.example.com/' })).toBe('https://api-preview.example.com');
  });

  test('the same function is also exported as apiOrigin', async () => {
    // Arrange
    const mod = await import('@/lib/api-origin.mjs');

    // Act / Assert
    expect(mod.apiOrigin).toBe(mod.resolveApiOrigin);
  });
});

describe('ALLOW_LOCAL_API=1 (a deliberately local production build)', () => {
  test('lifts the production rules: no API_URL needed, localhost and plain http allowed', () => {
    // Arrange
    const env = (API_URL?: string) => production({ ALLOW_LOCAL_API: '1', API_URL });

    // Act / Assert
    expect(resolveApiOrigin(env())).toBe(LOCAL_API_URL);
    expect(resolveApiOrigin(env('http://localhost:4100'))).toBe('http://localhost:4100');
  });

  test('only the exact value "1" counts', () => {
    // Arrange / Act / Assert
    expect(() => resolveApiOrigin(production({ ALLOW_LOCAL_API: 'true' }))).toThrow(/API_URL is not set/);
    expect(() => resolveApiOrigin(production({ ALLOW_LOCAL_API: '0' }))).toThrow(/API_URL is not set/);
  });

  test('does not excuse a malformed value', () => {
    // Arrange / Act / Assert
    expect(() => resolveApiOrigin(production({ ALLOW_LOCAL_API: '1', API_URL: 'not a url' }))).toThrow(/not a valid URL/);
  });
});

describe('next.config.mjs uses the same validation', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  type Rewrites = { source: string; destination: string }[];
  async function loadConfig() {
    vi.resetModules();
    const mod = await import('../../../next.config.mjs');
    return mod.default as unknown as { rewrites: () => Promise<Rewrites> };
  }

  test('a production build without API_URL fails when it reads the rewrites', async () => {
    // Arrange
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('API_URL', '');
    vi.stubEnv('ALLOW_LOCAL_API', '');
    const config = await loadConfig();

    // Act / Assert: `next build` calls rewrites(); the config itself still loads (so `next lint` works)
    await expect(config.rewrites()).rejects.toThrow(/API_URL is not set/);
  });

  test('a production build with an https API_URL rewrites /api/* to it', async () => {
    // Arrange
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('API_URL', 'https://plate-and-flame-api.vercel.app/');
    vi.stubEnv('ALLOW_LOCAL_API', '');

    // Act
    const config = await loadConfig();
    const rewrites = await config.rewrites();

    // Assert
    expect(rewrites).toEqual([{ source: '/api/:path*', destination: 'https://plate-and-flame-api.vercel.app/api/:path*' }]);
  });

  test('local development rewrites to the local API without any setting', async () => {
    // Arrange
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('API_URL', '');

    // Act
    const rewrites = await (await loadConfig()).rewrites();

    // Assert
    expect(rewrites[0].destination).toBe('http://localhost:4000/api/:path*');
  });
});

/**
 * Browser security headers: src/lib/security-headers.mjs, applied to every page by next.config.mjs.
 */
import { describe, expect, test } from 'vitest';
import { SECURITY_HEADERS } from '@/lib/security-headers.mjs';
import nextConfig from '../../../next.config.mjs';

const valueOf = (key: string) => SECURITY_HEADERS.find((h) => h.key === key)?.value;

describe('security headers', () => {
  test('the list blocks sniffing, framing and camera/microphone/location use', () => {
    // Arrange / Act
    const keys = SECURITY_HEADERS.map((h) => h.key);

    // Assert
    expect(valueOf('X-Content-Type-Options')).toBe('nosniff');
    expect(valueOf('X-Frame-Options')).toBe('DENY');
    expect(valueOf('Content-Security-Policy')).toBe("frame-ancestors 'none'");
    expect(valueOf('Permissions-Policy')).toContain('camera=()');
    expect(valueOf('Strict-Transport-Security')).toMatch(/max-age=\d{8,}/);
    expect(new Set(keys).size).toBe(keys.length);
  });

  test('every page gets them, and Next no longer announces itself', async () => {
    // Arrange / Act
    const rules = await nextConfig.headers!();

    // Assert
    expect(rules).toHaveLength(1);
    expect(rules[0].source).toBe('/:path*');
    expect(rules[0].headers).toEqual(SECURITY_HEADERS);
    expect(nextConfig.poweredByHeader).toBe(false);
  });
});

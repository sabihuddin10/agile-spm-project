// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';
import snapshot from '@/lib/api-health/catalog.json';

const request = (accept: string, query = '') => new NextRequest(`http://web.test/api/health${query}`, { headers: { accept } });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GET /api/health on the web app', () => {
  it('serves the status page itself, from the snapshot when the API has no catalogue', async () => {
    // Arrange
    vi.stubGlobal('fetch', vi.fn(async () => new Response('not found', { status: 404 })));

    // Act
    const res = await GET(request('text/html,application/xhtml+xml'));
    const html = await res.text();

    // Assert
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(res.headers.get('content-security-policy')).toMatch(/script-src 'nonce-/);
    expect(html).toContain('<h1>API status</h1>');
    expect(html).toContain(`${snapshot.endpoints.length} total`);
    expect(html).toContain('Unknown');
  });

  it('uses the API\'s live catalogue and uptime when it has them', async () => {
    // Arrange
    const live = { service: 'restaurant-ops-api', endpoints: snapshot.endpoints.slice(0, 3) };
    vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify(
      String(url).endsWith('/endpoints') ? live : { status: 'ok', uptimeSeconds: 3725, persistence: { enabled: true } },
    ), { status: 200 })));

    // Act
    const html = await (await GET(request('text/html'))).text();

    // Assert
    expect(html).toContain('3 total');
    expect(html).toContain('1h 2m');
    expect(html).toContain('Postgres');
  });

  it('gives scripts the API\'s JSON, or 502 when the API is down', async () => {
    // Arrange
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ status: 'ok', service: 'restaurant-ops-api' }), { status: 200 })));

    // Act
    const ok = await GET(request('application/json'));

    // Assert
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ status: 'ok', service: 'restaurant-ops-api' });

    // Arrange
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNREFUSED'); }));

    // Act
    const down = await GET(request('text/html', '?format=json'));

    // Assert
    expect(down.status).toBe(502);
    expect(await down.json()).toMatchObject({ status: 'down' });
  });
});

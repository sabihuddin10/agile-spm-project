import { randomBytes } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
// Copies of the server's page renderer and endpoint catalogue (`pnpm --dir server run export:health`).
import { renderHealthPage } from '@/lib/api-health/health-page.js';
import snapshot from '@/lib/api-health/catalog.json';

/**
 * GET /api/health on the web app: the API status page, served here rather than
 * passed through to the API project. Endpoints and service details come from the
 * API when it can supply them, else from the snapshot built with this app; the
 * page's live checks call /api/health/check, which is passed through to the API.
 * Non-browser clients still get the API's JSON.
 */
export const dynamic = 'force-dynamic';

const API = process.env.API_URL || 'http://localhost:4000';
const TIMEOUT_MS = 4000;

async function apiJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API}${path}`, {
      headers: { accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

function wantsHtml(req: NextRequest) {
  const format = req.nextUrl.searchParams.get('format');
  if (format === 'html' || format === 'json') return format === 'html';
  return (req.headers.get('accept') ?? '').includes('text/html');
}

interface HealthJson {
  service?: string;
  uptimeSeconds?: number;
  persistence?: { enabled?: boolean };
}

export async function GET(req: NextRequest) {
  if (!wantsHtml(req)) {
    const body = await apiJson<HealthJson>('/api/health?format=json');
    return NextResponse.json(body ?? { status: 'down', error: 'The API did not respond.' }, {
      status: body ? 200 : 502,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const [health, live] = await Promise.all([
    apiJson<HealthJson>('/api/health?format=json'),
    apiJson<{ service: string; endpoints: object[] }>('/api/health/endpoints'),
  ]);
  const nonce = randomBytes(16).toString('base64');
  const html = renderHealthPage({
    catalog: live?.endpoints ?? snapshot.endpoints,
    service: live?.service ?? snapshot.service,
    uptimeSeconds: health?.uptimeSeconds ?? Number.NaN,
    persistence: Boolean(health?.persistence?.enabled),
    nonce,
    generatedAt: new Date().toISOString(),
  });
  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      Vary: 'Accept',
      'Content-Security-Policy': [
        "default-src 'none'", "style-src 'unsafe-inline'", `script-src 'nonce-${nonce}'`, "connect-src 'self'",
        "img-src 'self' data:", "base-uri 'none'", "form-action 'none'", "frame-ancestors 'none'",
      ].join('; '),
    },
  });
}

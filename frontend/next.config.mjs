import { resolveApiOrigin } from './src/lib/api-origin.mjs';
import { SECURITY_HEADERS } from './src/lib/security-headers.mjs';

// The API address is validated in rewrites(), which `next build` calls: a production build without a
// usable API_URL fails there instead of deploying a broken site. (`next lint` also runs with
// NODE_ENV=production but never calls rewrites(), so it is unaffected.) The /api/health route
// validates the same value with the same function, see src/lib/api-origin.mjs.
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Make the workforce-mock switch a build-time constant. Next only inlines a NEXT_PUBLIC_ variable
  // that is defined when it builds; left unset it stays a runtime lookup, the bundler cannot tell the
  // mock branch in src/lib/workforce-api.ts is dead, and the demo layer ships to production. Defining
  // it always (anything but the exact value "true" becomes "false") lets that branch be removed.
  env: {
    NEXT_PUBLIC_WORKFORCE_MOCK: process.env.NEXT_PUBLIC_WORKFORCE_MOCK === 'true' ? 'true' : 'false',
  },
  // Next announces itself in an X-Powered-By header; nothing needs it.
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
  async rewrites() {
    const apiOrigin = resolveApiOrigin();
    return [
      {
        source: '/api/:path*',
        destination: `${apiOrigin}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;

/**
 * Browser security headers for every page of the web app, shared by next.config.mjs and its test.
 *
 * Deliberately no Content-Security-Policy yet: Next.js renders inline scripts, so a useful policy needs
 * per-request nonces, a change that can break pages and needs its own browser testing. These headers
 * are the ones that cannot.
 *
 * - X-Content-Type-Options: no content-type guessing.
 * - X-Frame-Options / frame-ancestors: no other site may put the app in a frame (click-jacking).
 * - Referrer-Policy: other sites only learn the origin, never the page path.
 * - Strict-Transport-Security: browsers use https only (ignored over plain http, so local work is unaffected).
 * - Permissions-Policy: the app uses no camera, microphone or location, so they are switched off.
 */
export const SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

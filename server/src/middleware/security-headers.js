/**
 * Baseline browser security headers for every API response, without a new dependency.
 *
 * - X-Content-Type-Options: stops a browser from guessing a JSON response is a script or page.
 * - Referrer-Policy: the API address is not leaked to other sites through the Referer header.
 * - Cross-Origin-Resource-Policy: other sites cannot embed API responses as sub-resources.
 * (Caching is already handled: app.js marks every /api answer "private, no-store".)
 *
 * The "X-Powered-By: Express" header is switched off in createApp, so the server stops announcing which
 * framework (and so which known weaknesses) it runs.
 */
export function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  next();
}

import { Router } from 'express';
import crypto from 'node:crypto';
import { buildCatalog, MODULES } from '../lib/api-catalog.js';
import { checkHealth } from '../lib/health-probe.js';
import { renderHealthPage } from '../lib/health-page.js';

/**
 * Health routes. Mounted in app.js BEFORE the persistence middleware: they
 * never open a database transaction, and /check's probes (which do pass
 * through persistence) would otherwise wait behind the outer request's lock.
 * Nothing here reads env values or store records.
 */
const router = Router();

export const SERVICE = 'restaurant-ops-api';

const noStore = (res) => res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });

/** GET /api/health — HTML status page for browsers, JSON for everything else. */
router.get('/', (req, res) => {
  const catalog = buildCatalog(req.app);
  const persistence = Boolean(req.app.locals.persistence);
  const wanted = req.query.format === 'json' || req.query.format === 'html'
    ? req.query.format
    : req.accepts(['json', 'html']);
  res.vary('Accept');
  noStore(res);

  if (wanted === 'html') {
    const nonce = crypto.randomBytes(16).toString('base64');
    res.set('Content-Security-Policy', [
      "default-src 'none'", "style-src 'unsafe-inline'", `script-src 'nonce-${nonce}'`, "connect-src 'self'",
      "img-src 'self' data:", "base-uri 'none'", "form-action 'none'", "frame-ancestors 'none'",
    ].join('; '));
    return res.type('html').send(renderHealthPage({
      catalog, service: SERVICE, uptimeSeconds: process.uptime(), persistence, nonce, generatedAt: new Date().toISOString(),
    }));
  }

  return res.json({
    status: 'ok',
    service: SERVICE,
    time: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    persistence: { enabled: persistence, store: persistence ? 'postgres' : 'memory' },
    endpoints: catalog.length,
  });
});

/** GET /api/health/endpoints — the endpoint catalogue as JSON. */
router.get('/endpoints', (req, res) => {
  const catalog = buildCatalog(req.app);
  noStore(res);
  res.json({ service: SERVICE, count: catalog.length, modules: MODULES, endpoints: catalog });
});

/** GET /api/health/check — run the live probes (GET only, no credentials). */
router.get('/check', async (req, res, next) => {
  try {
    const result = await checkHealth(req.app);
    noStore(res);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;

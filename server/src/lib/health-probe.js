/**
 * Live health probes for the /api/health status page.
 *
 * Every probe-able catalogue entry (a GET without side effects for a guest) is
 * requested through the app itself on a short-lived loopback listener
 * (127.0.0.1, random port). A test admin token is obtained first and sent
 * with each request so protected routes return 200 instead of 401/403.
 * POST/PUT/PATCH/DELETE routes are never called.
 *
 *   2xx           → up
 *   401 / 403     → auth  (route needs a different role than admin has)
 *   other 4xx     → warn  (responded, but not as expected)
 *   5xx / timeout → down
 *
 * Results are cached briefly so several open status pages share one run.
 */
import http from 'node:http';
import { buildCatalog, probeUrl, MUTATING_METHODS } from './api-catalog.js';
import { getPool } from '../data/db.js';

export const PROBE_HEADER = 'x-health-probe';
const TIMEOUT_MS = 4000;
const CONCURRENCY = 4;
const CACHE_MS = 5000;

const cache = new WeakMap();

function classify(httpStatus) {
  if (httpStatus >= 200 && httpStatus < 300) return 'up';
  if (httpStatus === 401 || httpStatus === 403) return 'auth';
  if (httpStatus >= 400 && httpStatus < 500) return 'warn';
  return 'down';
}

/** Obtain an admin JWT token from the test instance. */
async function getAdminToken(origin, timeoutMs) {
  const started = performance.now();
  try {
    const res = await fetch(origin + '/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ email: 'admin@rest.test', password: 'password' }),
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.token;
  } catch {
    return null;
  }
}

async function probeOne(origin, entry, timeoutMs, authToken) {
  if (MUTATING_METHODS.includes(entry.method) || entry.method !== 'GET') {
    return { id: entry.id, status: 'skipped', reason: 'Not probed (mutating)' };
  }
  const url = probeUrl(entry);
  const started = performance.now();
  const headers = { accept: 'application/json', [PROBE_HEADER]: '1' };
  if (authToken && entry.auth === 'required') {
    headers.authorization = `Bearer ${authToken}`;
  }
  try {
    const res = await fetch(origin + url, {
      method: 'GET',
      headers,
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    });
    await res.arrayBuffer();
    const latencyMs = Math.round(performance.now() - started);
    return { id: entry.id, probedPath: url, status: classify(res.status), httpStatus: res.status, latencyMs };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - started);
    const reason = err?.name === 'TimeoutError' ? `Timed out after ${timeoutMs} ms` : 'No response';
    return { id: entry.id, probedPath: url, status: 'down', httpStatus: null, latencyMs, reason };
  }
}

async function pingDatabase(enabled, timeoutMs) {
  if (!enabled) return { enabled: false, status: 'off' };
  const started = performance.now();
  try {
    await Promise.race([
      getPool().query('SELECT 1'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs).unref()),
    ]);
    return { enabled: true, status: 'up', latencyMs: Math.round(performance.now() - started) };
  } catch {
    return { enabled: true, status: 'down', latencyMs: Math.round(performance.now() - started) };
  }
}

function listen(app) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function runChecks(app, { timeoutMs = TIMEOUT_MS } = {}) {
  const started = performance.now();
  const catalog = buildCatalog(app);
  const targets = catalog.filter((e) => e.probe.enabled);
  const results = new Map(catalog.map((e) => [e.id, { id: e.id, status: 'skipped', reason: e.probe.reason }]));

  const database = pingDatabase(Boolean(app.locals.persistence), timeoutMs);

  let server;
  let authToken = null;
  try {
    server = await listen(app);
    const origin = `http://127.0.0.1:${server.address().port}`;
    // Get admin token for protected routes
    authToken = await getAdminToken(origin, timeoutMs);
    const queue = [...targets];
    const worker = async () => {
      for (let entry = queue.shift(); entry; entry = queue.shift()) {
        results.set(entry.id, await probeOne(origin, entry, timeoutMs, authToken));
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  } catch {
    for (const e of targets) {
      if (results.get(e.id).status === 'skipped') results.set(e.id, { id: e.id, status: 'down', reason: 'Probe listener unavailable' });
    }
  } finally {
    if (server) {
      server.closeAllConnections?.();
      await new Promise((resolve) => server.close(resolve));
    }
  }

  const list = catalog.map((e) => results.get(e.id));
  const count = (s) => list.filter((r) => r.status === s).length;
  return {
    checkedAt: new Date().toISOString(),
    durationMs: Math.round(performance.now() - started),
    summary: { up: count('up'), auth: count('auth'), warn: count('warn'), down: count('down'), skipped: count('skipped'), total: list.length },
    database: await database,
    results: list,
  };
}

/** Run (or reuse a run from the last few seconds of) the live checks for this app. */
export function checkHealth(app, options = {}) {
  const hit = cache.get(app);
  if (!options.fresh && hit && Date.now() - hit.at < CACHE_MS) return hit.promise;
  const promise = runChecks(app, options);
  cache.set(app, { at: Date.now(), promise });
  promise.catch(() => cache.delete(app));
  return promise;
}

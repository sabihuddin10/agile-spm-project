/**
 * Live health probes for the /api/health status page.
 *
 * Every probe-able catalogue entry (a GET without side effects for a guest) is
 * requested through the app itself on a short-lived loopback listener
 * (127.0.0.1, random port), with no credentials and a short timeout. The
 * target host is never taken from the incoming request, so the check cannot be
 * pointed elsewhere. POST/PUT/PATCH/DELETE routes are never called.
 *
 *   2xx           → up
 *   401 / 403     → auth  (up; the route needs a token, which probes never send)
 *   other 4xx     → warn  (responded, but not as a guest GET is expected to)
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

async function probeOne(origin, entry, timeoutMs) {
  // Defence in depth: the catalogue never enables mutating probes.
  if (MUTATING_METHODS.includes(entry.method) || entry.method !== 'GET') {
    return { id: entry.id, status: 'skipped', reason: 'Not probed (mutating)' };
  }
  const url = probeUrl(entry);
  const started = performance.now();
  try {
    const res = await fetch(origin + url, {
      method: 'GET',
      headers: { accept: 'application/json', [PROBE_HEADER]: '1' },
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
  try {
    server = await listen(app);
    const origin = `http://127.0.0.1:${server.address().port}`;
    const queue = [...targets];
    const worker = async () => {
      for (let entry = queue.shift(); entry; entry = queue.shift()) {
        results.set(entry.id, await probeOne(origin, entry, timeoutMs));
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

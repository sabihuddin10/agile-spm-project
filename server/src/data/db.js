/**
 * Postgres connection and the single `app_state` table.
 *
 * The driver follows `DATABASE_URL`:
 * - a Neon host (`*.neon.tech`, production on Vercel) uses Neon's serverless
 *   driver: a pg-compatible Pool over WebSockets (port 443), which suits
 *   short-lived serverless instances and networks that block port 5432;
 * - any other host (a local PostgreSQL in dev) uses the standard `pg` driver
 *   over TCP, because Neon's driver cannot talk to a plain Postgres server.
 * Both Pools share the same API, so nothing else changes.
 */
import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import pg from 'pg';
import ws from 'ws';

// Neon's driver needs a WebSocket class. Node 22+ (Vercel) has one built in; Node 20
// (some dev PCs) does not, and every query would fail with "fetch failed".
if (typeof globalThis.WebSocket === 'undefined') neonConfig.webSocketConstructor = ws;

/** True when the connection string points at Neon. */
export function isNeonUrl(url) {
  try {
    return new URL(url).hostname.endsWith('.neon.tech');
  } catch {
    return false;
  }
}

/** A Pool for `url` using the driver that host needs. */
export function createPool(url, options = {}) {
  const Pool = isNeonUrl(url) ? NeonPool : pg.Pool;
  return new Pool({ connectionString: url, ...options });
}

let pool;
let tableReady;

export function getPool() {
  if (!pool) {
    pool = createPool(process.env.DATABASE_URL, { max: 2, connectionTimeoutMillis: 20_000, query_timeout: 30_000 });
    // A dropped idle connection must not crash the process; the next query reconnects.
    pool.on('error', (err) => console.error('[db] idle connection error', err.message ?? err));
  }
  return pool;
}

/** Swap in another pool (the unit tests use an in-memory fake). */
export function setPool(next) {
  pool = next;
  tableReady = undefined;
}

export function ensureTable() {
  tableReady ??= getPool()
    .query(`CREATE TABLE IF NOT EXISTS app_state (
      key        text PRIMARY KEY,
      data       bytea NOT NULL, -- gzip-compressed JSON snapshot
      version    integer NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )`)
    .catch((err) => {
      tableReady = undefined;
      throw err;
    });
  return tableReady;
}

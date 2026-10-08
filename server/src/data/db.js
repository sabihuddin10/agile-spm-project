/**
 * Postgres (Neon) connection and the single `app_state` table.
 *
 * Uses Neon's serverless driver: a pg-compatible Pool over WebSockets (port
 * 443), which supports transactions and suits short-lived serverless
 * instances and networks that block port 5432.
 */
import { Pool } from '@neondatabase/serverless';

let pool;
let tableReady;

export function getPool() {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2, connectionTimeoutMillis: 20_000, query_timeout: 30_000 });
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

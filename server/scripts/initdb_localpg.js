/**
 * Initialise a Postgres database from the SQL files in `server/schema/`.
 *
 *   node scripts/initdb_localpg.js                      # DATABASE_URL from server/.env
 *   node scripts/initdb_localpg.js --fresh              # drop the public schema first
 *   node scripts/initdb_localpg.js --url=postgres://... # explicit connection string
 *   node scripts/initdb_localpg.js --yes-really         # required for Neon targets
 *
 * The script is idempotent: `001_schema.sql` uses `IF NOT EXISTS` for every
 * object and `002_seed.sql` uses `ON CONFLICT DO NOTHING`, so running it twice
 * leaves the database in the same state. `--fresh` is the destructive variant —
 * it drops the whole `public` schema before applying the schema again, and it
 * therefore also needs `--yes-really` when the target is Neon.
 *
 * A local target also gets its database created when it does not exist yet
 * (the `postgres` maintenance database is used for that). Neon manages its
 * databases through branches, so that step is skipped there.
 */
import 'dotenv/config';
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import pg from 'pg';
import { createPool, isNeonUrl } from '../src/data/db.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = resolve(HERE, '..');
const SCHEMA_DIR = join(SERVER_ROOT, 'schema');
const SCHEMA_FILE = join(SCHEMA_DIR, '001_schema.sql');
const SEED_FILE = join(SCHEMA_DIR, '002_seed.sql');

const log = (...parts) => console.log('[db:init]', ...parts);
const warn = (...parts) => console.warn('[db:init]', ...parts);

const POOL_OPTIONS = { max: 1, connectionTimeoutMillis: 30_000, query_timeout: 300_000 };

/**
 * Neon's pooled WebSocket driver may route each query to a different backend,
 * so session-level `SET search_path` is unreliable. Passing `search_path` as a
 * connection parameter makes every backend honour it from the first query.
 */
function poolOptionsFor(url) {
  if (!isNeonUrl(url)) return POOL_OPTIONS;
  return { ...POOL_OPTIONS, options: '-c search_path=public,pg_catalog' };
}

// `import 'dotenv/config'` only reads ./.env relative to the current working
// directory; the fallback makes the script work when it is started from the
// repository root instead of from server/.
if (!process.env.DATABASE_URL) {
  const envFile = join(SERVER_ROOT, '.env');
  if (existsSync(envFile)) loadDotenv({ path: envFile });
}

/* -------------------------------------------------------------------------- */
/* CLI arguments                                                               */
/* -------------------------------------------------------------------------- */

export function parseArgs(argv) {
  const opts = { url: null, fresh: false, yesReally: false, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--fresh') opts.fresh = true;
    else if (arg === '--yes-really') opts.yesReally = true;
    else if (arg === '--help' || arg === '-h') opts.help = true;
    else if (arg.startsWith('--url=')) opts.url = arg.slice('--url='.length);
    else if (arg === '--url') {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) throw new Error('--url needs a connection string');
      opts.url = next;
      i += 1;
    } else {
      throw new Error(`Unknown argument "${arg}" (try --help)`);
    }
  }
  return opts;
}

function printUsage() {
  log('usage: node scripts/initdb_localpg.js [--fresh] [--url=postgres://...] [--yes-really]');
  log('  --fresh        drop the public schema before applying the schema (destructive)');
  log('  --url=...      connection string; overrides DATABASE_URL');
  log('  --yes-really   required when the target is a Neon database');
}

/* -------------------------------------------------------------------------- */
/* Connection strings                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Split a postgres URL into its prefix (`scheme://authority`), path (the
 * database name) and tail (query string + fragment) without re-serialising it.
 * Re-serialising would re-encode the credentials, so the parts are cut out of
 * the original string instead.
 */
export function splitUrl(rawUrl) {
  const schemeAt = rawUrl.indexOf('://');
  const authorityAt = schemeAt === -1 ? 0 : schemeAt + 3;
  const authority = /^[^\/?#]*/.exec(rawUrl.slice(authorityAt))[0];
  const pathAt = authorityAt + authority.length;
  const rest = rawUrl.slice(pathAt);
  const tailAt = rest.search(/[?#]/);
  return {
    prefix: rawUrl.slice(0, pathAt),
    path: tailAt === -1 ? rest : rest.slice(0, tailAt),
    tail: tailAt === -1 ? '' : rest.slice(tailAt),
  };
}

/** The database name is the path of the connection string. */
export function databaseNameOf(rawUrl) {
  const { path } = splitUrl(rawUrl);
  const name = path.replace(/^\/+/, '');
  return name ? decodeURIComponent(name) : '';
}

/** The same connection string, but pointing at another database. */
export function withDatabase(rawUrl, name) {
  const { prefix, tail } = splitUrl(rawUrl);
  return `${prefix}/${encodeURIComponent(name)}${tail}`;
}

/** Hide the password before a connection string reaches the log. */
export function redact(rawUrl) {
  return rawUrl.replace(/(\/\/[^\s:@/]+):[^\s@/]*@/, '$1:***@');
}

function resolveConnectionString(cliUrl) {
  const raw = String(cliUrl ?? process.env.DATABASE_URL ?? '').trim().replace(/^['"]|['"]$/g, '');
  if (!raw) {
    throw new Error(
      'No connection string. Put DATABASE_URL in server/.env or pass --url=postgres://user:pass@host:5432/dbname',
    );
  }
  if (!/^postgres(ql)?:\/\//i.test(raw)) {
    throw new Error(`"${redact(raw)}" is not a postgres connection string (expected postgres://… or postgresql://…)`);
  }
  const dbName = databaseNameOf(raw);
  if (!dbName) {
    throw new Error(`"${redact(raw)}" has no database name — add one to the path (…/dbname)`);
  }
  return { raw, dbName };
}

/* -------------------------------------------------------------------------- */
/* SQL                                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Split a SQL script into single statements.
 *
 * The schema wraps its enums and deferred constraints in dollar-quoted
 * `DO $$ … $$` blocks, so splitting on every `;` would tear them apart. This
 * walks the text and only breaks on semicolons that sit outside strings,
 * quoted identifiers, dollar-quoted blocks and comments.
 */
export function splitStatements(sql) {
  const statements = [];
  let current = '';
  let i = 0;

  while (i < sql.length) {
    const ch = sql[i];

    // -- line comment
    if (ch === '-' && sql[i + 1] === '-') {
      const end = sql.indexOf('\n', i);
      const stop = end === -1 ? sql.length : end;
      current += sql.slice(i, stop);
      i = stop;
      continue;
    }

    // /* block comment */ (Postgres allows nesting)
    if (ch === '/' && sql[i + 1] === '*') {
      let depth = 1;
      let j = i + 2;
      while (j < sql.length && depth > 0) {
        if (sql[j] === '/' && sql[j + 1] === '*') { depth += 1; j += 2; continue; }
        if (sql[j] === '*' && sql[j + 1] === '/') { depth -= 1; j += 2; continue; }
        j += 1;
      }
      current += sql.slice(i, j);
      i = j;
      continue;
    }

    // 'string literal' — doubled quotes escape, backslashes only in E'' strings
    if (ch === "'") {
      const escaped = /(^|[^A-Za-z0-9_])[Ee]$/.test(current);
      let j = i + 1;
      while (j < sql.length) {
        if (escaped && sql[j] === '\\') { j += 2; continue; }
        if (sql[j] === "'") {
          if (sql[j + 1] === "'") { j += 2; continue; }
          break;
        }
        j += 1;
      }
      current += sql.slice(i, Math.min(j + 1, sql.length));
      i = j + 1;
      continue;
    }

    // "quoted identifier"
    if (ch === '"') {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === '"') {
          if (sql[j + 1] === '"') { j += 2; continue; }
          break;
        }
        j += 1;
      }
      current += sql.slice(i, Math.min(j + 1, sql.length));
      i = j + 1;
      continue;
    }

    // $tag$ … $tag$ dollar-quoted string
    if (ch === '$') {
      const tag = /^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i));
      if (tag) {
        const end = sql.indexOf(tag[0], i + tag[0].length);
        const stop = end === -1 ? sql.length : end + tag[0].length;
        current += sql.slice(i, stop);
        i = stop;
        continue;
      }
    }

    if (ch === ';') {
      statements.push(current);
      current = '';
      i += 1;
      continue;
    }

    current += ch;
    i += 1;
  }
  statements.push(current);

  return statements.map((s) => s.trim()).filter((s) => s.length > 0 && stripComments(s).trim().length > 0);
}

/** Remove comments so a statement can be checked for executable content. */
function stripComments(sql) {
  let out = '';
  let i = 0;
  while (i < sql.length) {
    if (sql[i] === '-' && sql[i + 1] === '-') {
      const end = sql.indexOf('\n', i);
      i = end === -1 ? sql.length : end;
      continue;
    }
    if (sql[i] === '/' && sql[i + 1] === '*') {
      let depth = 1;
      let j = i + 2;
      while (j < sql.length && depth > 0) {
        if (sql[j] === '/' && sql[j + 1] === '*') { depth += 1; j += 2; continue; }
        if (sql[j] === '*' && sql[j + 1] === '/') { depth -= 1; j += 2; continue; }
        j += 1;
      }
      i = j;
      continue;
    }
    out += sql[i];
    i += 1;
  }
  return out;
}

function quoteIdent(name) {
  return `"${name.replace(/"/g, '""')}"`;
}

function excerpt(statement, limit = 240) {
  const flat = statement.replace(/\s+/g, ' ').trim();
  return flat.length > limit ? `${flat.slice(0, limit)}…` : flat;
}

/** Apply one SQL file statement by statement on a single session. */
async function runSqlFile(client, file) {
  const statements = splitStatements(readFileSync(file, 'utf8'));
  log(`applying ${basename(file)} (${statements.length} statements)`);
  // Neon's pooled WebSocket driver may route each query to a different
  // backend, so a session-level SET search_path is unreliable. Wrapping the
  // whole file in a transaction pins it to one backend and SET LOCAL applies
  // for the duration of that transaction only.
  await client.query('BEGIN');
  await client.query('SET LOCAL search_path = public, pg_catalog');
  try {
    for (let index = 0; index < statements.length; index += 1) {
      const statement = statements[index];
      try {
        await client.query(statement);
      } catch (err) {
        throw new Error(`${basename(file)} failed at statement ${index + 1}/${statements.length}: ${err.message}\n  ${excerpt(statement)}`);
      }
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  }
}

/* -------------------------------------------------------------------------- */
/* Database helpers                                                            */
/* -------------------------------------------------------------------------- */

/** Create the target database on a local server when it does not exist yet. */
async function ensureDatabase(rawUrl, dbName) {
  if (dbName === 'postgres') {
    log(`using the maintenance database "postgres" as the target`);
    return;
  }
  const client = new pg.Client({ connectionString: withDatabase(rawUrl, 'postgres') });
  try {
    await client.connect();
  } catch (err) {
    throw new Error(
      `could not connect to the maintenance database "postgres" on ${redact(rawUrl)}: ${err.message}\n` +
        '  Create the database manually, or give the role permission to create databases.',
    );
  }
  try {
    const { rows } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (rows.length > 0) {
      log(`database "${dbName}" already exists`);
      return;
    }
    await client.query(`CREATE DATABASE ${quoteIdent(dbName)}`);
    log(`created database "${dbName}"`);
  } catch (err) {
    // 42P04 = duplicate_database: another process won the race.
    if (err.code === '42P04') {
      log(`database "${dbName}" already exists`);
      return;
    }
    throw err;
  } finally {
    await client.end();
  }
}

async function listTables(client) {
  const { rows } = await client.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name`,
  );
  return rows.map((row) => row.table_name);
}

/** Exact row count per table, in a single round trip. */
async function countRows(client, tables) {
  const counts = new Map();
  if (tables.length === 0) return counts;
  // The table name is a literal — `tbl::text` would cast the whole row, not the name.
  // `public.` prefix is required: Neon's pooler resets session search_path between queries.
  const sql = tables
    .map((table) => `SELECT '${table.replace(/'/g, "''")}'::text AS t, count(*) AS n FROM public.${quoteIdent(table)}`)
    .join(' UNION ALL ');
  const { rows } = await client.query(sql);
  for (const row of rows) counts.set(row.t, Number(row.n));
  return counts;
}

/* -------------------------------------------------------------------------- */
/* Main                                                                        */
/* -------------------------------------------------------------------------- */

function printNeonWarning(url, dbName, fresh) {
  const lines = [
    '!!  NEON DATABASE DETECTED  !!',
    '',
    `   host      : ${redact(url)}`,
    `   database  : ${dbName}`,
    '',
    '   This script applies a schema and a seed file to a remote,',
    '   shared database. Anyone using the application reads that data.',
  ];
  if (fresh) {
    lines.push('', '   --fresh DROPS the whole public schema: every table, every row.');
  }
  lines.push(
    '',
    '   Re-run with --yes-really to confirm you really mean it.',
    '',
  );
  console.warn(lines.map((line) => `[db:init] ${line}`).join('\n'));
}

async function main() {
  const startedAt = Date.now();
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    printUsage();
    return;
  }

  const { raw: url, dbName } = resolveConnectionString(opts.url);
  const neon = isNeonUrl(url);

  log(`target : ${redact(url)}`);
  log(`driver : ${neon ? 'neon (serverless over WebSocket)' : 'pg (standard Postgres driver)'}`);

  if (neon) {
    printNeonWarning(url, dbName, opts.fresh);
    if (!opts.yesReally) {
      throw new Error('Refusing to modify a Neon database without --yes-really');
    }
  }

  if (!neon) {
    await ensureDatabase(url, dbName);
  }

  const pool = createPool(url, POOL_OPTIONS);
  try {
    const client = await pool.connect();
    try {
      // Neon's pooled WebSocket driver may route each query to a different
      // backend, so session-level SET search_path is unreliable. runSqlFile
      // wraps each file in a transaction with SET LOCAL, which pins it to one
      // backend. The session-level SET is a belt-and-braces fallback for
      // non-transactional helpers (listTables, countRows) on local Postgres.
      await client.query('SET search_path = public, pg_catalog');

      if (opts.fresh) {
        log('dropping the public schema (--fresh)');
        await client.query('DROP SCHEMA IF EXISTS public CASCADE');
        await client.query('CREATE SCHEMA public');
      }

      if (!existsSync(SCHEMA_FILE)) {
        throw new Error(`schema file not found: ${SCHEMA_FILE}`);
      }
      await runSqlFile(client, SCHEMA_FILE);

      const tables = await listTables(client);
      const before = await countRows(client, tables);

      if (existsSync(SEED_FILE)) {
        await runSqlFile(client, SEED_FILE);
      } else {
        warn(`seed file not found (${SEED_FILE}) — skipped`);
      }

      const finalTables = await listTables(client);
      const after = await countRows(client, finalTables);

      let inserted = 0;
      let total = 0;
      for (const table of finalTables) {
        const now = after.get(table) ?? 0;
        const was = before.get(table) ?? 0;
        inserted += Math.max(0, now - was);
        total += now;
      }

      const seconds = ((Date.now() - startedAt) / 1000).toFixed(2);
      log('');
      log(`tables created : ${finalTables.length}`);
      log(`rows inserted  : ${inserted.toLocaleString('en-US')}`);
      log(`rows in total  : ${total.toLocaleString('en-US')}`);
      log(`duration       : ${seconds}s`);
      log(`done — ${finalTables.join(', ')}`);
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

const isEntryPoint = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isEntryPoint) {
  main().catch((err) => {
    console.error('[db:init] ERROR:', err.message);
    process.exit(1);
  });
}

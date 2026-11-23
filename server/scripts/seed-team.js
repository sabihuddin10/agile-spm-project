/**
 * Seed the team's login accounts (one per role) into the database.
 *
 *   node scripts/seed-team.js                     # DATABASE_URL from server/.env
 *   node scripts/seed-team.js --url=postgres://... # explicit connection string
 *
 * Additive and idempotent: each account is upserted by ext_id/email, then
 * `state_version` is bumped so running instances reload the new users on their
 * next request. The database must already hold the app state (run `db:init` or
 * start the API once first).
 */
import 'dotenv/config';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import { hashPassword } from '../src/lib/passwords.js';
import { createPool, isNeonUrl } from '../src/data/db.js';
import { ensureSchema as applySchema } from '../src/data/relational/schema.js';
import { STAFF_ROLES } from '../src/data/store.js';
import { DEFAULT_WAGES } from '../src/lib/payroll.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = resolve(HERE, '..');
const PASSWORD = 'password';
const LOCK_KEY = 727274;

export const TEAM = [
  { id: 'usr_sabih', name: 'Sabih Uddin', email: 'sabih@admin.test', role: 'admin' },
  { id: 'usr_shahan', name: 'Shahan Arain', email: 'shahan@manager.test', role: 'manager' },
  { id: 'usr_burhanuddin', name: 'Burhanuddin Khatri', email: 'burhanuddin@manager.test', role: 'manager' },
  { id: 'usr_fozan', name: 'Fozan Javaid', email: 'fozan@chef.test', role: 'chef' },
  { id: 'usr_shaheer', name: 'Shaheer Zafar', email: 'shaheer@waiter.test', role: 'waiter' },
  {
    id: 'usr_okasha', name: 'Syed Okasha Shoaib', email: 'okasha@customer.test', role: 'customer',
    customer: { id: 'cus_okasha', type: 'online' },
  },
];

// The demo admin documented in README.md / COMPLETION_REPORT.md — kept so the
// docs stay accurate even on databases seeded before these team accounts existed.
const DEMO = [{ id: 'usr_admin', name: 'Alex Admin', email: 'admin@rest.test', role: 'admin' }];

const log = (...parts) => console.log('[seed:team]', ...parts);

if (!process.env.DATABASE_URL) {
  const envFile = join(SERVER_ROOT, '.env');
  if (existsSync(envFile)) loadDotenv({ path: envFile });
}

function resolveUrl(argv) {
  const inline = argv.find((arg) => arg.startsWith('--url='));
  if (inline) return inline.slice('--url='.length);
  const at = argv.indexOf('--url');
  if (at !== -1 && argv[at + 1] && !argv[at + 1].startsWith('--')) return argv[at + 1];
  return (process.env.DATABASE_URL ?? '').trim().replace(/^['"]|['"]$/g, '') || null;
}

async function upsertUser(client, seed, passwordHash) {
  const hourlyWage = STAFF_ROLES.includes(seed.role) ? DEFAULT_WAGES[seed.role] : null;
  const found = await client.query(
    'SELECT id FROM users WHERE ext_id = $1 OR lower(email) = lower($2) LIMIT 1',
    [seed.id, seed.email],
  );
  if (found.rowCount) {
    const { id } = found.rows[0];
    await client.query(
      `UPDATE users SET ext_id = $2, name = $3, email = $4, role = $5::role, active = true,
         must_change_password = false, password_hash = $6, hourly_wage = $7
       WHERE id = $1`,
      [id, seed.id, seed.name, seed.email, seed.role, passwordHash, hourlyWage],
    );
    return { id, created: false };
  }
  const { rows } = await client.query(
    `INSERT INTO users (id, ext_id, name, email, phone, role, active, must_change_password, password_hash, token_version, hourly_wage)
     OVERRIDING SYSTEM VALUE
     SELECT COALESCE(max(id), 0) + 1, $1, $2, $3, '', $4::role, true, false, $5, 0, $6 FROM users
     RETURNING id`,
    [seed.id, seed.name, seed.email, seed.role, passwordHash, hourlyWage],
  );
  return { id: rows[0].id, created: true };
}

async function ensureCustomer(client, seed, userId) {
  const found = await client.query(
    'SELECT id FROM customers WHERE user_id = $1 OR ext_id = $2 LIMIT 1',
    [userId, seed.customer.id],
  );
  if (found.rowCount) {
    await client.query(
      'UPDATE customers SET user_id = $2, name = $3, email = $4, type = $5::customer_type WHERE id = $1',
      [found.rows[0].id, userId, seed.name, seed.email, seed.customer.type],
    );
    return false;
  }
  await client.query(
    `INSERT INTO customers (id, ext_id, user_id, name, email, phone, type, loyalty_points, notes)
     OVERRIDING SYSTEM VALUE
     SELECT COALESCE(max(id), 0) + 1, $1, $2, $3, $4, '', $5::customer_type, 0, '' FROM customers`,
    [seed.customer.id, userId, seed.name, seed.email, seed.customer.type],
  );
  return true;
}

async function main() {
  const url = resolveUrl(process.argv.slice(2));
  if (!url) {
    log('no connection string — set DATABASE_URL in server/.env or pass --url=postgres://...');
    process.exitCode = 1;
    return;
  }
  if (isNeonUrl(url)) log('target is a Neon database (shared, live data)');

  const pool = createPool(url, { max: 1, connectionTimeoutMillis: 30_000, query_timeout: 300_000 });
  const passwordHash = hashPassword(PASSWORD);
  let created = 0;
  let updated = 0;
  let profiles = 0;

  try {
    await applySchema(pool);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL search_path = public, pg_catalog');
      await client.query('SELECT pg_advisory_xact_lock($1)', [LOCK_KEY]);

      const state = await client.query("SELECT 1 FROM sequences WHERE name = 'state_version'");
      if (!state.rowCount) {
        throw new Error('database has no app state yet — run `pnpm --dir server db:init` (or start the API once) first');
      }

      for (const seed of [...TEAM, ...DEMO]) {
        const user = await upsertUser(client, seed, passwordHash);
        if (user.created) created += 1;
        else updated += 1;
        if (seed.customer && (await ensureCustomer(client, seed, user.id))) profiles += 1;
      }

      const { rows } = await client.query(
        "UPDATE sequences SET last_value = last_value + 1 WHERE name = 'state_version' RETURNING last_value::int AS version",
      );
      await client.query('COMMIT');

      log(`accounts created: ${created}, updated: ${updated}, customer profiles added: ${profiles}`);
      log(`store version: ${rows[0].version} — running instances reload on their next request`);
      log(`sign in with password "${PASSWORD}":`);
      for (const seed of TEAM) log(`  ${seed.email.padEnd(26)} ${seed.role}`);
      log(`  ${'admin@rest.test'.padEnd(26)} admin (documented demo account)`);
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
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
    console.error('[seed:team] ERROR:', err.message);
    process.exit(1);
  });
}

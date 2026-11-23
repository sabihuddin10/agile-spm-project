/**
 * Bind the super admin role to one account on the database in DATABASE_URL
 * (lib/superadmin.js, data/superadmin.js). The API never assigns this role.
 *
 *   node scripts/superadmin.js                            # SUPERADMIN_EMAIL from store.js
 *   node scripts/superadmin.js --email=x@y.com --name="X Y"
 *   node scripts/superadmin.js --url=postgres://...       # explicit connection string
 *   node scripts/superadmin.js --yes-really               # required for a Neon database
 *
 * Every bind sets a password typed now (twice, hidden in a terminal; piped
 * stdin is read for automation) and signs out the account's sessions, so an
 * account someone registered with the public email beforehand, or a seed
 * password, never becomes the super admin's credential. The password is asked
 * before the global lock is taken, so the live site never waits on typing.
 * Running instances reload the store on their next request.
 */
import 'dotenv/config';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import { createPool, isNeonUrl } from '../src/data/db.js';
import { ensureSchema } from '../src/data/relational/schema.js';
import { bindInDatabase } from '../src/data/superadmin.js';
import { SUPERADMIN_EMAIL, findUserByEmail } from '../src/data/store.js';
import { passwordError } from '../src/lib/password-policy.js';
import { email as readEmail, personName } from '../src/lib/validate.js';

const SERVER_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const log = (...parts) => console.log('[superadmin]', ...parts);

// Like db:init: find server/.env when started from the repository root.
if (!process.env.DATABASE_URL) {
  const envFile = join(SERVER_ROOT, '.env');
  if (existsSync(envFile)) loadDotenv({ path: envFile });
}

function parseArgs(argv) {
  const opts = { email: SUPERADMIN_EMAIL, name: undefined, url: undefined, yesReally: false };
  for (const arg of argv) {
    if (arg === '--') continue; // `pnpm run superadmin -- …` forwards it
    if (arg === '--yes-really') opts.yesReally = true;
    else if (arg.startsWith('--email=')) opts.email = arg.slice('--email='.length);
    else if (arg.startsWith('--name=')) opts.name = arg.slice('--name='.length);
    else if (arg.startsWith('--url=')) opts.url = arg.slice('--url='.length);
    else throw new Error(`Unknown argument "${arg}". Use --email=, --name=, --url= and --yes-really.`);
  }
  return opts;
}

/**
 * Answers from stdin, in order. In a terminal what is typed stays hidden; piped
 * input (automation, tests) is read line by line, queued so no line is lost.
 */
function promptReader() {
  const terminal = Boolean(process.stdin.isTTY);
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal });
  if (terminal) rl._writeToOutput = () => {}; // prompts are written directly, keystrokes are not echoed
  const lines = [];
  const waiting = [];
  let closed = false;
  const noAnswer = () => new Error('No password entered; nothing was changed.');
  rl.on('line', (line) => (waiting.length ? waiting.shift().resolve(line) : lines.push(line)));
  rl.on('SIGINT', () => rl.close());
  rl.on('close', () => {
    closed = true;
    for (const w of waiting.splice(0)) w.reject(noAnswer());
  });
  return {
    ask(question) {
      process.stdout.write(question);
      let answer;
      if (lines.length) answer = Promise.resolve(lines.shift());
      else if (closed) answer = Promise.reject(noAnswer());
      else answer = new Promise((resolve, reject) => waiting.push({ resolve, reject }));
      return answer.finally(() => process.stdout.write('\n'));
    },
    close: () => rl.close(),
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const url = String(opts.url ?? process.env.DATABASE_URL ?? '').trim().replace(/^['"]|['"]$/g, '');
  if (!url) throw new Error('No database: set DATABASE_URL in server/.env or pass --url=postgres://...');
  if (isNeonUrl(url) && !opts.yesReally) throw new Error('Refusing to change a Neon database without --yes-really.');
  const email = readEmail(opts.email);

  const pool = createPool(url, { max: 1, connectionTimeoutMillis: 30_000 });
  const reader = promptReader();
  try {
    await ensureSchema(pool);
    // Before any lock: who holds this email now? A database the server never used holds the store seed.
    const used = (await pool.query("SELECT 1 FROM sequences WHERE name = 'state_version'")).rowCount > 0;
    const current = used
      ? (await pool.query('SELECT name, role::text AS role, created_at FROM users WHERE lower(email) = $1', [email])).rows[0]
      : findUserByEmail(email);
    if (current) {
      const created = String(current.created_at?.toISOString?.() ?? current.createdAt ?? '').slice(0, 10);
      log(`${email} belongs to the ${current.role} account "${current.name}" (created ${created}).`);
      log('Binding gives it the password you type now and signs out all of its sessions.');
      if (opts.name) log('--name is ignored: the existing account keeps its name.');
    } else {
      if (!opts.name) throw new Error('This email has no account yet: pass --name="Full Name" to create it.');
      personName(opts.name);
      log(`${email} has no account yet, so it will be created as the super admin.`);
    }
    const password = await reader.ask('Password for the super admin: ');
    const weak = passwordError(password, { email, name: current?.name ?? opts.name });
    if (weak) throw new Error(weak);
    if ((await reader.ask('Type it again: ')) !== password) throw new Error('The passwords do not match.');
    reader.close();

    const { user, created, demoted, version } = await bindInDatabase(pool, { email, name: opts.name, password });
    log(`${user.email} is now the super admin (${created ? 'account created' : 'existing account promoted'}).`);
    log(demoted.length ? `Now an admin again, signed out: ${demoted.join(', ')}.` : 'No other account held the role.');
    log(`Store version ${version}: running instances reload it on their next request.`);
  } finally {
    reader.close();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('[superadmin] ERROR:', err.message);
  process.exitCode = 1;
});

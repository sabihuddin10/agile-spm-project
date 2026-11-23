#!/usr/bin/env node
/**
 * Production advisory gate (bolt 009): `pnpm run audit:prod`.
 *
 * Audits every lockfile that decides what runs: pnpm-lock.yaml (local work and CI) and the two npm
 * lockfiles Vercel installs from. Fails on any unapproved high or critical production advisory.
 *
 * Exit codes:  0 pass   1 policy failure (finding or bad exception)   2 audit could not run
 * Exit 2 is deliberate: an advisory-service outage must never look like a green build.
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EXIT_CODES, evaluate, parseNpmAudit, parsePnpmAudit } from './lib/audit-policy.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXCEPTIONS_PATH = path.join(root, 'security', 'audit-exceptions.json');

/** Runs a command and returns { status, stdout, stderr }. A shell is needed for pnpm/npm on Windows. */
function run(command, args, cwd) {
  const res = spawnSync(`${command} ${args.join(' ')}`, { cwd, shell: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 120_000 });
  return { status: res.status, stdout: res.stdout ?? '', stderr: res.stderr ?? '', error: res.error };
}

function auditPnpm() {
  const res = run('pnpm', ['audit', '--prod', '--json'], root);
  return res.error ? { outage: `pnpm: ${res.error.message}` } : parsePnpmAudit(res.stdout, 'pnpm-lock.yaml');
}

/**
 * npm audits the lockfile of a copy of the package in a temp folder: the repository root declares npm
 * workspaces, which would make npm look for a root lockfile instead of the package's own.
 */
function auditNpm(dir) {
  const source = `${dir}/package-lock.json`;
  const tmp = mkdtempSync(path.join(tmpdir(), 'audit-gate-'));
  try {
    copyFileSync(path.join(root, dir, 'package.json'), path.join(tmp, 'package.json'));
    copyFileSync(path.join(root, dir, 'package-lock.json'), path.join(tmp, 'package-lock.json'));
    const res = run('npm', ['audit', '--omit=dev', '--json'], tmp);
    return res.error ? { outage: `${source}: ${res.error.message}` } : parseNpmAudit(res.stdout, source);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

function readExceptions() {
  try {
    return JSON.parse(readFileSync(EXCEPTIONS_PATH, 'utf8'));
  } catch (err) {
    return { exceptions: null, readError: err.message };
  }
}

const results = [auditPnpm(), auditNpm('frontend'), auditNpm('server')];
const exceptionsFile = readExceptions();
const verdict = evaluate({ results, exceptionsFile });
if (exceptionsFile.readError) verdict.problems.push(`security/audit-exceptions.json could not be read: ${exceptionsFile.readError}`);

const line = (f) => `  - ${f.severity.toUpperCase()} ${f.package} ${f.id} (${f.source}): ${f.title}`;
console.log('Production advisory gate (high and critical block)');
for (const outage of verdict.outages) console.log(`  ! ${outage}`);
for (const f of verdict.blocking) console.log(line(f));
for (const f of verdict.excepted) console.log(`${line(f)}\n      excepted by ${f.exception.owner} until ${f.exception.expires}: ${f.exception.reason}`);
for (const problem of verdict.problems) console.log(`  ! ${problem}`);
for (const e of verdict.unusedExceptions) console.log(`  note: exception ${e.advisory} (${e.package}) matches no current finding; remove it`);

if (verdict.outcome === 'pass') {
  console.log(`PASS: no unapproved high or critical production advisory${verdict.excepted.length ? ` (${verdict.excepted.length} excepted)` : ''}.`);
} else if (verdict.outcome === 'infrastructure') {
  console.log('FAIL (audit unavailable): an audit could not run or returned an unreadable report. This is NOT a pass; re-run when the advisory service is reachable.');
} else {
  console.log('FAIL: fix the findings above, or add a narrow, owned, expiring exception to security/audit-exceptions.json (see docs/dependency-policy.md).');
}
process.exit(EXIT_CODES[verdict.outcome]);

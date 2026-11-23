#!/usr/bin/env node
/**
 * Lockfile policy check (bolt 009): `pnpm run check:lockfiles`. See scripts/lib/lockfile-policy.mjs.
 * Exit 0 when the policy holds, 1 when it does not.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { diffManifestAgainstLock, findMissingLockfiles, findUnexpectedLockfiles } from './lib/lockfile-policy.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (rel) => JSON.parse(readFileSync(path.join(root, rel), 'utf8'));

const tracked = spawnSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' });
if (tracked.status !== 0) {
  console.error('FAIL: could not list tracked files with git.');
  process.exit(1);
}
const files = tracked.stdout.split('\n').map((s) => s.trim()).filter(Boolean);

const problems = [
  ...findUnexpectedLockfiles(files).map((p) => `unexpected lockfile committed: ${p} (allowed: pnpm-lock.yaml, frontend/package-lock.json, server/package-lock.json)`),
  ...findMissingLockfiles(files).map((p) => `expected lockfile is missing: ${p}`),
];
for (const dir of ['frontend', 'server']) {
  try {
    problems.push(...diffManifestAgainstLock(`${dir}`, readJson(`${dir}/package.json`), readJson(`${dir}/package-lock.json`)));
  } catch (err) {
    problems.push(`${dir}: could not compare package.json with package-lock.json (${err.message})`);
  }
}

if (problems.length) {
  console.log('Lockfile policy: FAIL');
  for (const p of problems) console.log(`  - ${p}`);
  console.log('Regenerate a stale npm lockfile in a clean copy of the package (see docs/dependency-policy.md).');
  process.exit(1);
}
console.log('Lockfile policy: PASS (3 allowed lockfiles; npm lockfiles match their package.json)');

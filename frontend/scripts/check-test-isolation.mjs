#!/usr/bin/env node
/**
 * Test isolation check (bolt 007): `pnpm --dir frontend run check:isolation`.
 *
 * The frontend suite runs in Vitest's vmThreads pool for speed: one long-lived worker per CPU, each test
 * file in its own sandboxed global scope. That is only safe if one file cannot affect the next one that
 * lands in the same worker. This proves it in three steps:
 *
 *   1. Fixtures (test-isolation/): a-pollute.test.ts leaves behind everything a careless test could (window
 *      and global properties, stubbed globals, localStorage, sessionStorage, cookies, the DOM, the title,
 *      a running timer, module state, a stubbed env var); b-observe.test.ts runs right after it in the
 *      same worker and must see none of it. Must PASS with the project's real configuration.
 *   2. Control: the same fixtures with isolation switched off (`--pool=threads --no-isolate`) must FAIL.
 *      If they pass, the fixtures cannot detect a leak and step 1 proves nothing.
 *   3. Rule: no test may write process.env directly (it is shared by every file in a worker and nothing can
 *      undo it for you). Use vi.stubEnv, which the shared setup undoes when each file finishes.
 *
 * Exit 0 when all three hold, 1 otherwise.
 */
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const strip = (s) => s.replace(/\u001b\[[0-9;]*m/g, '');

function vitest(extra) {
  const res = spawnSync(`pnpm exec vitest run --config vitest.isolation.config.mts ${extra}`, {
    cwd: root, shell: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  return { status: res.status, out: strip(`${res.stdout}\n${res.stderr}`) };
}

// Direct writes to process.env: assignment, delete, Object.assign. Reads and `===` comparisons are fine.
export const DIRECT_ENV_WRITE = /process\.env(?:\.[A-Za-z_]\w*|\[[^\]]+\])\s*(?:=(?!=)|\+=|\|\|=|\?\?=)|delete\s+process\.env|Object\.assign\(\s*process\.env/;

export function findDirectEnvWrites(dir) {
  const hits = [];
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const full = path.join(d, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(test|spec)\.[jt]sx?$/.test(name)) {
        readFileSync(full, 'utf8').split('\n').forEach((line, i) => {
          if (DIRECT_ENV_WRITE.test(line)) hits.push(`${path.relative(root, full)}:${i + 1}: ${line.trim()}`);
        });
      }
    }
  };
  walk(dir);
  return hits;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const problems = [];

  const real = vitest('');
  if (real.status === 0) console.log('1/3 PASS  fixtures: nothing leaks from one test file into the next');
  else {
    problems.push('files can leak into each other under the project configuration');
    console.log('1/3 FAIL  fixtures: the next file saw state left by the previous one');
    console.log(real.out.split('\n').filter((l) => /AssertionError|expected/.test(l)).slice(0, 4).join('\n'));
  }

  const control = vitest('--pool=threads --no-isolate');
  if (control.status !== 0) console.log('2/3 PASS  control: with isolation switched off the same fixtures fail, so they can detect a leak');
  else {
    problems.push('the control run passed, so the fixtures cannot detect leaks');
    console.log('2/3 FAIL  control: the fixtures passed even with isolation off; they prove nothing');
  }

  const writes = findDirectEnvWrites(path.join(root, 'src'));
  if (!writes.length) console.log('3/3 PASS  rule: no test writes process.env directly');
  else {
    problems.push('tests write process.env directly');
    console.log('3/3 FAIL  rule: use vi.stubEnv instead of writing process.env, which leaks into later files:');
    for (const w of writes) console.log(`  - ${w}`);
  }

  if (problems.length) {
    console.log(`check:isolation: FAIL (${problems.join('; ')}). Run tests with --pool=forks until this is fixed.`);
    process.exit(1);
  }
  console.log('check:isolation: PASS');
}

#!/usr/bin/env node
/**
 * Frontend test-suite benchmark (bolt 007): `pnpm --dir frontend run bench:test -- --runs 3 [vitest args]`.
 *
 * Runs the whole Vitest suite several times in a row and reports the wall-clock time of each run and
 * the median, so configurations can be compared like for like. Run it with nothing else busy on the
 * machine (stop `pnpm dev`, close heavy programs) and compare runs made on the same machine only.
 *
 *   --runs N        how many full runs (default 3)
 *   --label NAME    a name for this configuration, printed with the result
 *   everything else is passed to `vitest run` unchanged, e.g.  --pool=vmThreads  --maxWorkers=2
 *
 * A run that has any failing test makes the whole benchmark fail: a faster configuration only counts
 * if all tests still pass.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);

let runs = 3;
let label = 'default';
const passthrough = [];
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === '--runs') runs = Number(args[++i]);
  else if (args[i] === '--label') label = args[++i];
  else passthrough.push(args[i]);
}
if (!Number.isInteger(runs) || runs < 1) {
  console.error('bench: --runs must be a positive whole number');
  process.exit(2);
}

export function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const strip = (s) => s.replace(/\u001b\[[0-9;]*m/g, '');
const seconds = [];
let totalTests = null;

console.log(`bench [${label}]: ${runs} full run(s) of: vitest run ${passthrough.join(' ')}`.trim());
for (let n = 1; n <= runs; n += 1) {
  const started = process.hrtime.bigint();
  const res = spawnSync(`pnpm exec vitest run ${passthrough.join(' ')}`, {
    cwd: root, shell: true, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024,
  });
  const wall = Number(process.hrtime.bigint() - started) / 1e9;
  const out = strip(`${res.stdout}\n${res.stderr}`);
  const passed = /Tests\s+(?:\d+ failed \| )?(\d+) passed/.exec(out)?.[1];
  const failed = /Tests\s+(\d+) failed/.exec(out)?.[1] ?? '0';
  console.log(`  run ${n}: ${wall.toFixed(1)} s   tests passed: ${passed ?? '?'}   failed: ${failed}   exit: ${res.status}`);
  if (res.status !== 0 || failed !== '0') {
    console.error(`bench [${label}]: FAIL. Run ${n} did not pass all tests, so this configuration does not count.`);
    console.error(out.split('\n').filter((l) => /FAIL|AssertionError|Error:/.test(l)).slice(0, 8).join('\n'));
    process.exit(1);
  }
  totalTests ??= passed;
  if (passed !== totalTests) {
    console.error(`bench [${label}]: FAIL. The number of passing tests changed between runs (${totalTests} then ${passed}).`);
    process.exit(1);
  }
  seconds.push(wall);
}
console.log(`bench [${label}]: median ${median(seconds).toFixed(1)} s   min ${Math.min(...seconds).toFixed(1)} s   max ${Math.max(...seconds).toFixed(1)} s   (${totalTests} tests, all passing)`);

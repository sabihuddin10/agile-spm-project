#!/usr/bin/env node
/**
 * Production bundle check (bolt 006): `pnpm --dir frontend run check:bundle`, run after `next build`.
 *
 * The workforce demo layer (src/lib/workforce-mock.ts) must never ship to production clients or the
 * server bundle. This scans the build output for strings that exist only in that module's demo seed
 * data. If any is found, the mock has been pulled back into the bundle (for example by a static
 * import of workforce-mock, or by moving the dynamic import out of the flag check in workforce-api.ts).
 *
 *   node scripts/check-no-workforce-mock.mjs            exit 0 when the output is clean, 1 when it is not
 *   node scripts/check-no-workforce-mock.mjs --expect   the opposite: exit 0 only when the mock IS present
 *                                                       (a control, to prove the markers can be detected)
 *
 * Exit 2: there is no build output to check (run `next build` first), so nothing was verified.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const buildDir = path.join(root, '.next');

// Demo staff that only workforce-mock.ts defines (nothing else in src/ contains them).
export const MARKERS = ['Wendy Server', 'Cara Cook', 'Carlos Chef', 'usr_chef2'];

// Compiled output only. .next/cache holds incremental build state from earlier builds, not this build's bundles.
const SCAN = ['static', 'server'];
const TEXT = /\.(js|mjs|cjs|html|json|rsc|txt|map)$/;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const info = statSync(full);
    if (info.isDirectory()) yield* walk(full);
    else if (TEXT.test(name)) yield full;
  }
}

/** Returns [{ file, marker }] for every build file that contains a marker. */
export function findMarkers(dir = buildDir) {
  const hits = [];
  for (const sub of SCAN) {
    const start = path.join(dir, sub);
    if (!existsSync(start)) continue;
    for (const file of walk(start)) {
      const text = readFileSync(file, 'utf8');
      for (const marker of MARKERS) if (text.includes(marker)) hits.push({ file: path.relative(dir, file), marker });
    }
  }
  return hits;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const expect = process.argv.includes('--expect');
  if (!existsSync(path.join(buildDir, 'static')) && !existsSync(path.join(buildDir, 'server'))) {
    console.error('check:bundle: no build output in frontend/.next. Run `next build` first; nothing was verified.');
    process.exit(2);
  }
  const hits = findMarkers();
  if (expect) {
    if (hits.length) {
      console.log(`check:bundle (control): the workforce mock is present in the build, as expected (${hits.length} match(es)).`);
      process.exit(0);
    }
    console.error('check:bundle (control): expected the workforce mock in this build but found none; the markers cannot be trusted.');
    process.exit(1);
  }
  if (hits.length) {
    console.error('check:bundle: FAIL. The workforce mock is in the production build:');
    for (const h of hits.slice(0, 10)) console.error(`  - "${h.marker}" in .next/${h.file}`);
    console.error('Something imports src/lib/workforce-mock.ts outside the NEXT_PUBLIC_WORKFORCE_MOCK check in workforce-api.ts.');
    process.exit(1);
  }
  console.log('check:bundle: PASS. No workforce mock module or demo seed data in the production build.');
}

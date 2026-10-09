/**
 * Copy the /api/health page into the web app (`pnpm --dir server run export:health`).
 *
 * The web project serves /api/health itself (frontend/src/app/api/health/route.ts)
 * with the same renderer and a snapshot of the endpoint catalogue, used when the
 * API cannot supply its live catalogue. test/lib/health-export.test.js fails
 * when the copies are out of date.
 */
import { copyFileSync, writeFileSync } from 'node:fs';
import { createApp } from '../src/app.js';
import { exportPaths, catalogSnapshot } from '../src/lib/health-export.js';

const { pageSource, pageCopy, catalogCopy } = exportPaths();
copyFileSync(pageSource, pageCopy);
writeFileSync(catalogCopy, catalogSnapshot(createApp({ logging: false, persistence: false })));
console.log(`[export:health] wrote ${pageCopy} and ${catalogCopy}`);

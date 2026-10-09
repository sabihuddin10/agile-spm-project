/** lib/health-export.js — the web app's copy of the /api/health page stays in step with the server. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createApp } from '../../src/app.js';
import { exportPaths, catalogSnapshot } from '../../src/lib/health-export.js';

const FIX = 'Run `pnpm --dir server run export:health` and commit the result.';
const read = (file) => readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

test('the web app serves the same health page renderer as the server', () => {
  // Arrange
  const { pageSource, pageCopy } = exportPaths();

  // Act
  const [source, copy] = [read(pageSource), read(pageCopy)];

  // Assert
  assert.ok(source === copy, `frontend/src/lib/api-health/health-page.js is out of date. ${FIX}`);
});

test('the web app\'s endpoint catalogue snapshot matches the routes', () => {
  // Arrange
  const { catalogCopy } = exportPaths();

  // Act
  const expected = catalogSnapshot(createApp({ logging: false, persistence: false }));

  // Assert
  assert.ok(read(catalogCopy) === expected, `frontend/src/lib/api-health/catalog.json is out of date. ${FIX}`);
});

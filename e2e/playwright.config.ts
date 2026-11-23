import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

/**
 * Critical-path browser suite (bolt 001). It runs against PRODUCTION builds:
 *   - API:      `node src/index.js` in memory (no database), NODE_ENV=test so the cookie works in WebKit
 *   - Frontend: `next build` + `next start`, with /api/* rewritten to the API above
 * Ports are fixed and different from the dev servers (4000/3000), so a running
 * `pnpm dev` never collides with, or is reused by, the suite. All data is the
 * disposable in-memory seed; nothing here talks to a real database.
 */
const API_PORT = 4100;
const WEB_PORT = 3100;
const API_URL = `http://localhost:${API_PORT}`;
const WEB_URL = `http://localhost:${WEB_PORT}`;

// Server logs are kept next to the Playwright artifacts so CI can upload them.
const logDir = path.join(__dirname, 'logs');
fs.mkdirSync(logDir, { recursive: true });
const repoRoot = path.join(__dirname, '..');
const toLog = (name: string) => `> "${path.join(logDir, name)}" 2>&1`;

export default defineConfig({
  testDir: path.join(__dirname, 'tests'),
  outputDir: path.join(__dirname, 'test-results'),
  // The journeys share one order, so they run in order in a single worker.
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [
    ['list'],
    ['html', { outputFolder: path.join(__dirname, 'playwright-report'), open: 'never' }],
  ],
  use: {
    baseURL: WEB_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  // The same journeys run in each engine, one after the other, against the same two servers.
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: [
    {
      command: `pnpm --dir server start ${toLog('api.log')}`,
      url: `${API_URL}/api/health`,
      cwd: repoRoot,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        PORT: String(API_PORT),
        // Not 'production' on purpose: that makes the session cookie `Secure`, and WebKit (Safari's
        // engine) refuses Secure cookies over plain http://localhost, so nobody could sign in.
        // Chromium and Firefox accept them, which is why only the WebKit pass exposed this.
        // The frontend below is still a real production build; only this throwaway API differs.
        NODE_ENV: 'test',
        // Test-only signing secret for the throwaway in-memory API. Not used anywhere else.
        JWT_SECRET: 'e2e-only-secret-not-used-outside-the-test-run',
        // Empty on purpose: dotenv never overrides it, so a developer's server/.env cannot
        // point the suite at a real database.
        DATABASE_URL: '',
      },
    },
    {
      // The rewrite target is baked in at build time, so build and start use the same API_URL.
      command: `pnpm --dir frontend exec next build && pnpm --dir frontend exec next start -p ${WEB_PORT} ${toLog('web.log')}`,
      url: WEB_URL,
      cwd: repoRoot,
      reuseExistingServer: false,
      timeout: 300_000,
      // ALLOW_LOCAL_API: a production build normally refuses a localhost API (frontend/src/lib/api-origin.mjs);
      // this one is deliberately local.
      env: { API_URL, NODE_ENV: 'production', ALLOW_LOCAL_API: '1', NEXT_TELEMETRY_DISABLED: '1' },
    },
  ],
});

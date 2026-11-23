import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    // Speed (bolt 007). The default pool starts a fresh process and builds a new jsdom for every one of the
    // ~100 test files, which was about half of the run time (see docs/frontend-test-performance.md).
    // vmThreads keeps one worker thread alive and gives each file its own sandboxed global scope, so files
    // stay isolated from each other (own window, document, localStorage, timers, module registry) without
    // paying for a new process each time. The one thing files in a worker still share is Node's `process`
    // (including process.env), so stubs of it are undone automatically after every test, below.
    // Fall back to the old behaviour with `--pool=forks` if a configuration problem is ever suspected.
    // The isolation fixtures pollute state on purpose; they run only via `pnpm run check:isolation`.
    // scripts/ has plain Node test files (run with `node --test`), not Vitest suites.
    exclude: [...configDefaults.exclude, 'test-isolation/**', 'scripts/**'],
    pool: 'vmThreads',
    unstubEnvs: true,
    unstubGlobals: true,
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    css: true,
    // The workforce pages run against the in-browser demo in tests.
    env: { NEXT_PUBLIC_WORKFORCE_MOCK: 'true' },
  },
});

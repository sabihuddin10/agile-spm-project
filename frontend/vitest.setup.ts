import '@testing-library/jest-dom/vitest';
import { afterAll, vi } from 'vitest';

// Tests run in the vmThreads pool (vitest.config.mts): each file has its own window, globals and module
// registry, but all files handled by one worker share Node's `process`, including process.env. Vitest's
// `unstubEnvs` only undoes a file's stubs before that file's next test, so a vi.stubEnv left active by the
// last test of a file would still be set when the next file starts. Undo this file's env stubs when it
// finishes. (Writing process.env directly is not covered: use vi.stubEnv. scripts/check-test-isolation.mjs
// enforces that, and proves with fixtures that nothing else leaks between files.)
afterAll(() => {
  vi.unstubAllEnvs();
});

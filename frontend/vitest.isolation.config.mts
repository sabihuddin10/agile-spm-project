import { configDefaults, defineConfig } from 'vitest/config';
import { BaseSequencer, type TestSpecification } from 'vitest/node';
import base from './vitest.config.mts';

/** Runs files in name order. Vitest otherwise orders by size and cached timings, which could run the observer before the polluter. */
class ByNameSequencer extends BaseSequencer {
  async sort(files: TestSpecification[]) {
    return [...files].sort((a, b) => a.moduleId.localeCompare(b.moduleId));
  }
}

/**
 * Runs only the isolation fixtures (test-isolation/), one file after another in a single worker, in a fixed
 * order, so the second file shares a worker with the first. Used by scripts/check-test-isolation.mjs.
 *
 * Everything else (environment, pool, unstub settings) comes from the main config. `exclude` is replaced,
 * not merged: the main config excludes these fixtures from the normal suite.
 */
export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: ['test-isolation/**/*.test.ts'],
    exclude: configDefaults.exclude,
    fileParallelism: false,
    maxWorkers: 1,
    sequence: { sequencer: ByNameSequencer, shuffle: false },
  },
});

# Frontend test speed (bolt 007)

The frontend suite (about 1,040 tests in 99 files, Vitest + jsdom) used to take 2 to 3 minutes. It now takes
about 35 seconds, with every test still passing and files still isolated from each other.

## Why it was slow

Vitest's default pool starts a new process for every test file and builds a fresh jsdom (a simulated browser)
inside it. The run report said so itself: "jsdom was created 96 times, 225.97 s total, 49% of tracked time",
and setup and imports were most of the rest. The tests themselves were about a fifth of the time.

## What changed

`frontend/vitest.config.mts` now sets `pool: 'vmThreads'`:

- One long-lived worker thread per CPU instead of one process per file.
- **Each test file still gets its own sandboxed global scope**: its own `window`, `document`, `localStorage`,
  timers and module registry. Files cannot see each other's state.
- Only Node's own `process` (including `process.env`) is shared by the files that happen to run in the same
  worker. That is the one real difference from the old pool, and it is handled below.

Also set: `unstubEnvs` and `unstubGlobals` (Vitest undoes `vi.stubEnv` / `vi.stubGlobal` automatically), and a
shared `afterAll` in `vitest.setup.ts` that undoes a file's env stubs when the file ends.

## Measurements

Method: `pnpm --dir frontend run bench:test -- --runs 3` runs the whole suite three times back to back and
prints each wall-clock time and the median. Same laptop for every number (Intel Core i5-4300M, 2 cores / 4
threads, 16 GB), nothing else running (`pnpm dev` stopped), all 1,043 tests required to pass in every run.

| Configuration | Run 1 | Run 2 | Run 3 | Median |
|---|---|---|---|---|
| Before: default pool | 138.5 s | 140.3 s | 141.9 s | **140.3 s** |
| After: `vmThreads` + settings above | 36.1 s | 35.4 s | 35.6 s | **35.6 s** |

That is **74.6% faster** (target: at least 30% against the 101.81 s audit baseline; the same machine measured
140.3 s before the change, which is the fairer comparison). Further full runs during development all finished
between 33 s and 40 s with 1,043 of 1,043 passing. Peak memory while running: about 1.7 GB across all Node
processes.

The audit's 101.81 s figure came from a different machine; compare timings only on one machine.

## Why it is safe, and how that is enforced

Speed is worthless if tests can affect each other, so this is checked, not assumed.
`pnpm --dir frontend run check:isolation` (also a CI step) does three things:

1. **Fixtures** (`frontend/test-isolation/`): one file deliberately pollutes everything it can reach: `window`
   and global properties, stubbed globals, `localStorage`, `sessionStorage`, cookies, the DOM, the document
   title, a still-running timer, module state and a stubbed env var. The next file, in the same worker and in a
   guaranteed order, must see none of it.
2. **Control:** the same fixtures with isolation switched off (`--pool=threads --no-isolate`) must **fail**. If
   they pass, the fixtures cannot detect a leak and step 1 proves nothing.
3. **Rule:** no test may write `process.env` directly (`process.env.X = ...`, `delete process.env.X`,
   `Object.assign(process.env, ...)`). It is shared by the files in a worker and nothing can undo a direct
   write for you. Use `vi.stubEnv`, which is undone when each file ends. No existing test breaks this rule.

What the checks found while this was being built:

- The first version of the fixtures passed even with isolation off, because Vitest happened to run the
  "observer" file before the "polluter". A fixed file order (`vitest.isolation.config.mts`) fixed that.
- With the real configuration everything was isolated **except** env stubs: Vitest's `unstubEnvs` only undoes a
  file's stubs before that file's next test, so a stub left by the last test of one file was still set when
  the next file started. The shared `afterAll` in `vitest.setup.ts` closes that gap.

## Known limits and how to back out

- **Direct `process.env` writes** are the one thing the pool cannot isolate; rule 3 above blocks them.
- **Memory:** `vmThreads` keeps workers alive, so memory grows over a run (about 1.7 GB here). Vitest recycles
  a worker that gets too large; if CI ever runs out of memory, set `vmMemoryLimit` or `--maxWorkers=2`.
- **CI worker count:** left at Vitest's default (CPU count minus one). GitHub's ubuntu runners have 4 vCPUs,
  so they get 3 workers. Do not raise it above the CPU count.
- **Back out:** run `pnpm --dir frontend exec vitest run --pool=forks` to get the old behaviour for one run, or
  delete the `pool` line in `vitest.config.mts` to go back for good. Everything else keeps working.
- To check a new configuration idea, benchmark it the same way (`bench:test -- --runs 3 --pool=...`) and run
  `check:isolation`. The benchmark fails any configuration with a failing test.

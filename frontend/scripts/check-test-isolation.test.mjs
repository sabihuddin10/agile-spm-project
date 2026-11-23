/** Tests for the direct-process.env-write rule in check-test-isolation.mjs (bolt 007). Run: pnpm --dir frontend run test:scripts */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DIRECT_ENV_WRITE } from './check-test-isolation.mjs';

test('writes to process.env are caught, in every common form', () => {
  const violations = [
    'process.env.FOO = "x";',
    'process.env["FOO"] = 1',
    '  process.env.NODE_ENV="production"',
    'delete process.env.FOO',
    'Object.assign(process.env, { A: 1 })',
    'process.env.X ||= 2',
    'process.env.Y ??= 3',
    'process.env.Z += "a"',
  ];
  for (const line of violations) assert.match(line, DIRECT_ENV_WRITE, line);
});

test('reads, comparisons and vi.stubEnv are allowed', () => {
  const fine = [
    'if (process.env.FOO === "x") {}',
    'const a = process.env.FOO;',
    'expect(process.env.FOO).toBeUndefined();',
    'vi.stubEnv("FOO", "x");',
    'const { env } = process;',
    'const same = process.env.A !== process.env.B;',
    'const flag = process.env.FOO == "x";',
  ];
  for (const line of fine) assert.doesNotMatch(line, DIRECT_ENV_WRITE, line);
});

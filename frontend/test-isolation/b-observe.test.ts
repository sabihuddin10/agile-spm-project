/**
 * Test isolation fixture, part 2 of 2 (bolt 007): runs right after a-pollute.test.ts in the same worker
 * and must see a clean world. If any assertion here fails, files can leak into each other and the fast
 * test configuration is not safe.
 */
import { expect, test } from 'vitest';
import { counter } from './shared-state';

test('sees none of the state the previous file left behind', async () => {
  // window and globals
  expect(Reflect.get(window, '__isolationLeak')).toBeUndefined();
  expect(Reflect.get(globalThis, '__isolationLeakGlobal')).toBeUndefined();
  expect(Reflect.get(globalThis, '__isolationStubbedGlobal')).toBeUndefined();

  // storage, cookies, document
  expect(localStorage.getItem('isolation-leak')).toBeNull();
  expect(sessionStorage.getItem('isolation-leak')).toBeNull();
  expect(document.cookie).not.toContain('isolation_leak');
  expect(document.title).not.toBe('isolation leak');
  expect(document.getElementById('isolation-leak')).toBeNull();

  // the other file's timer must not still be ticking into this file's world
  await new Promise((resolve) => setTimeout(resolve, 60));
  expect(Reflect.get(globalThis, '__isolationTicks')).toBeUndefined();

  // module registry and environment
  expect(counter.value).toBe(0);
  expect(process.env.ISOLATION_LEAK).toBeUndefined();
});

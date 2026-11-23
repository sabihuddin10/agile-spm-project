/**
 * Test isolation fixture, part 1 of 2 (bolt 007). Not part of the normal suite: it is run only by
 * `pnpm --dir frontend run check:isolation`. It leaves as much state behind as a careless test could.
 * b-observe.test.ts runs next, in the same worker, and must see none of it.
 */
import { expect, test, vi } from 'vitest';
import { counter } from './shared-state';

test('pollutes every kind of shared state it can reach', () => {
  // window and globals
  Reflect.set(window, '__isolationLeak', 'window');
  Reflect.set(globalThis, '__isolationLeakGlobal', 'global');
  vi.stubGlobal('__isolationStubbedGlobal', 'stubbed');

  // storage, cookies, document
  localStorage.setItem('isolation-leak', '1');
  sessionStorage.setItem('isolation-leak', '1');
  document.cookie = 'isolation_leak=1';
  document.title = 'isolation leak';
  document.body.innerHTML = '<div id="isolation-leak">left behind</div>';

  // a timer that keeps running after the file ends, counting into a global
  Reflect.set(globalThis, '__isolationTicks', 0);
  setInterval(() => Reflect.set(globalThis, '__isolationTicks', (Reflect.get(globalThis, '__isolationTicks') as number) + 1), 5);

  // module state, and an environment variable stubbed with vi.stubEnv and never undone
  counter.value = 42;
  vi.stubEnv('ISOLATION_LEAK', 'stubbed');

  expect(counter.value).toBe(42);
});

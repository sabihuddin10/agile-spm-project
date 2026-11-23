/**
 * usePolling lifecycle (bolt 005): single flight, recovery from failures, cleanup on
 * disable/unmount/interval change, visibility handling and Strict Mode replay.
 */
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { usePolling } from '@/hooks/use-polling';

/** A promise whose settlement the test controls, standing in for a slow request. */
function deferred() {
  let resolve!: () => void;
  let reject!: (err: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event('visibilitychange'));
}

/** Let a settled promise's .then/.finally handlers run. */
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
const advance = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

let unhandled: unknown[];
const onUnhandled = (reason: unknown) => unhandled.push(reason);

beforeEach(() => {
  vi.useFakeTimers();
  unhandled = [];
  process.on('unhandledRejection', onUnhandled);
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
});

afterEach(() => {
  process.off('unhandledRejection', onUnhandled);
  vi.useRealTimers();
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
});

describe('basic polling', () => {
  test('runs the callback on every interval, including a plain synchronous one', async () => {
    // Arrange
    const callback = vi.fn();
    renderHook(() => usePolling(callback, 1000));

    // Act
    await advance(3000);

    // Assert
    expect(callback).toHaveBeenCalledTimes(3);
  });

  test('uses the latest callback without restarting the timer', async () => {
    // Arrange
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ cb }) => usePolling(cb, 1000), { initialProps: { cb: first } });
    await advance(1000);

    // Act
    rerender({ cb: second });
    await advance(1000);

    // Assert
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  test('does nothing while disabled', async () => {
    // Arrange
    const callback = vi.fn();
    renderHook(() => usePolling(callback, 1000, false));

    // Act
    await advance(5000);
    setHidden(true);
    setHidden(false);

    // Assert
    expect(callback).not.toHaveBeenCalled();
  });
});

describe('single flight', () => {
  test('a slow callback is not started again by later intervals', async () => {
    // Arrange
    const slow = deferred();
    const callback = vi.fn(() => slow.promise);
    renderHook(() => usePolling(callback, 1000));

    // Act
    await advance(5000);

    // Assert
    expect(callback).toHaveBeenCalledTimes(1);
  });

  test('once the slow callback settles, the next interval runs again', async () => {
    // Arrange
    const slow = deferred();
    const callback = vi.fn().mockReturnValueOnce(slow.promise).mockResolvedValue(undefined);
    renderHook(() => usePolling(callback, 1000));
    await advance(3000);
    expect(callback).toHaveBeenCalledTimes(1);

    // Act
    slow.resolve();
    await flush();
    await advance(1000);

    // Assert
    expect(callback).toHaveBeenCalledTimes(2);
  });

  test('a visibility change does not start a second callback while one is in flight', async () => {
    // Arrange
    const slow = deferred();
    const callback = vi.fn(() => slow.promise);
    renderHook(() => usePolling(callback, 1000));
    await advance(1000);

    // Act
    setHidden(true);
    setHidden(false);

    // Assert
    expect(callback).toHaveBeenCalledTimes(1);
  });

  test('changing the interval during a slow request does not allow an overlapping callback', async () => {
    // Arrange
    const slow = deferred();
    const callback = vi.fn(() => slow.promise);
    const { rerender } = renderHook(({ ms }) => usePolling(callback, ms), { initialProps: { ms: 1000 } });
    await advance(1000);
    expect(callback).toHaveBeenCalledTimes(1);

    // Act
    rerender({ ms: 500 });
    await advance(3000);

    // Assert
    expect(callback).toHaveBeenCalledTimes(1);
  });
});

describe('failures', () => {
  test('a rejected callback causes no unhandled rejection and polling recovers on the next interval', async () => {
    // Arrange
    const callback = vi.fn().mockRejectedValueOnce(new Error('network down')).mockResolvedValue(undefined);
    renderHook(() => usePolling(callback, 1000));

    // Act
    await advance(1000);
    await flush();
    await advance(1000);

    // Assert
    expect(callback).toHaveBeenCalledTimes(2);
    expect(unhandled).toEqual([]);
  });

  test('a callback that throws synchronously does not stop the poller', async () => {
    // Arrange
    const callback = vi.fn().mockImplementationOnce(() => { throw new Error('boom'); }).mockReturnValue(undefined);
    renderHook(() => usePolling(callback, 1000));

    // Act
    await advance(2000);

    // Assert
    expect(callback).toHaveBeenCalledTimes(2);
  });
});

describe('cleanup', () => {
  test('unmounting stops all further cycles', async () => {
    // Arrange
    const callback = vi.fn();
    const { unmount } = renderHook(() => usePolling(callback, 1000));
    await advance(1000);

    // Act
    unmount();
    await advance(5000);
    setHidden(true);
    setHidden(false);

    // Assert
    expect(callback).toHaveBeenCalledTimes(1);
  });

  test('disabling stops cycles, and re-enabling resumes them', async () => {
    // Arrange
    const callback = vi.fn();
    const { rerender } = renderHook(({ on }) => usePolling(callback, 1000, on), { initialProps: { on: true } });
    await advance(1000);

    // Act
    rerender({ on: false });
    await advance(3000);
    const whileDisabled = callback.mock.calls.length;
    rerender({ on: true });
    await advance(1000);

    // Assert
    expect(whileDisabled).toBe(1);
    expect(callback).toHaveBeenCalledTimes(2);
  });

  test('a callback that settles after unmount starts nothing new', async () => {
    // Arrange
    const slow = deferred();
    const callback = vi.fn(() => slow.promise);
    const { unmount } = renderHook(() => usePolling(callback, 1000));
    await advance(1000);

    // Act
    unmount();
    slow.resolve();
    await flush();
    await advance(5000);

    // Assert
    expect(callback).toHaveBeenCalledTimes(1);
  });

  test('a callback that rejects after unmount causes no unhandled rejection', async () => {
    // Arrange
    const slow = deferred();
    const callback = vi.fn(() => slow.promise);
    const { unmount } = renderHook(() => usePolling(callback, 1000));
    await advance(1000);

    // Act
    unmount();
    slow.reject(new Error('late failure'));
    await flush();

    // Assert
    expect(unhandled).toEqual([]);
  });

  test('changing the interval clears the old schedule: no double ticking', async () => {
    // Arrange
    const callback = vi.fn();
    const { rerender } = renderHook(({ ms }) => usePolling(callback, ms), { initialProps: { ms: 1000 } });

    // Act
    rerender({ ms: 2000 });
    await advance(4000);

    // Assert
    expect(callback).toHaveBeenCalledTimes(2);
  });

  test("Strict Mode's effect replay leaves a single live timer", async () => {
    // Arrange
    const callback = vi.fn();
    renderHook(() => usePolling(callback, 1000), { wrapper: StrictMode });

    // Act
    await advance(3000);

    // Assert
    expect(callback).toHaveBeenCalledTimes(3);
  });
});

describe('visibility', () => {
  test('a hidden tab is not polled', async () => {
    // Arrange
    const callback = vi.fn();
    renderHook(() => usePolling(callback, 1000));
    setHidden(true);

    // Act
    await advance(5000);

    // Assert
    expect(callback).not.toHaveBeenCalled();
  });

  test('becoming visible with nothing running triggers one immediate refresh', async () => {
    // Arrange
    const callback = vi.fn();
    renderHook(() => usePolling(callback, 60_000));
    setHidden(true);

    // Act
    setHidden(false);

    // Assert
    expect(callback).toHaveBeenCalledTimes(1);
  });
});

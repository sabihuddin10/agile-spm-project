/**
 * Workforce adapter (bolt 006): the real API and the in-browser mock are separated at the module
 * boundary. Real mode must behave exactly as before and must never load or instantiate the mock;
 * mock mode (what the unit tests use) stays available and deterministic.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const apiSpy = vi.fn();
const settingsGet = vi.fn();
const settingsUpdate = vi.fn();

/** Loads a fresh copy of the adapter with the given flag value (undefined removes the variable). */
type ModuleFactory = () => Record<string, unknown>;
async function loadAdapter(flag: string | undefined, { mockFactory }: { mockFactory?: ModuleFactory } = {}) {
  vi.resetModules();
  if (flag === undefined) vi.stubEnv('NEXT_PUBLIC_WORKFORCE_MOCK', undefined as unknown as string);
  else vi.stubEnv('NEXT_PUBLIC_WORKFORCE_MOCK', flag);
  vi.doMock('@/lib/api', () => ({
    api: apiSpy,
    settingsApi: { get: settingsGet, update: settingsUpdate },
  }));
  if (mockFactory) vi.doMock('@/lib/workforce-mock', mockFactory);
  return import('@/lib/workforce-api');
}

beforeEach(() => {
  apiSpy.mockReset().mockResolvedValue({ ok: true });
  settingsGet.mockReset();
  settingsUpdate.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.doUnmock('@/lib/api');
  vi.doUnmock('@/lib/workforce-mock');
  vi.resetModules();
});

/** A stand-in for the mock module that fails loudly if the adapter ever imports it. */
const mockModuleMustNotLoad: ModuleFactory = () => {
  throw new Error('the workforce mock module must not be loaded in real mode');
};

describe('real mode (flag is not exactly "true")', () => {
  test.each([[undefined], ['false'], [''], ['TRUE'], ['True'], ['1'], ['yes'], [' true'], ['true ']])(
    'flag %j selects the real API and never loads the mock module',
    async (flag) => {
      // Arrange
      const adapter = await loadAdapter(flag as string | undefined, { mockFactory: mockModuleMustNotLoad });

      // Act
      await adapter.workforceApi.clockIn();

      // Assert: reaching the API without the throwing mock factory ever running proves the mock was not loaded
      expect(adapter.WORKFORCE_MOCK).toBe(false);
      expect(apiSpy).toHaveBeenCalledWith('/attendance/clock-in', { method: 'POST' });
    },
  );

  test('every operation goes through the existing API contracts', async () => {
    // Arrange
    const { workforceApi } = await loadAdapter(undefined, { mockFactory: mockModuleMustNotLoad });

    // Act
    await workforceApi.me();
    await workforceApi.clockOut();
    await workforceApi.startBreak();
    await workforceApi.endBreak();
    await workforceApi.presence();
    await workforceApi.myAnalytics({ from: '2026-11-01', to: '2026-11-30' });
    await workforceApi.userAnalytics('usr a/b', { from: '2026-11-01' });
    await workforceApi.overview('2026-11');
    await workforceApi.setWage('usr_chef', 18);
    await workforceApi.addAdjustment('usr_chef', { amount: 5, reason: 'bonus', date: '2026-11-17' });
    await workforceApi.removeAdjustment('usr_chef', 'adj 1');

    // Assert
    expect(apiSpy.mock.calls).toEqual([
      ['/attendance/me'],
      ['/attendance/clock-out', { method: 'POST' }],
      ['/attendance/break/start', { method: 'POST' }],
      ['/attendance/break/end', { method: 'POST' }],
      ['/attendance/presence'],
      ['/workforce/me?from=2026-11-01&to=2026-11-30'],
      ['/workforce/users/usr%20a%2Fb?from=2026-11-01'],
      ['/workforce/overview?month=2026-11'],
      ['/workforce/users/usr_chef/wage', { method: 'PUT', body: { hourlyWage: 18 } }],
      ['/workforce/users/usr_chef/adjustments', { method: 'POST', body: { amount: 5, reason: 'bonus', date: '2026-11-17' } }],
      ['/workforce/users/usr_chef/adjustments/adj%201', { method: 'DELETE' }],
    ]);
  });

  test('attendance settings come from /api/settings, keeping only the numeric attendance fields', async () => {
    // Arrange
    const { workforceApi } = await loadAdapter(undefined, { mockFactory: mockModuleMustNotLoad });
    settingsGet.mockResolvedValue({ settings: { lateGraceMinutes: 9, latePenalty: 'x', taxRate: 0.1, autoBreakMinutes: 45 } });
    settingsUpdate.mockResolvedValue({ settings: { lateGraceMinutes: 7 } });

    // Act
    const read = await workforceApi.getSettings();
    const written = await workforceApi.updateSettings({ lateGraceMinutes: 7 });

    // Assert: non-numeric and unrelated fields fall back to the defaults / are dropped
    expect(read).toEqual({ lateGraceMinutes: 9, latePenalty: 5, autoBreakMinutes: 45, autoBreakAfterHours: 6 });
    expect(written).toEqual({ lateGraceMinutes: 7, latePenalty: 5, autoBreakMinutes: 60, autoBreakAfterHours: 6 });
    expect(settingsUpdate).toHaveBeenCalledWith({ lateGraceMinutes: 7 });
  });

  test('asking for the mock directly fails with an actionable error, and does not load it', async () => {
    // Arrange
    const { getWorkforceMock } = await loadAdapter(undefined, { mockFactory: mockModuleMustNotLoad });

    // Act / Assert
    await expect(getWorkforceMock()).rejects.toThrow(/only available when NEXT_PUBLIC_WORKFORCE_MOCK=true/);
  });

  test('setWorkforceMockUser is a no-op, so no demo identity is kept in real mode', async () => {
    // Arrange
    const { setWorkforceMockUser, workforceApi } = await loadAdapter(undefined, { mockFactory: mockModuleMustNotLoad });

    // Act
    setWorkforceMockUser({ id: 'usr_admin', role: 'admin' } as never);
    await workforceApi.me();

    // Assert
    expect(apiSpy).toHaveBeenCalledWith('/attendance/me');
  });
});

describe('mock mode (NEXT_PUBLIC_WORKFORCE_MOCK=true, as the unit tests use)', () => {
  test('is selected only by the exact value "true" and never touches the API', async () => {
    // Arrange
    const adapter = await loadAdapter('true');
    adapter.setWorkforceMockUser({ id: 'usr_waiter', name: 'Will Waiter', email: 'waiter@rest.test', role: 'waiter', active: true } as never);

    // Act
    const status = await adapter.workforceApi.me();

    // Assert
    expect(adapter.WORKFORCE_MOCK).toBe(true);
    expect(status).toBeTruthy();
    expect(apiSpy).not.toHaveBeenCalled();
  });

  test('the adapter and the tests share one mock instance, created once', async () => {
    // Arrange
    const { getWorkforceMock } = await loadAdapter('true');

    // Act
    const [a, b] = await Promise.all([getWorkforceMock(), getWorkforceMock()]);

    // Assert
    expect(a).toBe(b);
    expect(typeof a.reset).toBe('function');
  });

  test('the mock is deterministic: reset restores the same starting state', async () => {
    // Arrange
    const adapter = await loadAdapter('true');
    const mock = await adapter.getWorkforceMock();
    adapter.setWorkforceMockUser({ id: 'usr_manager', name: 'Maya Manager', email: 'manager@rest.test', role: 'manager', active: true } as never);
    localStorage.clear(); // as the page tests do: saved settings live in localStorage, outside reset()
    mock.reset();
    const before = await adapter.workforceApi.getSettings();

    // Act
    await adapter.workforceApi.updateSettings({ lateGraceMinutes: 30 });
    localStorage.clear();
    mock.reset();
    const after = await adapter.workforceApi.getSettings();

    // Assert
    expect(after).toEqual(before);
  });

  test('a mock module that fails to load gives an actionable error on every call', async () => {
    // Arrange
    const adapter = await loadAdapter('true', {
      mockFactory: (): Record<string, unknown> => {
        throw new Error('chunk 4017 failed to load');
      },
    });

    // Act / Assert
    // The message names the flag so a developer knows what to check (the underlying reason is appended).
    await expect(adapter.getWorkforceMock()).rejects.toThrow(/Could not load the workforce mock \(NEXT_PUBLIC_WORKFORCE_MOCK=true\): /);
    await expect(adapter.workforceApi.me()).rejects.toThrow(/Could not load the workforce mock/);
  });
});

describe('the defaults real screens use do not come from the mock module', () => {
  test('attendance-defaults has the shared defaults, and the mock still re-exports the same object', async () => {
    // Arrange / Act
    const defaults = await import('@/lib/attendance-defaults');
    const viaMock = await import('@/lib/workforce-mock');

    // Assert
    expect(defaults.DEFAULT_ATTENDANCE_SETTINGS).toEqual({ lateGraceMinutes: 5, latePenalty: 5, autoBreakMinutes: 60, autoBreakAfterHours: 6 });
    expect(viaMock.DEFAULT_ATTENDANCE_SETTINGS).toBe(defaults.DEFAULT_ATTENDANCE_SETTINGS);
  });
});

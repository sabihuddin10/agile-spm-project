import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { AUTH_EXPIRED_EVENT, AuthProvider, useAuth } from '@/context/auth-context';
import { authApi, getStoredToken, getStoredUser, storeAuth, clearAuth } from '@/lib/api';
import type { User } from '@/types';

vi.mock('@/lib/api', () => ({
  authApi: { login: vi.fn(), register: vi.fn(), me: vi.fn() },
  clearAuth: vi.fn(),
  getStoredToken: vi.fn(() => null),
  getStoredUser: vi.fn(() => null),
  storeAuth: vi.fn(),
}));

function makeUser(overrides: Partial<User> = {}): User {
  return { id: 'usr_1', name: 'Casey Customer', email: 'casey@example.com', role: 'customer', active: true, ...overrides };
}

function renderAuth() {
  return renderHook(() => useAuth(), { wrapper: AuthProvider });
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.mocked(getStoredToken).mockReturnValue(null);
    vi.mocked(getStoredUser).mockReturnValue(null);
  });

  afterEach(() => vi.clearAllMocks());

  it('does nothing when there is no stored session', async () => {
    // Arrange / Act
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Assert
    expect(result.current.user).toBe(null);
    expect(authApi.me).not.toHaveBeenCalled();
  });

  it('restores a stored session immediately, then re-validates it with the server', async () => {
    // Arrange
    const stored = makeUser({ name: 'Stale Name' });
    const fresh = makeUser({ name: 'Fresh Name' });
    vi.mocked(getStoredToken).mockReturnValue('tok_1');
    vi.mocked(getStoredUser).mockReturnValue(stored);
    vi.mocked(authApi.me).mockResolvedValue({ user: fresh });

    // Act
    const { result } = renderAuth();

    // Assert — the stored session is visible right away
    expect(result.current.user).toEqual(stored);

    // Assert — it is then replaced by the server's answer
    await waitFor(() => expect(result.current.user).toEqual(fresh));
    expect(storeAuth).toHaveBeenCalledWith('tok_1', fresh);
  });

  it('keeps the current session when re-validation fails', async () => {
    // Arrange
    const stored = makeUser();
    vi.mocked(getStoredToken).mockReturnValue('tok_1');
    vi.mocked(getStoredUser).mockReturnValue(stored);
    vi.mocked(authApi.me).mockRejectedValue(new Error('401'));

    // Act
    const { result } = renderAuth();
    await waitFor(() => expect(authApi.me).toHaveBeenCalled());

    // Assert
    expect(result.current.user).toEqual(stored);
  });

  it('login sets the user and token and persists them', async () => {
    // Arrange
    const user = makeUser();
    vi.mocked(authApi.login).mockResolvedValue({ user, token: 'tok_new' });
    const { result } = renderAuth();

    // Act
    await act(async () => {
      await result.current.login('casey@example.com', 'secret1');
    });

    // Assert
    expect(result.current.user).toEqual(user);
    expect(result.current.token).toBe('tok_new');
    expect(storeAuth).toHaveBeenCalledWith('tok_new', user);
  });

  it('register sets the user and token and persists them', async () => {
    // Arrange
    const user = makeUser({ name: 'Nina New' });
    vi.mocked(authApi.register).mockResolvedValue({ user, token: 'tok_reg' });
    const { result } = renderAuth();

    // Act
    await act(async () => {
      await result.current.register('Nina New', 'nina@example.com', 'secret1');
    });

    // Assert
    expect(result.current.user).toEqual(user);
    expect(storeAuth).toHaveBeenCalledWith('tok_reg', user);
  });

  it('logout clears the session', async () => {
    // Arrange
    const user = makeUser();
    vi.mocked(authApi.login).mockResolvedValue({ user, token: 'tok_1' });
    const { result } = renderAuth();
    await act(async () => {
      await result.current.login('casey@example.com', 'secret1');
    });

    // Act
    act(() => result.current.logout());

    // Assert
    expect(result.current.user).toBe(null);
    expect(result.current.token).toBe(null);
    expect(clearAuth).toHaveBeenCalled();
  });

  it('hasRole reflects the signed-in user only', async () => {
    // Arrange
    const manager = makeUser({ role: 'manager' });
    vi.mocked(authApi.login).mockResolvedValue({ user: manager, token: 'tok_1' });
    const { result } = renderAuth();

    // Assert — signed out
    expect(result.current.hasRole('manager', 'admin')).toBe(false);

    // Act
    await act(async () => {
      await result.current.login('maya@rest.test', 'secret1');
    });

    // Assert
    expect(result.current.hasRole('manager', 'admin')).toBe(true);
    expect(result.current.hasRole('chef')).toBe(false);
  });

  it('clears the session when an auth:expired event fires', async () => {
    // Arrange
    const user = makeUser();
    vi.mocked(authApi.login).mockResolvedValue({ user, token: 'tok_1' });
    const { result } = renderAuth();
    await act(async () => {
      await result.current.login('casey@example.com', 'secret1');
    });

    // Act
    act(() => window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT)));

    // Assert
    expect(result.current.user).toBe(null);
    expect(result.current.token).toBe(null);
  });
});

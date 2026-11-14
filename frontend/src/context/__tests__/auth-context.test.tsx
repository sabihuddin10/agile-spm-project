import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { AUTH_EXPIRED_EVENT, AuthProvider, useAuth } from '@/context/auth-context';
import { ApiError, authApi } from '@/lib/api';
import type { User } from '@/types';

vi.mock('@/lib/api', async (original) => ({
  ...await original<typeof import('@/lib/api')>(),
  authApi: { login: vi.fn(), register: vi.fn(), me: vi.fn(), logout: vi.fn() },
}));

const customer: User = { id: 'usr_1', name: 'Casey Customer', email: 'casey@example.com', role: 'customer', active: true };
const manager: User = { ...customer, role: 'manager' };
const renderAuth = () => renderHook(() => useAuth(), { wrapper: AuthProvider });

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  vi.mocked(authApi.me).mockRejectedValue(new ApiError('Authentication required.', 401, null));
});

describe('AuthProvider', () => {
  it('waits for the server before trusting the session and deletes legacy browser credentials', async () => {
    // Arrange
    localStorage.setItem('restaurant_ops_token', 'legacy-token');
    localStorage.setItem('restaurant_ops_user', JSON.stringify(manager));
    vi.mocked(authApi.me).mockResolvedValue({ user: customer });

    // Act
    const { result } = renderAuth();

    // Assert
    expect(result.current.user).toBeNull();
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.user).toEqual(customer));
    expect(result.current.loading).toBe(false);
    expect(result.current.hasRole('manager')).toBe(false);
    expect(localStorage.getItem('restaurant_ops_token')).toBeNull();
    expect(localStorage.getItem('restaurant_ops_user')).toBeNull();
  });

  it('becomes a guest when the server reports no session', async () => {
    // Arrange
    const { result } = renderAuth();

    // Act
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Assert
    expect(result.current.user).toBeNull();
  });

  it('uses the signed-in user and clears state only after server logout succeeds', async () => {
    // Arrange
    vi.mocked(authApi.login).mockResolvedValue({ user: manager });
    vi.mocked(authApi.logout).mockResolvedValue(null);
    const { result } = renderAuth();
    await act(async () => { await result.current.login(manager.email, 'secret'); });
    const signedIn = result.current.user;

    // Act
    await act(async () => { await result.current.logout(); });

    // Assert
    expect(signedIn).toEqual(manager);
    expect(authApi.logout).toHaveBeenCalledOnce();
    expect(result.current.user).toBeNull();
  });

  it('keeps the session available for retry if logout fails', async () => {
    // Arrange
    vi.mocked(authApi.me).mockResolvedValue({ user: manager });
    vi.mocked(authApi.logout).mockRejectedValue(new Error('Network error'));
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.user).toEqual(manager));

    // Act
    await act(async () => { await result.current.logout(); });

    // Assert
    expect(result.current.user).toEqual(manager);
    expect(result.current.signingOut).toBe(false);
  });

  it('uses the registered user and refreshes state after a profile change', async () => {
    // Arrange
    vi.mocked(authApi.register).mockResolvedValue({ user: customer });
    const { result } = renderAuth();
    await act(async () => { await result.current.register(customer.name, customer.email, 'secret'); });
    const updated = { ...customer, name: 'Casey Renamed' };

    // Act
    act(() => result.current.updateSession(updated));

    // Assert
    expect(result.current.user).toEqual(updated);
    expect(localStorage.length).toBe(0);
  });

  it('clears the signed-in user after an auth:expired event', async () => {
    // Arrange
    vi.mocked(authApi.me).mockResolvedValue({ user: manager });
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.hasRole('manager')).toBe(true));

    // Act
    act(() => window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT)));

    // Assert
    expect(result.current.user).toBeNull();
  });
});

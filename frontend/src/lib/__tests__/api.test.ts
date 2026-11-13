import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, authApi, clearLegacyAuth, customerApi } from '@/lib/api';

function mockFetchOnce(status: number, body: unknown, ok = status >= 200 && status < 300) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    status,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('legacy session cleanup', () => {
  beforeEach(() => localStorage.clear());

  it('removes the old token and cached user', () => {
    // Arrange
    localStorage.setItem('restaurant_ops_token', 'tok_123');
    localStorage.setItem('restaurant_ops_user', '{"id":"usr_1"}');

    // Act
    clearLegacyAuth();

    // Assert
    expect(localStorage.getItem('restaurant_ops_token')).toBeNull();
    expect(localStorage.getItem('restaurant_ops_user')).toBeNull();
  });
});

describe('api()', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('uses same-origin cookies and marks mutations without attaching a legacy token', async () => {
    // Arrange
    localStorage.setItem('restaurant_ops_token', 'legacy-session');
    const fetchMock = mockFetchOnce(200, { ok: true });

    // Act
    await api('/auth/logout', { method: 'POST' });

    // Assert
    const [, init] = fetchMock.mock.calls[0];
    const headers = new Headers(init.headers);
    expect(init.credentials).toBe('same-origin');
    expect(headers.get('Authorization')).toBeNull();
    expect(headers.get('X-Requested-With')).toBe('RestaurantOps');
  });

  it('omits the mutation header for reads', async () => {
    // Arrange
    const fetchMock = mockFetchOnce(200, { ok: true });

    // Act
    await api('/menu');

    // Assert
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.get('X-Requested-With')).toBeNull();
  });

  it('serializes the request body as JSON', async () => {
    // Arrange
    const fetchMock = mockFetchOnce(200, { ok: true });

    // Act
    await api('/menu/items', { method: 'POST', body: { name: 'Tiramisu' } });

    // Assert
    const [, init] = fetchMock.mock.calls[0];
    expect(init.body).toBe(JSON.stringify({ name: 'Tiramisu' }));
  });

  it('parses a successful JSON response', async () => {
    // Arrange
    mockFetchOnce(200, { menu: [] });

    // Act
    const result = await api('/menu');

    // Assert
    expect(result).toEqual({ menu: [] });
  });

  it('throws an ApiError carrying the status and parsed body on failure', async () => {
    // Arrange
    mockFetchOnce(409, { error: 'Fully booked', alternatives: [{ date: '2026-10-08', time: '19:00' }] });

    // Act / Assert
    await expect(api('/reservations', { method: 'POST', body: {} })).rejects.toMatchObject({
      message: 'Fully booked',
      status: 409,
      data: { error: 'Fully booked', alternatives: [{ date: '2026-10-08', time: '19:00' }] },
    });
  });

  it('falls back to a generic message when the error body has no error field', async () => {
    // Arrange
    mockFetchOnce(500, {});

    // Act / Assert
    await expect(api('/menu')).rejects.toThrow('Request failed with status 500');
  });

  it('is an instance of ApiError', async () => {
    // Arrange
    mockFetchOnce(400, { error: 'Bad input' });

    // Act
    const err = await api('/menu').catch((e) => e);

    // Assert
    expect(err).toBeInstanceOf(ApiError);
  });

  it('notifies the provider of a 401 from a protected API endpoint', async () => {
    // Arrange
    const onExpired = vi.fn();
    window.addEventListener('auth:expired', onExpired, { once: true });
    mockFetchOnce(401, { error: 'Invalid or expired token.' });

    // Act
    await api('/orders').catch(() => undefined);

    // Assert
    expect(onExpired).toHaveBeenCalledOnce();
  });

  it('builds a query string from the given params, dropping empty ones', async () => {
    // Arrange
    const fetchMock = mockFetchOnce(200, { customers: [] });

    // Act
    await customerApi.list({ q: 'sofia', type: '' });

    // Assert
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/customers?q=sofia');
  });
});

describe('authApi account endpoints', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  const cases: [string, () => Promise<unknown>, string, string, unknown][] = [
    [
      'updateMe',
      () => authApi.updateMe({ email: 'new@rest.test', currentPassword: 'old-pass' }),
      '/api/auth/me',
      'PATCH',
      { email: 'new@rest.test', currentPassword: 'old-pass' },
    ],
    [
      'changePassword',
      () => authApi.changePassword('old-pass', 'new-pass'),
      '/api/auth/me/password',
      'POST',
      { currentPassword: 'old-pass', newPassword: 'new-pass' },
    ],
    [
      'updateUserProfile',
      () => authApi.updateUserProfile('usr_9', { phone: '+92 300 5550101' }),
      '/api/auth/users/usr_9/profile',
      'PATCH',
      { phone: '+92 300 5550101' },
    ],
    ['resetPassword', () => authApi.resetPassword('usr_9'), '/api/auth/users/usr_9/reset-password', 'POST', undefined],
    ['logout', () => authApi.logout(), '/api/auth/logout', 'POST', undefined],
    ['setUserPassword', () => authApi.setUserPassword('usr_9', 'new-pass'), '/api/auth/users/usr_9/password', 'POST', { newPassword: 'new-pass' }],
  ];

  for (const [name, call, url, method, body] of cases) {
    it(`${name} sends ${method} ${url}`, async () => {
      // Arrange
      const fetchMock = mockFetchOnce(200, { user: { id: 'usr_9' } });

      // Act
      await call();

      // Assert
      const [calledUrl, init] = fetchMock.mock.calls[0];
      expect(calledUrl).toBe(url);
      expect(init.method).toBe(method);
      expect(init.body).toBe(body === undefined ? undefined : JSON.stringify(body));
    });
  }

  it('surfaces a wrong current password (400) as an error without ending the session', async () => {
    // Arrange
    const onExpired = vi.fn();
    window.addEventListener('auth:expired', onExpired);
    mockFetchOnce(400, { error: 'Current password is incorrect.' });

    // Act
    const err = await authApi.changePassword('nope', 'new-pass').catch((e) => e);

    // Assert
    expect(err).toMatchObject({ status: 400, message: 'Current password is incorrect.' });
    expect(onExpired).not.toHaveBeenCalled();
    window.removeEventListener('auth:expired', onExpired);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, clearAuth, customerApi, getStoredToken, getStoredUser, storeAuth } from '@/lib/api';

function mockFetchOnce(status: number, body: unknown, ok = status >= 200 && status < 300) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    status,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('token/user storage', () => {
  beforeEach(() => localStorage.clear());

  it('stores and retrieves a token and user together', () => {
    // Arrange
    const user = { id: 'usr_1', name: 'Casey' };

    // Act
    storeAuth('tok_123', user);

    // Assert
    expect(getStoredToken()).toBe('tok_123');
    expect(getStoredUser()).toEqual(user);
  });

  it('clearAuth removes both the token and the user', () => {
    // Arrange
    storeAuth('tok_123', { id: 'usr_1' });

    // Act
    clearAuth();

    // Assert
    expect(getStoredToken()).toBe(null);
    expect(getStoredUser()).toBe(null);
  });

  it('getStoredUser returns null for corrupted stored JSON', () => {
    // Arrange
    localStorage.setItem('restaurant_ops_user', '{not json');

    // Act / Assert
    expect(getStoredUser()).toBe(null);
  });
});

describe('api()', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('attaches a Bearer token when one is stored, and omits it otherwise', async () => {
    // Arrange
    storeAuth('tok_abc', { id: 'usr_1' });
    const fetchMock = mockFetchOnce(200, { ok: true });

    // Act
    await api('/menu');

    // Assert
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer tok_abc');
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

  it('clears the session and redirects on a 401 from a protected page', async () => {
    // Arrange
    storeAuth('tok_abc', { id: 'usr_1' });
    const assign = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, pathname: '/staff/orders', assign },
      writable: true,
    });
    const events: string[] = [];
    window.addEventListener('auth:expired', () => events.push('auth:expired'));
    mockFetchOnce(401, { error: 'Invalid or expired token.' });

    // Act
    await api('/orders').catch(() => undefined);

    // Assert
    expect(getStoredToken()).toBe(null);
    expect(events).toContain('auth:expired');
    expect(assign).toHaveBeenCalledWith('/login?expired=1');
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

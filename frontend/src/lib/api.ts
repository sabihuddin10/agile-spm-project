const API_BASE = '/api';

const TOKEN_KEY = 'restaurant_ops_token';
const USER_KEY = 'restaurant_ops_user';

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser<T = unknown>(): T | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function storeAuth<T>(token: string, user: T): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

interface ApiOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

export async function api<T = unknown>(path: string, options: ApiOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options;
  const token = getStoredToken();

  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const message =
      (data as { error?: string } | null)?.error ||
      `Request failed with status ${res.status}`;
    const error = new Error(message) as Error & { status?: number };
    error.status = res.status;
    throw error;
  }

  return data as T;
}

export const authApi = {
  login: (email: string, password: string) =>
    api<{ user: import('../types').User; token: string }>('/auth/login', {
      method: 'POST',
      body: { email, password },
    }),
  register: (name: string, email: string, password: string) =>
    api<{ user: import('../types').User; token: string }>('/auth/register', {
      method: 'POST',
      body: { name, email, password },
    }),
  me: () => api<{ user: import('../types').User }>('/auth/me'),
  users: () => api<{ users: import('../types').User[] }>('/auth/users'),
  updateUser: (id: string, data: Partial<import('../types').User>) =>
    api<{ user: import('../types').User }>(`/auth/users/${id}`, { method: 'PATCH', body: data }),
};

export const customerApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params).toString()}` : '';
    return api<{ customers: import('../types').Customer[] }>(`/customers${qs}`);
  },
  get: (id: string) => api<{ customer: import('../types').Customer }>(`/customers/${id}`),
  create: (data: Partial<import('../types').Customer>) =>
    api<{ customer: import('../types').Customer }>('/customers', { method: 'POST', body: data }),
  update: (id: string, data: Partial<import('../types').Customer>) =>
    api<{ customer: import('../types').Customer }>(`/customers/${id}`, { method: 'PATCH', body: data }),
  remove: (id: string) => api<{ deleted: boolean }>(`/customers/${id}`, { method: 'DELETE' }),
  me: () => api<{ customer: import('../types').Customer }>('/customers/me'),
  updateMe: (data: Partial<import('../types').Customer>) =>
    api<{ customer: import('../types').Customer }>('/customers/me', { method: 'PATCH', body: data }),
};

export const menuApi = {
  get: () => api<import('../types').MenuResponse>('/menu'),
  categories: () => api<{ categories: import('../types').MenuCategory[] }>('/menu/categories'),
  createCategory: (name: string, sort?: number) =>
    api<{ category: import('../types').MenuCategory }>('/menu/categories', { method: 'POST', body: { name, sort } }),
  updateCategory: (id: string, data: Partial<import('../types').MenuCategory>) =>
    api<{ category: import('../types').MenuCategory }>(`/menu/categories/${id}`, { method: 'PATCH', body: data }),
  removeCategory: (id: string) => api<{ deleted: boolean }>(`/menu/categories/${id}`, { method: 'DELETE' }),
  createItem: (data: Partial<import('../types').MenuItem>) =>
    api<{ item: import('../types').MenuItem }>('/menu/items', { method: 'POST', body: data }),
  updateItem: (id: string, data: Partial<import('../types').MenuItem>) =>
    api<{ item: import('../types').MenuItem }>(`/menu/items/${id}`, { method: 'PATCH', body: data }),
  removeItem: (id: string) => api<{ deleted: boolean }>(`/menu/items/${id}`, { method: 'DELETE' }),
};

export const orderApi = {
  create: (data: Record<string, unknown>) =>
    api<{ order: import('../types').Order }>('/orders', { method: 'POST', body: data }),
  list: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params).toString()}` : '';
    return api<{ orders: import('../types').Order[] }>(`/orders${qs}`);
  },
  mine: () => api<{ orders: import('../types').Order[] }>('/orders/mine'),
  get: (id: string) => api<{ order: import('../types').Order }>(`/orders/${id}`),
  update: (id: string, data: Record<string, unknown>) =>
    api<{ order: import('../types').Order }>(`/orders/${id}`, { method: 'PATCH', body: data }),
  remove: (id: string) => api<{ deleted: boolean }>(`/orders/${id}`, { method: 'DELETE' }),
};

export const tableApi = {
  list: () => api<{ tables: import('../types').Table[] }>('/tables'),
  create: (data: Record<string, unknown>) =>
    api<{ table: import('../types').Table }>('/tables', { method: 'POST', body: data }),
  update: (id: string, data: Record<string, unknown>) =>
    api<{ table: import('../types').Table }>(`/tables/${id}`, { method: 'PATCH', body: data }),
  remove: (id: string) => api<{ deleted: boolean }>(`/tables/${id}`, { method: 'DELETE' }),
};

export const inventoryApi = {
  list: () => api<{ inventory: import('../types').InventoryItem[]; units: string[] }>('/inventory'),
  create: (data: Record<string, unknown>) =>
    api<{ item: import('../types').InventoryItem }>('/inventory', { method: 'POST', body: data }),
  update: (id: string, data: Record<string, unknown>) =>
    api<{ item: import('../types').InventoryItem }>(`/inventory/${id}`, { method: 'PATCH', body: data }),
  remove: (id: string) => api<{ deleted: boolean }>(`/inventory/${id}`, { method: 'DELETE' }),
};

export const reservationApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params).toString()}` : '';
    return api<{ reservations: import('../types').Reservation[] }>(`/reservations${qs}`);
  },
  mine: () => api<{ reservations: import('../types').Reservation[] }>('/reservations/mine'),
  create: (data: Record<string, unknown>) =>
    api<{ reservation: import('../types').Reservation }>('/reservations', { method: 'POST', body: data }),
  update: (id: string, data: Record<string, unknown>) =>
    api<{ reservation: import('../types').Reservation }>(`/reservations/${id}`, { method: 'PATCH', body: data }),
  remove: (id: string) => api<{ deleted: boolean }>(`/reservations/${id}`, { method: 'DELETE' }),
};

export const billingApi = {
  list: () => api<{ bills: import('../types').Bill[] }>('/billing'),
  get: (id: string) => api<{ invoice: import('../types').Invoice }>(`/billing/${id}`),
  pay: (id: string) => api<{ order: import('../types').Order; alreadyPaid?: boolean }>(`/billing/${id}/pay`, { method: 'POST' }),
};

export const analyticsApi = {
  summary: () => api<{ summary: import('../types').AnalyticsSummary }>('/analytics/summary'),
};
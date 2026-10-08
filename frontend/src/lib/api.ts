import type {
  AlternativeSlot,
  AnalyticsDashboard,
  AnalyticsSummary,
  AppNotification,
  Bill,
  BillingSummary,
  Customer,
  Granularity,
  InventoryItem,
  Invoice,
  KitchenResponse,
  MenuCategory,
  MenuItem,
  MenuResponse,
  NewOrderInput,
  NewOrderLine,
  Order,
  PublicTable,
  PurchaseOrder,
  RecipeLine,
  ReorderLine,
  Reservation,
  ReservationStatus,
  Settings,
  Shift,
  ShiftStatus,
  StaffApplication,
  StaffPerformance,
  StaffRole,
  StockMovement,
  Table,
  TimeSlot,
  User,
} from '@/types';

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

/** Error thrown for non-2xx responses; `data` carries the JSON body (e.g. booking alternatives). */
export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
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

  // A signed-in session that the server rejects (expired token, suspended or
  // removed account) is ended immediately; protected screens go to /login.
  if (res.status === 401 && token && !path.startsWith('/auth/login') && typeof window !== 'undefined') {
    clearAuth();
    window.dispatchEvent(new Event('auth:expired'));
    if (['/staff', '/account', '/dev'].some((p) => window.location.pathname.startsWith(p))) {
      window.location.assign('/login?expired=1');
    }
  }

  if (!res.ok) {
    const message = (data as { error?: string } | null)?.error || `Request failed with status ${res.status}`;
    throw new ApiError(message, res.status, data);
  }

  return data as T;
}

function query(params?: Record<string, string | number | undefined | null>): string {
  if (!params) return '';
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (entries.length === 0) return '';
  return `?${new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString()}`;
}

/* ------------------------------------------------------------------- auth */

export const authApi = {
  login: (email: string, password: string) =>
    api<{ user: User; token: string }>('/auth/login', { method: 'POST', body: { email, password } }),
  register: (name: string, email: string, password: string) =>
    api<{ user: User; token: string }>('/auth/register', { method: 'POST', body: { name, email, password } }),
  me: () => api<{ user: User }>('/auth/me'),
  users: () => api<{ users: User[] }>('/auth/users'),
  updateUser: (id: string, data: { role?: User['role']; active?: boolean }) =>
    api<{ user: User }>(`/auth/users/${id}`, { method: 'PATCH', body: data }),
  removeUser: (id: string) => api<{ deleted: boolean }>(`/auth/users/${id}`, { method: 'DELETE' }),
  /** Staff self-service profile. `currentPassword` is required when the email changes. */
  updateMe: (data: { name?: string; email?: string; phone?: string; currentPassword?: string }) =>
    api<{ user: User }>('/auth/me', { method: 'PATCH', body: data }),
  /** Revokes every other session — store the returned token to stay signed in. */
  changePassword: (currentPassword: string, newPassword: string) =>
    api<{ user: User; token: string }>('/auth/me/password', { method: 'POST', body: { currentPassword, newPassword } }),
  /** Manager/admin editing an account strictly below their own rank. */
  updateUserProfile: (id: string, data: { name?: string; email?: string; phone?: string }) =>
    api<{ user: User }>(`/auth/users/${id}/profile`, { method: 'PATCH', body: data }),
  /** Issues a one-time temporary password and signs that user out everywhere. */
  resetPassword: (id: string) =>
    api<{ user: User; tempPassword: string }>(`/auth/users/${id}/reset-password`, { method: 'POST' }),
};

/* -------------------------------------------------------------- customers */

export const customerApi = {
  list: (params?: { q?: string; type?: string; dietary?: string; allergy?: string }) =>
    api<{ customers: Customer[] }>(`/customers${query(params)}`),
  get: (id: string) => api<{ customer: Customer }>(`/customers/${id}`),
  create: (data: Partial<Customer>) => api<{ customer: Customer }>('/customers', { method: 'POST', body: data }),
  update: (id: string, data: Partial<Customer>) =>
    api<{ customer: Customer }>(`/customers/${id}`, { method: 'PATCH', body: data }),
  remove: (id: string) => api<{ deleted: boolean }>(`/customers/${id}`, { method: 'DELETE' }),
  me: () => api<{ customer: Customer }>('/customers/me'),
  updateMe: (data: Partial<Customer>) => api<{ customer: Customer }>('/customers/me', { method: 'PATCH', body: data }),
};

/* ------------------------------------------------------------------- menu */

export const menuApi = {
  /** Public menu (empty/inactive categories hidden). Pass manage=true on staff screens. */
  get: (manage = false) => api<MenuResponse>(`/menu${manage ? '?scope=manage' : ''}`),
  items: () => api<{ items: MenuItem[] }>('/menu/items'),
  categories: () => api<{ categories: MenuCategory[] }>('/menu/categories'),
  createCategory: (name: string, sort?: number) =>
    api<{ category: MenuCategory }>('/menu/categories', { method: 'POST', body: { name, sort } }),
  updateCategory: (id: string, data: Partial<MenuCategory>) =>
    api<{ category: MenuCategory }>(`/menu/categories/${id}`, { method: 'PATCH', body: data }),
  removeCategory: (id: string) => api<{ deleted: boolean }>(`/menu/categories/${id}`, { method: 'DELETE' }),
  createItem: (data: Partial<MenuItem>) => api<{ item: MenuItem }>('/menu/items', { method: 'POST', body: data }),
  updateItem: (id: string, data: Partial<MenuItem>) =>
    api<{ item: MenuItem }>(`/menu/items/${id}`, { method: 'PATCH', body: data }),
  removeItem: (id: string) => api<{ deleted: boolean }>(`/menu/items/${id}`, { method: 'DELETE' }),
  /** Replace a dish's bill of materials (US8.2). */
  setRecipe: (id: string, recipe: Pick<RecipeLine, 'inventoryId' | 'qty'>[]) =>
    api<{ item: MenuItem }>(`/menu/items/${id}/recipe`, { method: 'PUT', body: { recipe } }),
};

/* ----------------------------------------------------------------- orders */

export type OrderScope = 'active' | 'today' | 'all';

export const orderApi = {
  create: (data: NewOrderInput) => api<{ order: Order }>('/orders', { method: 'POST', body: data }),
  list: (params?: { scope?: OrderScope; status?: string; type?: string; tableId?: string; customerId?: string }) =>
    api<{ orders: Order[] }>(`/orders${query(params)}`),
  mine: () => api<{ orders: Order[] }>('/orders/mine'),
  kitchen: () => api<KitchenResponse>('/orders/kitchen'),
  get: (id: string) => api<{ order: Order }>(`/orders/${id}`),
  /** Replace line items — only while the order is still 'placed' (US3.2). */
  replaceItems: (id: string, items: NewOrderLine[]) =>
    api<{ order: Order }>(`/orders/${id}/items`, { method: 'PUT', body: { items } }),
  /** Order lifecycle: confirmed | preparing | ready | served | cancelled. */
  setStatus: (id: string, status: 'confirmed' | 'preparing' | 'ready' | 'served' | 'cancelled', reason?: string) =>
    api<{ order: Order }>(`/orders/${id}/status`, { method: 'POST', body: { status, reason } }),
  /** Item lifecycle: preparing | ready | served. */
  setItemStatus: (id: string, itemId: string, status: 'preparing' | 'ready' | 'served') =>
    api<{ order: Order }>(`/orders/${id}/items/${itemId}`, { method: 'PATCH', body: { status } }),
  assignTable: (id: string, tableId: string) =>
    api<{ order: Order }>(`/orders/${id}/table`, { method: 'PATCH', body: { tableId } }),
  /** KDS queue control (US4.5). */
  kitchenAction: (id: string, action: 'up' | 'down' | 'rush' | 'normal') =>
    api<{ order: Order }>(`/orders/${id}/kitchen`, { method: 'POST', body: { action } }),
};

/* ----------------------------------------------------------------- tables */

export const tableApi = {
  list: () => api<{ tables: Table[]; zones: string[]; statuses: Table['status'][] }>('/tables'),
  publicList: () => api<{ tables: PublicTable[] }>('/tables/public'),
  create: (data: { number: number; seats: number; zone: string }) =>
    api<{ table: Table }>('/tables', { method: 'POST', body: data }),
  update: (
    id: string,
    data: Partial<Pick<Table, 'status' | 'waiterId' | 'held' | 'number' | 'seats' | 'zone'>>,
  ) => api<{ table: Table }>(`/tables/${id}`, { method: 'PATCH', body: data }),
  remove: (id: string) => api<{ deleted: boolean }>(`/tables/${id}`, { method: 'DELETE' }),
};

/* -------------------------------------------------------------- inventory */

export const inventoryApi = {
  list: () => api<{ inventory: InventoryItem[]; units: string[]; categories: string[] }>('/inventory'),
  create: (data: Partial<InventoryItem>) => api<{ item: InventoryItem }>('/inventory', { method: 'POST', body: data }),
  /** Pass { delta } to adjust stock; other fields need manager/admin. */
  update: (id: string, data: Partial<InventoryItem> & { delta?: number }) =>
    api<{ item: InventoryItem }>(`/inventory/${id}`, { method: 'PATCH', body: data }),
  remove: (id: string) => api<{ deleted: boolean }>(`/inventory/${id}`, { method: 'DELETE' }),
  movements: (params?: { limit?: number; inventoryId?: string }) =>
    api<{ movements: StockMovement[] }>(`/inventory/movements${query(params)}`),
  reorder: (all = false) =>
    api<{ lines: ReorderLine[]; estimatedTotal: number }>(`/inventory/reorder${all ? '?all=1' : ''}`),
  purchaseOrders: () => api<{ purchaseOrders: PurchaseOrder[] }>('/inventory/purchase-orders'),
  createPurchaseOrder: (lines: { inventoryId: string; qty: number }[], notes = '') =>
    api<{ purchaseOrder: PurchaseOrder }>('/inventory/purchase-orders', { method: 'POST', body: { lines, notes } }),
  receivePurchaseOrder: (id: string) =>
    api<{ purchaseOrder: PurchaseOrder }>(`/inventory/purchase-orders/${id}/receive`, { method: 'POST' }),
};

/* ----------------------------------------------------------- reservations */

export const reservationApi = {
  list: (params?: { scope?: 'upcoming' | 'past' | 'all'; status?: string }) =>
    api<{ reservations: Reservation[]; slots: string[] }>(`/reservations${query(params)}`),
  mine: () => api<{ reservations: Reservation[] }>('/reservations/mine'),
  availability: (date: string, partySize: number) =>
    api<{ date: string; partySize: number; slots: TimeSlot[] }>(`/reservations/availability${query({ date, partySize })}`),
  /** On 409 the thrown ApiError's data is { error, alternatives: AlternativeSlot[] }. */
  create: (data: {
    customerName: string;
    email: string;
    phone?: string;
    partySize: number;
    date: string;
    time: string;
    specialRequests?: string;
  }) => api<{ reservation: Reservation }>('/reservations', { method: 'POST', body: data }),
  update: (
    id: string,
    data: Partial<{ status: ReservationStatus; tableId: string | null; partySize: number; date: string; time: string; specialRequests: string }>,
  ) => api<{ reservation: Reservation }>(`/reservations/${id}`, { method: 'PATCH', body: data }),
  cancel: (id: string) => api<{ reservation: Reservation }>(`/reservations/${id}/cancel`, { method: 'POST' }),
};

export type BookingConflict = { error: string; alternatives: AlternativeSlot[] };

/* ---------------------------------------------------------------- billing */

export const billingApi = {
  list: (scope: 'open' | 'today' | 'all' = 'open') =>
    api<{ bills: Bill[]; summary: BillingSummary }>(`/billing${query({ scope })}`),
  get: (id: string) => api<{ invoice: Invoice }>(`/billing/${id}`),
  receipt: (id: string) => api<{ receipt: Invoice }>(`/billing/${id}/receipt`),
  tip: (id: string, tip: { amount: number } | { percent: number }) =>
    api<{ invoice: Invoice }>(`/billing/${id}/tip`, { method: 'POST', body: tip }),
  splitEven: (id: string, ways: number) =>
    api<{ invoice: Invoice }>(`/billing/${id}/split`, { method: 'POST', body: { mode: 'even', ways } }),
  splitByItems: (id: string, groups: string[][]) =>
    api<{ invoice: Invoice }>(`/billing/${id}/split`, { method: 'POST', body: { mode: 'items', groups } }),
  clearSplit: (id: string) => api<{ invoice: Invoice }>(`/billing/${id}/split`, { method: 'DELETE' }),
  paySplitPart: (id: string, index: number, method: 'card' | 'cash') =>
    api<{ invoice: Invoice }>(`/billing/${id}/split/${index}/pay`, { method: 'POST', body: { method } }),
  pay: (id: string, method: 'card' | 'cash') =>
    api<{ invoice: Invoice; alreadyPaid: boolean }>(`/billing/${id}/pay`, { method: 'POST', body: { method } }),
  unpay: (id: string) => api<{ invoice: Invoice }>(`/billing/${id}/unpay`, { method: 'POST' }),
  /** Manager/Admin. Omit amount for a full refund. */
  refund: (id: string, reason: string, amount?: number) =>
    api<{ invoice: Invoice }>(`/billing/${id}/refund`, { method: 'POST', body: { reason, amount } }),
};

/* -------------------------------------------------------------- analytics */

export const analyticsApi = {
  summary: () => api<{ summary: AnalyticsSummary }>('/analytics/summary'),
  dashboard: (params: { from?: string; to?: string; granularity?: Granularity }) =>
    api<AnalyticsDashboard>(`/analytics/dashboard${query(params)}`),
};

/* ---------------------------------------------------------- notifications */

export const notificationApi = {
  list: () => api<{ notifications: AppNotification[]; unreadCount: number }>('/notifications'),
  read: (id: string) => api<{ notification: AppNotification }>(`/notifications/${id}/read`, { method: 'POST' }),
  readAll: () => api<{ ok: boolean }>('/notifications/read-all', { method: 'POST' }),
};

/* --------------------------------------------------------------- settings */

export const settingsApi = {
  get: () => api<{ settings: Settings; timeSlots: string[] }>('/settings'),
  update: (data: Partial<Settings>) => api<{ settings: Settings }>('/settings', { method: 'PATCH', body: data }),
};

/* ------------------------------------------------------------------ staff */

export const staffApi = {
  roster: () => api<{ staff: User[] }>('/staff/roster'),
  apply: (data: { name: string; email: string; phone?: string; desiredRole: 'waiter' | 'chef'; experience?: string }) =>
    api<{ application: StaffApplication }>('/staff/applications', { method: 'POST', body: data }),
  applications: (status?: StaffApplication['status']) =>
    api<{ applications: StaffApplication[] }>(`/staff/applications${query({ status })}`),
  approve: (id: string, role?: StaffRole) =>
    api<{ application: StaffApplication; user: User; tempPassword: string }>(`/staff/applications/${id}/approve`, {
      method: 'POST',
      body: { role },
    }),
  reject: (id: string) =>
    api<{ application: StaffApplication }>(`/staff/applications/${id}/reject`, { method: 'POST' }),
  shifts: (params?: { from?: string; to?: string; userId?: string }) =>
    api<{ shifts: Shift[]; from: string; to: string }>(`/staff/shifts${query(params)}`),
  myShifts: (params?: { from?: string; to?: string }) =>
    api<{ shifts: Shift[]; from: string; to: string }>(`/staff/shifts/mine${query(params)}`),
  createShift: (data: { userId: string; date: string; start: string; end: string; notes?: string }) =>
    api<{ shift: Shift }>('/staff/shifts', { method: 'POST', body: data }),
  updateShift: (id: string, data: Partial<{ status: ShiftStatus; date: string; start: string; end: string; notes: string; userId: string }>) =>
    api<{ shift: Shift }>(`/staff/shifts/${id}`, { method: 'PATCH', body: data }),
  removeShift: (id: string) => api<{ deleted: boolean }>(`/staff/shifts/${id}`, { method: 'DELETE' }),
  performance: (params?: { from?: string; to?: string }) =>
    api<{ from: string; to: string; staff: StaffPerformance[] }>(`/staff/performance${query(params)}`),
};

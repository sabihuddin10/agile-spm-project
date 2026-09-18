export type Role = 'customer' | 'waiter' | 'chef' | 'manager' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  createdAt?: string;
}

export interface Customer {
  id: string;
  userId?: string | null;
  name: string;
  email: string;
  phone: string;
  type: 'walk-in' | 'online';
  loyaltyPoints: number;
  totalSpend: number;
  preferences: {
    dietary: string[];
    allergies: string[];
  };
  notes: string;
  createdAt: string;
  orderHistory?: OrderRecord[];
  orderCount?: number;
}

export interface OrderRecord {
  id: string;
  date: string;
  total: number;
  items: string[];
  pointsEarned?: number;
  paymentMethod?: PaymentMethod | null;
}

export type FulfillmentMethod = 'pickup' | 'delivery';

export type PaymentMethod = 'card' | 'cash' | 'points';

export interface Modifier {
  id: string;
  name: string;
  options: string[];
  type: 'single' | 'multi';
}

export interface MenuItem {
  id: string;
  name: string;
  categoryId: string;
  category?: string;
  price: number;
  description: string;
  dietaryTags: string[];
  allergens: string[];
  modifiers: Modifier[];
  available: boolean;
  outOfStockReason: string;
  createdAt?: string;
}

export interface MenuCategory {
  id: string;
  name: string;
  sort: number;
  active: boolean;
  itemCount?: number;
  items?: MenuItem[];
}

export interface MenuResponse {
  menu: MenuCategory[];
  tags: string[];
  allergens: string[];
}

export interface OrderItem {
  id: string;
  menuItemId: string;
  name: string;
  qty: number;
  price: number;
  status: string;
  modifiers: string[];
}

export interface Order {
  id: string;
  number: number;
  type: 'dine-in' | 'online';
  fulfillment?: FulfillmentMethod;
  paymentMethod?: PaymentMethod | null;
  tableId: string | null;
  tableNumber: number | null;
  customerId: string | null;
  customer?: { id: string; name: string; email: string } | null;
  status: string;
  source: 'customer' | 'waiter';
  items: OrderItem[];
  subtotal: number;
  tax: number | null;
  discount: number;
  total: number;
  pointsUsed?: number;
  pointsEarned?: number;
  notes?: string;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Table {
  id: string;
  number: number;
  seats: number;
  status: 'free' | 'occupied' | 'reserved' | 'cleaning';
  waiterId: string | null;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  stock: number;
  unit: string;
  reorderLevel: number;
  costPerUnit: number;
  lowStock?: boolean;
}

export interface Reservation {
  id: string;
  customerName: string;
  email: string;
  phone: string;
  partySize: number;
  date: string;
  time: string;
  tableId: string | null;
  status: 'pending' | 'confirmed' | 'seated' | 'cancelled' | 'no_show';
  specialRequests: string;
  customerId: string | null;
  createdAt: string;
}

export interface Bill {
  id: string;
  number: number;
  type: 'dine-in' | 'online';
  fulfillment?: FulfillmentMethod | null;
  paymentMethod?: PaymentMethod | null;
  tableNumber: number | null;
  status: string;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paid: boolean;
  paidAt: string | null;
  createdAt: string;
}

export interface Invoice extends Bill {
  items: OrderItem[];
}

export interface AnalyticsSummary {
  revenue: number;
  orderCount: number;
  paidCount: number;
  avgOrder: number;
  customerCount: number;
  topItems: { name: string; qty: number }[];
  statusCounts: Record<string, number>;
  lowStock: number;
}
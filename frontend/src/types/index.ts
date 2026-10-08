export type Role = 'customer' | 'waiter' | 'chef' | 'manager' | 'admin';
export type StaffRole = Exclude<Role, 'customer'>;

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  createdAt?: string;
  /** Contact number ('' when not set). Optional so sessions stored before it existed still parse. */
  phone?: string;
  /** Set while the account is on a temporary password (new hire or a reset) until they choose their own. */
  mustChangePassword?: boolean;
}

/* -------------------------------------------------------------- customers */

export interface CustomerPreferences {
  dietary: string[];
  allergies: string[];
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
  preferences: CustomerPreferences;
  notes: string;
  createdAt: string;
  orderHistory?: OrderRecord[];
  orderCount?: number;
}

/** A past order as shown in a customer's history (newest first). */
export interface OrderRecord {
  id: string;
  number: number;
  date: string;
  createdAt: string;
  total: number;
  items: string[];
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod | null;
  pointsEarned?: number;
  type: OrderType;
  fulfillment: FulfillmentMethod;
  refundedAmount: number;
}

/* ------------------------------------------------------------------- menu */

export interface ModifierOption {
  label: string;
  priceDelta: number;
}

export interface Modifier {
  id: string;
  name: string;
  type: 'single' | 'multi';
  options: ModifierOption[];
}

/** What the client sends: which option of which group. */
export interface ModifierSelection {
  group: string;
  label: string;
}

/** What the server stores on an order line: the selection plus its price. */
export interface SelectedModifier extends ModifierSelection {
  priceDelta: number;
}

/** One ingredient in a dish's bill of materials. */
export interface RecipeLine {
  inventoryId: string;
  qty: number;
  name?: string;
  unit?: string;
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
  /** Only present for staff (menu scope=manage, /menu/items). */
  recipe?: RecipeLine[];
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

/* ----------------------------------------------------------------- orders */

export type OrderType = 'dine-in' | 'online';
export type FulfillmentMethod = 'dine-in' | 'pickup' | 'delivery';
export type PaymentMethod = 'card' | 'cash' | 'split';
export type PaymentStatus = 'unpaid' | 'paid' | 'refunded';
export type OrderStatus = 'placed' | 'confirmed' | 'preparing' | 'ready' | 'served' | 'closed' | 'cancelled';
export type ItemStatus = 'pending' | 'queued' | 'preparing' | 'ready' | 'served';

export interface OrderItem {
  id: string;
  menuItemId: string;
  name: string;
  qty: number;
  basePrice: number;
  modifiers: SelectedModifier[];
  /** Base price plus modifier deltas. */
  unitPrice: number;
  status: ItemStatus;
  preparedBy: string | null;
  preparedByName?: string | null;
  readyAt: string | null;
  servedAt: string | null;
}

export interface Refund {
  amount: number;
  reason: string;
  at: string;
  by: string | null;
}

export interface SplitPart {
  label: string;
  amount: number;
  itemIds: string[];
  paid: boolean;
  method?: 'card' | 'cash';
  paidAt?: string;
}

export interface BillSplit {
  mode: 'even' | 'items';
  parts: SplitPart[];
  createdAt: string;
}

export interface OrderCustomer {
  id: string;
  name: string;
  email: string;
  phone: string;
  preferences: CustomerPreferences;
}

export interface Order {
  id: string;
  number: number;
  type: OrderType;
  fulfillment: FulfillmentMethod;
  tableId: string | null;
  tableNumber: number | null;
  customerId: string | null;
  customer: OrderCustomer | null;
  waiterId: string | null;
  waiterName: string | null;
  createdBy: string | null;
  source: 'customer' | 'staff';
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod | null;
  priority: 'normal' | 'rush';
  kitchenRank: number | null;
  items: OrderItem[];
  rates: { taxRate: number; serviceChargeRate: number };
  subtotal: number;
  discount: number;
  serviceCharge: number;
  tax: number;
  tip: number;
  total: number;
  pointsUsed: number;
  pointsEarned: number;
  notes: string;
  deliveryAddress: string;
  split: BillSplit | null;
  refund: Refund | null;
  createdAt: string;
  confirmedAt: string | null;
  readyAt: string | null;
  servedAt: string | null;
  servedBy: string | null;
  servedByName: string | null;
  paidAt: string | null;
  closedAt: string | null;
  cancelledAt: string | null;
  updatedAt: string;
}

export interface NewOrderLine {
  menuItemId: string;
  qty: number;
  modifiers: ModifierSelection[];
}

export interface NewOrderInput {
  type: OrderType;
  items: NewOrderLine[];
  tableId?: string | null;
  /** Staff only — ignored by the server for customers. */
  customerId?: string | null;
  fulfillment?: 'pickup' | 'delivery';
  deliveryAddress?: string;
  /** Customers only. */
  paymentMethod?: 'card' | 'cash';
  notes?: string;
  /** Customers only — Flame Points to redeem. */
  pointsUsed?: number;
  /** Staff only — false keeps the order 'placed' instead of sending it to the kitchen. */
  sendToKitchen?: boolean;
}

export interface KitchenResponse {
  queue: Order[];
  ready: Order[];
  delayMinutes: number;
}

/* ----------------------------------------------------------------- tables */

export type TableStatus = 'free' | 'occupied' | 'reserved' | 'cleaning';

export interface TableOrderSummary {
  id: string;
  number: number;
  status: OrderStatus;
  total: number;
  paymentStatus: PaymentStatus;
}

export interface TableReservationSummary {
  id: string;
  customerName: string;
  time: string;
  partySize: number;
  status: ReservationStatus;
  late: boolean;
}

export interface Table {
  id: string;
  number: number;
  seats: number;
  zone: string;
  status: TableStatus;
  waiterId: string | null;
  waiterName?: string | null;
  /** Manually held: the table is not auto-freed when its orders close. */
  held: boolean;
  /** Reservation currently holding this table, if any. */
  reservedFor: string | null;
  activeOrders?: TableOrderSummary[];
  nextReservation?: TableReservationSummary | null;
}

export interface PublicTable {
  id: string;
  number: number;
  seats: number;
  zone: string;
}

/* -------------------------------------------------------------- inventory */

export type StockHealth = 'ok' | 'near' | 'low';

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  stock: number;
  unit: string;
  reorderLevel: number;
  costPerUnit: number;
  supplier: string;
  lowStock: boolean;
  health: StockHealth;
  /** Names of dishes whose recipe uses this ingredient. */
  usedBy: string[];
}

export interface StockMovement {
  id: string;
  inventoryId: string;
  name: string;
  unit: string;
  delta: number;
  stockAfter: number;
  reason: 'sale' | 'restock' | 'wastage' | 'count';
  orderId: string | null;
  orderNumber: number | null;
  userId: string | null;
  at: string;
}

export interface ReorderLine {
  inventoryId: string;
  name: string;
  unit: string;
  supplier: string;
  stock: number;
  reorderLevel: number;
  suggestedQty: number;
  costPerUnit: number;
  estimatedCost: number;
}

export interface PurchaseOrderLine {
  inventoryId: string;
  name: string;
  unit: string;
  supplier: string;
  qty: number;
  costPerUnit: number;
  cost: number;
}

export interface PurchaseOrder {
  id: string;
  number: string;
  lines: PurchaseOrderLine[];
  total: number;
  notes: string;
  status: 'sent' | 'received';
  createdAt: string;
  createdBy: string;
  receivedAt: string | null;
}

/* ----------------------------------------------------------- reservations */

export type ReservationStatus = 'requested' | 'confirmed' | 'seated' | 'cancelled' | 'no_show';

export interface Reservation {
  id: string;
  customerName: string;
  email: string;
  phone: string;
  partySize: number;
  date: string;
  time: string;
  tableId: string | null;
  tableNumber: number | null;
  status: ReservationStatus;
  specialRequests: string;
  customerId: string | null;
  /** Confirmed booking past its grace period with no check-in. */
  late: boolean;
  hasAccount: boolean;
  createdAt: string;
  confirmedAt: string | null;
  seatedAt: string | null;
  cancelledAt: string | null;
  notifiedAt: string | null;
}

export interface TimeSlot {
  time: string;
  available: boolean;
}

export interface AlternativeSlot {
  date: string;
  time: string;
}

/* ---------------------------------------------------------------- billing */

export interface BillLine {
  id: string;
  name: string;
  qty: number;
  basePrice: number;
  modifiers: SelectedModifier[];
  unitPrice: number;
  lineTotal: number;
}

export interface Invoice {
  id: string;
  number: number;
  receiptNumber: string;
  type: OrderType;
  fulfillment: FulfillmentMethod;
  tableNumber: number | null;
  customerName: string | null;
  waiterName: string | null;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod | null;
  paid: boolean;
  lines: BillLine[];
  subtotal: number;
  discount: number;
  pointsUsed: number;
  pointsEarned: number;
  serviceCharge: number;
  serviceChargeRate: number;
  tax: number;
  taxRate: number;
  tip: number;
  total: number;
  refund: Refund | null;
  refundedAmount: number;
  netTotal: number;
  split: BillSplit | null;
  createdAt: string;
  servedAt: string | null;
  paidAt: string | null;
  closedAt: string | null;
  restaurant: { name: string; address: string };
  /** Set on receipts. */
  issuedAt?: string;
}

/** A row in the billing list is a full invoice. */
export type Bill = Invoice;

export interface BillingSummary {
  outstanding: number;
  openCount: number;
  paidToday: number;
  paidTodayCount: number;
}

/* ---------------------------------------------------------- notifications */

export interface AppNotification {
  id: string;
  userId: string | null;
  role: Role | null;
  channel: 'in-app' | 'email';
  type: string;
  title: string;
  message: string;
  link: string | null;
  orderId: string | null;
  reservationId: string | null;
  createdAt: string;
  read: boolean;
}

/* --------------------------------------------------------------- settings */

export interface Settings {
  restaurantName: string;
  address: string;
  taxRate: number;
  serviceChargeRate: number;
  pointValue: number;
  kitchenDelayMinutes: number;
  reservationDurationMinutes: number;
  reservationGraceMinutes: number;
  openingHour: number;
  closingHour: number;
}

/* ------------------------------------------------------------------ staff */

export interface StaffApplication {
  id: string;
  name: string;
  email: string;
  phone: string;
  desiredRole: 'waiter' | 'chef';
  experience: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
  decidedByName?: string | null;
  userId: string | null;
  approvedRole?: StaffRole;
}

export type ShiftStatus = 'scheduled' | 'completed' | 'missed';

export interface Shift {
  id: string;
  userId: string;
  userName: string;
  role: Role | null;
  date: string;
  start: string;
  end: string;
  notes: string;
  status: ShiftStatus;
  hours: number;
  createdBy: string;
  createdAt: string;
}

export interface StaffPerformance {
  userId: string;
  name: string;
  role: StaffRole;
  active: boolean;
  ordersTaken: number;
  ordersServed: number;
  revenueHandled: number;
  tips: number;
  itemsPrepared: number;
  avgPrepMinutes: number | null;
  shiftsCompleted: number;
  shiftsMissed: number;
  hoursWorked: number;
}

/* -------------------------------------------------------------- analytics */

export interface AnalyticsSummary {
  revenueToday: number;
  ordersToday: number;
  activeOrders: number;
  openBills: number;
  lowStock: number;
  bookingsToday: number;
}

export type Granularity = 'day' | 'week' | 'month';

export interface TableStat {
  tableId: string;
  number: number;
  zone: string;
  seats: number;
  turns: number;
  avgTurnoverMinutes: number;
  occupancyRate: number;
}

export interface ZoneStat {
  zone: string;
  tables: number;
  turns: number;
  avgTurnoverMinutes: number;
  occupancyRate: number;
}

export interface AnalyticsDashboard {
  range: { from: string; to: string; granularity: Granularity; days: number };
  kpis: {
    revenue: number;
    orders: number;
    avgOrder: number;
    tips: number;
    refunds: number;
    cancelled: number;
    customers: number;
  };
  trend: { period: string; revenue: number; orders: number }[];
  dishes: { name: string; qty: number; revenue: number }[];
  tables: TableStat[];
  zones: ZoneStat[];
  peakHours: { hour: number; orders: number; revenue: number; avgPerDay: number }[];
  inventory: { id: string; name: string; unit: string; stock: number; reorderLevel: number; status: StockHealth; coverage: number }[];
  reservations: {
    total: number;
    seated: number;
    noShows: number;
    cancelled: number;
    noShowRate: number;
    cancellationRate: number;
  };
}

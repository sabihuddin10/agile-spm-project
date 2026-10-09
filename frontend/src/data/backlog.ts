/**
 * Product Backlog as delivered — mirrors Product_Backlog.docx / Sprint_Backlogs.docx.
 * Each story carries its acceptance criteria plus where to demo it and the
 * automated acceptance test that verifies it (server/test/*.test.js).
 */

export interface StoryEvidence {
  /** Where to demo it in the app. */
  screen: string;
  /** Test file that verifies the acceptance criteria. */
  test: string;
}

export interface Story {
  id: string;
  text: string;
  points: number;
  acceptanceCriteria: string[];
  evidence: StoryEvidence;
}

export interface SprintBacklog {
  sprint: number;
  module: string;
  goal: string;
  priority: 'Must' | 'Should' | 'Could';
  lead: string;
  status: 'done' | 'planned';
  stakeholders: string[];
  stories: Story[];
}

export interface BacklogSummary {
  totalStories: number;
  totalPoints: number;
  donePoints: number;
  plannedPoints: number;
  averageVelocity: number;
}

// Test files are module-wise under server/test/ (see TestsPLAN.md), one per route module.
const T = {
  s1: 'routes/auth.test.js · routes/customers.test.js',
  s2: 'routes/menu.test.js',
  s34: 'routes/orders.test.js',
  s5: 'routes/billing.test.js',
  s67: 'routes/tables.test.js · routes/reservations.test.js',
  s8: 'routes/inventory.test.js',
  s910: 'routes/staff.test.js · routes/analytics.test.js',
};

export const SPRINTS: SprintBacklog[] = [
  {
    sprint: 1,
    module: 'Customer Management + Core Setup',
    goal: 'Stand up auth/RBAC for all five roles and deliver customer registration & profile management.',
    priority: 'Must',
    lead: '#4',
    status: 'done',
    stakeholders: ['Customer', 'Waiter', 'Manager', 'Admin'],
    stories: [
      {
        id: 'US1.1', points: 8,
        text: 'As an Admin, I want authentication and role-based access control (RBAC) set up for all five stakeholder roles, so that each role only sees the features and data it is permitted to access.',
        acceptanceCriteria: [
          'Given a new user registers, when they sign up, then they are assigned exactly one role (Customer, Waiter, Chef, Manager, or Admin).',
          "Given a logged-in user, when they navigate to a route outside their role's permissions, then the system returns a 403 and redirects to their own dashboard.",
          "Given an Admin, when they view the user list, then they can change any user's role.",
        ],
        evidence: { screen: 'Sign in as each role → sidebar shows only permitted sections; open a forbidden URL → 403 screen + redirect; Staff management → roles', test: T.s1 },
      },
      {
        id: 'US1.2', points: 5,
        text: 'As a Customer, I want to register and edit my profile, so that my details are saved for future visits and orders.',
        acceptanceCriteria: [
          'Given a new customer, when they submit the registration form with name, contact, and password, then an account is created and they are logged in.',
          'Given a logged-in customer, when they edit their profile, then changes are persisted and reflected immediately.',
          'Given invalid input (e.g., missing required field), when the form is submitted, then a validation error is shown and no record is created.',
        ],
        evidence: { screen: '/register, /account → Your profile', test: T.s1 },
      },
      {
        id: 'US1.3', points: 3,
        text: 'As a Waiter or Manager, I want to search and filter the customer ledger, so that I can quickly find a customer during service.',
        acceptanceCriteria: [
          'Given the customer ledger, when I search by name, phone, or email, then matching customers are returned within the same view.',
          "Given a filtered result set, when no customer matches, then a clear 'no results' state is shown.",
        ],
        evidence: { screen: 'Staff → Customers (search, type and allergy filters)', test: T.s1 },
      },
      {
        id: 'US1.4', points: 5,
        text: "As a Waiter, Manager, or Customer, I want to view a customer's order history and totals, so that we can reference past orders and spend.",
        acceptanceCriteria: [
          'Given a customer profile, when I open the history tab, then all past orders with dates and totals are listed, newest first.',
          'Given a customer with no past orders, when I open the history tab, then an empty state is shown rather than an error.',
        ],
        evidence: { screen: 'Staff → Customers → select a customer; /account → Your orders', test: T.s1 },
      },
      {
        id: 'US1.5', points: 3,
        text: 'As a Customer, I want to store my dietary and allergy preferences, so that the kitchen and waiter are aware of restrictions when I order.',
        acceptanceCriteria: [
          'Given a customer profile, when I add allergy/dietary tags, then they are saved and visible to Waiter and Chef on any of my active orders.',
          "Given no preferences set, when a profile is viewed, then the section shows 'none recorded' rather than being blank/broken.",
        ],
        evidence: { screen: 'Allergy banner on Orders and Kitchen tickets (e.g. Emma — peanuts)', test: T.s1 },
      },
    ],
  },
  {
    sprint: 2,
    module: 'Menu Management',
    goal: 'Deliver a backend-driven menu with categories, modifiers, and availability control.',
    priority: 'Must',
    lead: '#3',
    status: 'done',
    stakeholders: ['Customer', 'Waiter', 'Chef', 'Manager', 'Admin'],
    stories: [
      {
        id: 'US2.1', points: 5,
        text: 'As a Manager or Admin, I want to add, edit, and remove menu items, so that the menu always reflects what the kitchen can currently serve.',
        acceptanceCriteria: [
          'Given the menu admin screen, when I create an item with name, price, and description, then it appears on the live customer-facing menu.',
          'Given an existing item, when I edit or delete it, then the change is reflected immediately across all role views.',
        ],
        evidence: { screen: 'Staff → Menu (manager) and /menu', test: T.s2 },
      },
      {
        id: 'US2.2', points: 3,
        text: 'As a Manager, I want to organize items by category, so that customers and waiters can browse the menu logically.',
        acceptanceCriteria: [
          'Given a set of menu items, when I assign each to a category, then the customer-facing menu groups items under that category heading.',
          'Given a category with no items, when viewed, then it is hidden rather than shown empty.',
        ],
        evidence: { screen: 'Staff → Menu → Categories; /menu', test: T.s2 },
      },
      {
        id: 'US2.3', points: 5,
        text: 'As a Manager, I want to support modifiers such as size and extras, so that customers can customize dishes at the point of order.',
        acceptanceCriteria: [
          'Given a menu item, when I attach modifier groups (e.g., size, add-ons), then those options appear when the item is added to an order.',
          'Given a modifier with a price delta, when selected, then the order line total updates accordingly.',
        ],
        evidence: { screen: '/menu → Add Margherita Pizza → choose Large + extras', test: T.s2 },
      },
      {
        id: 'US2.4', points: 3,
        text: 'As a Customer, I want to see dietary and allergen tags on menu items, so that I can make safe and informed choices.',
        acceptanceCriteria: [
          'Given a menu item with tags (e.g., vegan, contains nuts), when displayed, then the tags are visible as badges/icons.',
          'Given a customer with a stored allergy preference, when browsing the menu, then conflicting items are visually flagged.',
        ],
        evidence: { screen: '/menu signed in as customer@ (peanut allergy) → Peanut Satay flagged', test: T.s2 },
      },
      {
        id: 'US2.5', points: 3,
        text: 'As a Manager or Chef, I want to control item availability / mark items out-of-stock, so that customers cannot order dishes the kitchen cannot currently prepare.',
        acceptanceCriteria: [
          'Given an item marked unavailable, when a customer views the menu, then the item is shown as out-of-stock and cannot be added to an order.',
          'Given an item re-marked available, when refreshed, then it becomes orderable again immediately.',
        ],
        evidence: { screen: 'Staff → Menu (chef) → Mark out of stock; /menu', test: T.s2 },
      },
    ],
  },
  {
    sprint: 3,
    module: 'Order Management',
    goal: 'Enable customers to place orders and waiters to confirm and track them end to end.',
    priority: 'Must',
    lead: '#1',
    status: 'done',
    stakeholders: ['Customer', 'Waiter', 'Chef', 'Manager', 'Admin'],
    stories: [
      {
        id: 'US3.1', points: 8,
        text: 'As a Customer, I want to place an order (dine-in or online), so that I can order food without waiting for staff availability.',
        acceptanceCriteria: [
          "Given a menu with available items, when I add items and submit, then an order is created with status 'placed' and correct line items/total.",
          "Given an item that becomes unavailable mid-session, when I try to add it, then I'm blocked with a clear message.",
        ],
        evidence: { screen: '/menu → cart → checkout (Dine in / Pickup / Delivery)', test: T.s34 },
      },
      {
        id: 'US3.2', points: 5,
        text: 'As a Waiter, I want to confirm a placed order, so that it is officially accepted and routed to the kitchen.',
        acceptanceCriteria: [
          "Given a placed order, when a waiter confirms it, then its status changes to 'confirmed' and it becomes visible to the kitchen.",
          'Given a waiter wants to adjust an order before confirming, then line items can be edited prior to confirmation only.',
        ],
        evidence: { screen: 'Staff → Orders → Needs confirmation → Edit items / Confirm', test: T.s34 },
      },
      {
        id: 'US3.3', points: 5,
        text: 'As a Waiter, Chef, or Manager, I want to track order status through its lifecycle, so that everyone knows where each order stands.',
        acceptanceCriteria: [
          'Given an order, when its status changes (placed → confirmed → preparing → ready → served → closed), then all authorized roles see the updated status without a page reload delay of more than a few seconds.',
        ],
        evidence: { screen: 'Orders, Kitchen and /account refresh every 5–10 s', test: T.s34 },
      },
      {
        id: 'US3.4', points: 3,
        text: 'As a Chef or Waiter, I want item-level status within an order, so that partially-ready orders can still be tracked accurately.',
        acceptanceCriteria: [
          'Given a multi-item order, when one item is marked ready before others, then the order view reflects per-item status, not just one order-level status.',
        ],
        evidence: { screen: 'Order cards and KDS tickets show a status per item', test: T.s34 },
      },
      {
        id: 'US3.5', points: 3,
        text: 'As a Waiter, I want to attach an order to a specific table, so that service staff know where to deliver food.',
        acceptanceCriteria: [
          "Given a dine-in order, when a waiter assigns a table, then the order is linked to that table and shows on the table's active-order view.",
          'Given an online (non-dine-in) order, then no table assignment is required.',
        ],
        evidence: { screen: 'Staff → Orders → New order / Assign table; Floor plan tile', test: T.s34 },
      },
    ],
  },
  {
    sprint: 4,
    module: 'Kitchen Workflow',
    goal: 'Deliver a Kitchen Display System (KDS) so chefs can receive, prepare, and mark orders ready.',
    priority: 'Must',
    lead: '#2',
    status: 'done',
    stakeholders: ['Chef', 'Waiter', 'Manager', 'Admin'],
    stories: [
      {
        id: 'US4.1', points: 8,
        text: 'As a Chef, I want to see incoming confirmed orders in a kitchen queue, so that I know what to prepare next.',
        acceptanceCriteria: [
          'Given an order is confirmed by a waiter, when it is saved, then it appears in the Kitchen Display System queue within seconds.',
          'Given multiple confirmed orders, when displayed, then they are ordered oldest-first by default.',
        ],
        evidence: { screen: 'Staff → Kitchen (KDS)', test: T.s34 },
      },
      {
        id: 'US4.2', points: 3,
        text: 'As a Chef, I want to mark an item as in-preparation, so that the team knows which dishes are actively being cooked.',
        acceptanceCriteria: [
          'Given a queued item, when a chef marks it in-preparation, then its status updates and is visible to waiter and manager views.',
        ],
        evidence: { screen: 'KDS → Start', test: T.s34 },
      },
      {
        id: 'US4.3', points: 3,
        text: 'As a Chef, I want to mark items as ready, so that waiters know when to collect and serve them.',
        acceptanceCriteria: [
          "Given an item in-preparation, when a chef marks it ready, then the status updates and the item appears in a 'ready for pickup' list.",
        ],
        evidence: { screen: 'KDS → Ready; Ready-for-pickup column', test: T.s34 },
      },
      {
        id: 'US4.4', points: 5,
        text: "As a Waiter, I want to be notified when items are ready, so that food is served promptly and doesn't sit under the lamp.",
        acceptanceCriteria: [
          'Given an item marked ready, when the status changes, then the assigned waiter receives an in-app notification/badge.',
        ],
        evidence: { screen: 'Notification bell (sign in as waiter@)', test: T.s34 },
      },
      {
        id: 'US4.5', points: 5,
        text: 'As a Chef or Manager, I want to prioritize and time orders in the kitchen queue, so that older or rush orders are handled first and delays are visible.',
        acceptanceCriteria: [
          'Given orders in the queue, when displayed, then each shows elapsed time since confirmation, and orders exceeding a configurable threshold are visually flagged.',
          'Given a manager or chef, when they manually reprioritize an order, then its position in the queue updates accordingly.',
        ],
        evidence: { screen: 'KDS timers, Delayed flag, ↑ ↓ and Rush; threshold in Settings', test: T.s34 },
      },
    ],
  },
  {
    sprint: 5,
    module: 'Billing',
    goal: 'Generate itemized bills from orders, support split bills, and settle payments.',
    priority: 'Must',
    lead: '#1',
    status: 'done',
    stakeholders: ['Waiter', 'Manager', 'Admin'],
    stories: [
      {
        id: 'US5.1', points: 8,
        text: 'As a Waiter or Customer, I want an itemized bill auto-generated from a served order, so that the customer can review and settle it accurately.',
        acceptanceCriteria: [
          'Given a served order, when billing is triggered, then a bill is generated listing every line item, quantity, and price.',
          'Given an order with modifiers, when billed, then modifier price deltas are correctly reflected in each line.',
        ],
        evidence: { screen: 'Staff → Billing → open a bill', test: T.s5 },
      },
      {
        id: 'US5.2', points: 5,
        text: 'As a Manager, I want tax, service charge, and tip applied to bills, so that totals comply with restaurant policy.',
        acceptanceCriteria: [
          'Given restaurant-configured tax and service-charge rates, when a bill is generated, then both are calculated and shown as separate line items.',
          'Given an optional tip entered by the customer/waiter, when added, then it is included in the final total.',
        ],
        evidence: { screen: 'Billing → tip buttons; Settings → rates', test: T.s5 },
      },
      {
        id: 'US5.3', points: 5,
        text: 'As a Waiter, I want to split a bill across multiple payers, so that groups can each pay their own share.',
        acceptanceCriteria: [
          'Given a bill, when a waiter splits it evenly or by selected items, then each resulting sub-bill sums correctly to the original total.',
        ],
        evidence: { screen: 'Billing → Split bill (evenly / by items)', test: T.s5 },
      },
      {
        id: 'US5.4', points: 3,
        text: 'As a Waiter or Manager, I want to mark a bill as paid or unpaid, so that the restaurant has an accurate settlement record.',
        acceptanceCriteria: [
          "Given a generated bill, when payment is recorded, then its status changes to 'paid' and it is excluded from outstanding-balance views.",
        ],
        evidence: { screen: 'Billing → Mark paid / Mark unpaid; Open tab', test: T.s5 },
      },
      {
        id: 'US5.5', points: 3,
        text: 'As a Waiter or Customer, I want to issue a receipt or process a refund, so that customers have proof of payment and errors can be corrected.',
        acceptanceCriteria: [
          'Given a paid bill, when a receipt is requested, then a formatted receipt (line items, totals, date) is produced.',
          'Given a valid reason, when a manager processes a refund, then the bill status and reported revenue are updated accordingly.',
        ],
        evidence: { screen: 'Billing → Print receipt / Refund (manager); /account → Receipt', test: T.s5 },
      },
    ],
  },
  {
    sprint: 6,
    module: 'Table Management',
    goal: 'Provide a floor-plan status board so staff can see and manage table state at a glance.',
    priority: 'Should',
    lead: '#5',
    status: 'done',
    stakeholders: ['Waiter', 'Manager', 'Admin'],
    stories: [
      {
        id: 'US6.1', points: 5,
        text: 'As a Manager or Admin, I want to add and edit tables and floor zones, so that the floor plan matches the physical restaurant layout.',
        acceptanceCriteria: ['Given the table admin screen, when a table is created with number, capacity, and zone, then it appears on the floor plan.'],
        evidence: { screen: 'Staff → Floor plan → Add table (manager)', test: T.s67 },
      },
      {
        id: 'US6.2', points: 5,
        text: 'As a Waiter or Manager, I want to view the floor plan with live table status, so that I can seat guests and manage the floor efficiently.',
        acceptanceCriteria: ['Given the floor plan view, when a table\'s status changes (free/occupied/reserved), then the visual indicator updates without a manual refresh.'],
        evidence: { screen: 'Staff → Floor plan (refreshes every 5 s)', test: T.s67 },
      },
      {
        id: 'US6.3', points: 3,
        text: 'As a Waiter, I want to assign a table to an order, so that the order and the physical table stay linked.',
        acceptanceCriteria: ['Given an unassigned dine-in order, when a table is selected, then the order-to-table link is created and reflected on the floor plan.'],
        evidence: { screen: 'Orders → Assign table; Floor plan tile lists the order', test: T.s34 },
      },
      {
        id: 'US6.4', points: 3,
        text: 'As a Waiter, I want to mark a table occupied or free, so that the floor status stays accurate as guests arrive and leave.',
        acceptanceCriteria: ['Given a table with an active order, when the order is closed, then the table automatically becomes free unless manually held.'],
        evidence: { screen: 'Floor plan status buttons and Hold toggle; pay a bill → table frees', test: T.s67 },
      },
    ],
  },
  {
    sprint: 7,
    module: 'Reservations',
    goal: 'Let customers book tables by date/time/party size and let staff manage reservation lifecycle.',
    priority: 'Should',
    lead: '#4',
    status: 'done',
    stakeholders: ['Customer', 'Waiter', 'Manager', 'Admin'],
    stories: [
      {
        id: 'US7.1', points: 5,
        text: 'As a Customer, I want to book a reservation by date, time-slot, and party size, so that I can guarantee a table before arriving.',
        acceptanceCriteria: [
          "Given available slots, when a customer submits date, time, and party size, then a reservation is created with status 'requested'.",
          'Given a fully-booked slot, when requested, then the system rejects the booking with an alternative-slot suggestion.',
        ],
        evidence: { screen: '/book (slot availability, alternatives when full)', test: T.s67 },
      },
      {
        id: 'US7.2', points: 3,
        text: 'As a Manager or Waiter, I want to manage reservation status, so that the reservation book stays accurate.',
        acceptanceCriteria: ["Given a requested reservation, when staff confirm it, then its status changes to 'confirmed' and the customer is notified."],
        evidence: { screen: 'Staff → Reservations → Confirm; customer bell', test: T.s67 },
      },
      {
        id: 'US7.3', points: 5,
        text: 'As a Waiter or Manager, I want to assign a table to a reservation, so that the right table is held for the right party size.',
        acceptanceCriteria: ["Given a confirmed reservation, when a table is assigned, then that table shows 'reserved' on the floor plan at the booked time."],
        evidence: { screen: 'Reservations → Assign table; Floor plan shows Reserved', test: T.s67 },
      },
      {
        id: 'US7.4', points: 3,
        text: 'As a Manager, I want to handle no-shows and cancellations, so that tables are freed up for other guests.',
        acceptanceCriteria: [
          'Given a reservation past its grace period with no check-in, when marked no-show, then the held table is released.',
          'Given a customer cancels, when processed, then the reservation status updates and the table is released immediately.',
        ],
        evidence: { screen: 'Reservations → Late booking → No-show; /account → Cancel booking', test: T.s67 },
      },
    ],
  },
  {
    sprint: 8,
    module: 'Inventory',
    goal: 'Track ingredient stock, auto-deduct on sales, and alert on low stock.',
    priority: 'Should',
    lead: '#3',
    status: 'done',
    stakeholders: ['Manager', 'Admin'],
    stories: [
      {
        id: 'US8.1', points: 5,
        text: "As a Manager, I want to manage ingredient stock records (CRUD), so that the system has an accurate baseline of what's on hand.",
        acceptanceCriteria: ['Given the inventory screen, when an ingredient is added, edited, or removed, then the stock list reflects the change immediately.'],
        evidence: { screen: 'Staff → Inventory', test: T.s8 },
      },
      {
        id: 'US8.2', points: 8,
        text: 'As a Manager, I want to map dishes to ingredients (a bill of materials), so that selling a dish can be translated into stock consumption.',
        acceptanceCriteria: ['Given a menu item, when a manager defines its ingredient quantities, then that recipe (BOM) is saved and reusable across orders.'],
        evidence: { screen: 'Menu / Inventory → Recipe editor', test: T.s8 },
      },
      {
        id: 'US8.3', points: 8,
        text: 'As a System (Manager-facing), I want stock to auto-deduct per dish sold, so that inventory stays in sync with actual usage without manual entry.',
        acceptanceCriteria: ["Given a dish with a defined BOM, when an order for it is closed, then each mapped ingredient's stock is reduced by the recipe quantity."],
        evidence: { screen: 'Inventory → Stock movements (Sale #order)', test: T.s8 },
      },
      {
        id: 'US8.4', points: 3,
        text: 'As a Manager, I want low-stock alerts, so that I can reorder before running out mid-service.',
        acceptanceCriteria: ['Given an ingredient falls below its configured threshold, when checked, then a low-stock alert is shown on the manager dashboard.'],
        evidence: { screen: 'Staff overview (manager) + bell + Inventory banner', test: T.s8 },
      },
      {
        id: 'US8.5', points: 3,
        text: 'As a Manager, I want a supplier reorder form, so that restocking is fast and consistent.',
        acceptanceCriteria: ['Given one or more low-stock ingredients, when a manager generates a reorder form, then it lists ingredient, current stock, and suggested reorder quantity.'],
        evidence: { screen: 'Inventory → Reorder form → Submit → Mark received', test: T.s8 },
      },
    ],
  },
  {
    sprint: 9,
    module: 'Staff Management',
    goal: 'Manage staff onboarding, roles/permissions, shift scheduling, and performance tracking.',
    priority: 'Could',
    lead: '#5',
    status: 'done',
    stakeholders: ['Manager', 'Admin'],
    stories: [
      {
        id: 'US9.1', points: 5,
        text: 'As an Admin or Manager, I want to onboard and approve new staff, so that only vetted staff can access operational systems.',
        acceptanceCriteria: ['Given a new staff application, when an admin approves it, then an account is created with the appropriate role.'],
        evidence: { screen: '/careers → Staff management → Applications → Approve', test: T.s910 },
      },
      {
        id: 'US9.2', points: 5,
        text: "As an Admin, I want to assign roles and permissions to staff, so that access matches each person's job function.",
        acceptanceCriteria: ['Given an approved staff member, when their role is set (Waiter/Chef/Manager), then their permitted views and actions update accordingly.'],
        evidence: { screen: 'Staff management → Team → role select (admin)', test: T.s910 },
      },
      {
        id: 'US9.3', points: 5,
        text: 'As a Manager, I want to set shift schedules, so that staffing matches expected demand.',
        acceptanceCriteria: ["Given a staff member, when a manager assigns a shift (date/time), then it appears on that staff member's schedule view."],
        evidence: { screen: 'Staff management → Shifts; My schedule', test: T.s910 },
      },
      {
        id: 'US9.4', points: 3,
        text: 'As an Admin, I want to suspend or remove staff, so that access is revoked promptly when needed.',
        acceptanceCriteria: ['Given a staff account, when suspended or removed, then login access is blocked immediately.'],
        evidence: { screen: 'Staff management → Suspend / Remove', test: T.s910 },
      },
      {
        id: 'US9.5', points: 3,
        text: 'As a Manager, I want to track staff performance, so that I can recognize strong performers and address gaps.',
        acceptanceCriteria: ['Given staff activity (orders served, shifts completed), when viewed on a performance summary, then basic metrics per staff member are displayed.'],
        evidence: { screen: 'Staff management → Performance', test: T.s910 },
      },
    ],
  },
  {
    sprint: 10,
    module: 'Analytics + Project Retrospective',
    goal: 'Deliver the KPI dashboard, complete final integration, and close the project with a final review/retrospective.',
    priority: 'Could',
    lead: '#7',
    status: 'done',
    stakeholders: ['Manager', 'Admin'],
    stories: [
      {
        id: 'US10.1', points: 5,
        text: 'As a Manager, I want revenue and order trend charts (day/week/month), so that I can track business performance over time.',
        acceptanceCriteria: ['Given closed orders/bills, when the dashboard loads, then revenue and order-count trends are charted by the selected period.'],
        evidence: { screen: 'Staff → Analytics (Day / Week / Month)', test: T.s910 },
      },
      {
        id: 'US10.2', points: 3,
        text: 'As a Manager, I want a top-selling-dishes report, so that I know what to promote or restock.',
        acceptanceCriteria: ['Given a date range, when viewed, then dishes are ranked by quantity sold and by revenue.'],
        evidence: { screen: 'Analytics → Top dishes', test: T.s910 },
      },
      {
        id: 'US10.3', points: 5,
        text: 'As a Manager, I want table turnover and utilization metrics, so that I can optimize floor usage.',
        acceptanceCriteria: ['Given table/order history, when viewed, then average turnover time and occupancy rate per table/zone are shown.'],
        evidence: { screen: 'Analytics → Tables & zones', test: T.s910 },
      },
      {
        id: 'US10.4', points: 3,
        text: 'As a Manager, I want peak-hours analysis, so that I can plan staffing around demand.',
        acceptanceCriteria: ['Given order timestamps, when charted, then order volume by hour-of-day is displayed to reveal peak periods.'],
        evidence: { screen: 'Analytics → Peak hours', test: T.s910 },
      },
      {
        id: 'US10.5', points: 3,
        text: 'As a Manager, I want an inventory health summary, so that I can see stock risk at a glance.',
        acceptanceCriteria: ['Given current stock levels, when viewed, then ingredients nearing or below threshold are highlighted on the dashboard.'],
        evidence: { screen: 'Analytics → Inventory health', test: T.s910 },
      },
      {
        id: 'US10.6', points: 3,
        text: 'As a Manager, I want a reservation no-show rate metric, so that I can assess reservation policy effectiveness.',
        acceptanceCriteria: ['Given reservation history, when viewed, then the no-show percentage over a selected period is displayed.'],
        evidence: { screen: 'Analytics → No-show rate', test: T.s910 },
      },
    ],
  },
  {
    sprint: 11,
    module: 'Quality, Security & Operations',
    goal: 'Close the test gaps module by module, lock every role to the access it needs, and give the team a live API status page.',
    priority: 'Must',
    lead: '#7',
    status: 'done',
    stakeholders: ['Admin', 'Manager', 'Waiter', 'Chef', 'Customer'],
    stories: [
      {
        id: 'US11.1', points: 8,
        text: 'As an Admin, I want every API endpoint to enforce a written role policy, so that no role can reach features outside its job.',
        acceptanceCriteria: [
          'Given any role-guarded endpoint, when a guest calls it, then it answers 401; when a signed-in role outside the policy calls it, then it answers 403.',
          'Given a developer adds a guarded route, when it is missing from the access matrix, then CI fails.',
        ],
        evidence: { screen: 'README → Roles and permissions; sign in as a waiter and try a manager action', test: 'routes/access-matrix.test.js' },
      },
      {
        id: 'US11.2', points: 5,
        text: 'As a Manager, I want refunds, payment reversals and cancelling paid orders limited to management, so that floor staff cannot move money back out.',
        acceptanceCriteria: [
          'Given a paid bill, when a waiter tries to mark it unpaid, then the request is refused and the bill stays paid.',
          'Given a paid open order, when a waiter cancels it, then it is refused; when a manager cancels it, then it is cancelled and refunded.',
          'Given a customer, when they cancel their own prepaid order before the kitchen takes it, then it is cancelled and refunded.',
        ],
        evidence: { screen: 'Billing → paid bill (waiter vs manager); Orders → prepaid order', test: 'routes/billing.test.js · routes/orders.test.js' },
      },
      {
        id: 'US11.3', points: 3,
        text: 'As a Manager, I want customer records with order history protected from deletion, so that past orders always point at a real customer.',
        acceptanceCriteria: [
          'Given a customer with orders, when a manager deletes them, then the request is refused with an explanation.',
          'Given a waiter, when they view a customer, then no delete action is offered.',
        ],
        evidence: { screen: 'Staff → Customers → a regular guest', test: 'routes/customers.test.js' },
      },
      {
        id: 'US11.4', points: 3,
        text: 'As a Manager, I want recipes visible only to the kitchen and management, so that recipe and costing information stays internal.',
        acceptanceCriteria: ['Given a waiter, customer or guest, when they load the menu, then no recipe data is included; chefs and managers still see it.'],
        evidence: { screen: 'Staff → Menu as a waiter vs a chef', test: 'routes/menu.test.js' },
      },
      {
        id: 'US11.5', points: 3,
        text: 'As a Manager, I want the public booking and job-application forms rate limited, so that they cannot be used to flood staff with notifications.',
        acceptanceCriteria: [
          'Given a guest, when they submit more than the allowed bookings or applications in the window, then further submissions answer 429 with a retry time.',
          'Given signed-in staff, when they create bookings, then they are never limited.',
        ],
        evidence: { screen: '/book and /careers submitted repeatedly', test: 'middleware/rate-limit.test.js' },
      },
      {
        id: 'US11.6', points: 5,
        text: 'As a QA/DevOps engineer, I want a live API status page, so that I can see every endpoint, what it expects and whether it is up.',
        acceptanceCriteria: [
          'Given a browser, when it opens /api/health, then it sees every endpoint grouped by module with roles, inputs, an example response and live status.',
          'Given a script, when it calls /api/health, then it still receives JSON with status, service and time.',
          'Given the live checks run, then only read-only endpoints are called and no data changes.',
        ],
        evidence: { screen: '/api/health in a browser', test: 'routes/health.test.js · lib/api-catalog.test.js' },
      },
      {
        id: 'US11.7', points: 3,
        text: 'As a Manager, I want settings and menu edits to reject invalid values, so that a typo cannot silently zero the tax rate.',
        acceptanceCriteria: ['Given a settings or category update with a blank, null or non-numeric number, when it is saved, then it is rejected and nothing changes.'],
        evidence: { screen: 'Staff → Settings; Menu → categories', test: 'routes/settings.test.js · routes/menu.test.js' },
      },
    ],
  },
  {
    sprint: 12,
    module: 'Staff Accounts & Hierarchy',
    goal: 'Give every staff member an account page, and let seniors manage the accounts below them, never above.',
    priority: 'Must',
    lead: '#5',
    status: 'done',
    stakeholders: ['Waiter', 'Chef', 'Manager', 'Admin'],
    stories: [
      {
        id: 'US12.1', points: 3,
        text: 'As a staff member, I want a My account page showing my role and what it lets me do, so that I know my permissions.',
        acceptanceCriteria: ['Given any staff role, when they open My account, then they see their name, role, status and the list of what the role can and cannot do.'],
        evidence: { screen: 'Staff → My account', test: 'routes/auth.test.js' },
      },
      {
        id: 'US12.2', points: 3,
        text: 'As a staff member, I want to edit my own name, email and phone, so that my details stay current.',
        acceptanceCriteria: [
          'Given a staff member, when they save a new name or phone, then it is stored.',
          'Given they change their email, when they have not entered their current password, then the change is refused.',
        ],
        evidence: { screen: 'Staff → My account → Profile', test: 'routes/auth.test.js' },
      },
      {
        id: 'US12.3', points: 5,
        text: 'As a staff member, I want to change my password, so that only I can use my account.',
        acceptanceCriteria: [
          'Given the wrong current password, a password under 6 characters or an unchanged one, when submitted, then it is refused.',
          'Given a successful change, then this session stays signed in and every other session is signed out.',
        ],
        evidence: { screen: 'Staff → My account → Password', test: 'routes/auth.test.js' },
      },
      {
        id: 'US12.4', points: 5,
        text: 'As a Manager or Admin, I want to edit details and reset passwords for staff below my rank, so that I can help my team without seeing their passwords.',
        acceptanceCriteria: [
          'Given a manager, when they act on a waiter or chef, then they can edit details and issue a one-time temporary password.',
          'Given a reset, then the user is signed out and must set their own password at next sign-in.',
        ],
        evidence: { screen: 'Staff management → account row → Edit details / Reset password', test: 'routes/auth.test.js' },
      },
      {
        id: 'US12.5', points: 5,
        text: 'As an Admin, I want nobody to manage an account at or above their own rank, so that seniors cannot be locked out by juniors or peers.',
        acceptanceCriteria: [
          'Given the rank admin > manager > chef = waiter, when anyone edits, resets, changes the role of, suspends or removes an account that is not strictly below theirs, then it is refused.',
          'Given an admin, when they act on another admin, then it is refused.',
        ],
        evidence: { screen: 'Staff management as a manager vs an admin', test: 'lib/hierarchy.test.js · routes/auth.test.js' },
      },
      {
        id: 'US12.6', points: 2,
        text: 'As an Admin, I want new hires and reset accounts flagged until they set their own password, so that temporary passwords do not linger.',
        acceptanceCriteria: ['Given an approved hire or a reset account, when they sign in, then a banner asks them to set their own password until they do.'],
        evidence: { screen: 'Approve an application, sign in as the hire', test: 'routes/auth.test.js' },
      },
    ],
  },
  {
    sprint: 13,
    module: 'Attendance & My Work',
    goal: 'Let staff check in and out every day, record unpaid breaks, see their own hours, lateness and estimated pay, and see where colleagues at their level are right now.',
    priority: 'Should',
    lead: '#5',
    status: 'done',
    stakeholders: ['Waiter', 'Chef', 'Manager', 'Admin'],
    stories: [
      {
        id: 'US13.1', points: 5,
        text: 'As a staff member, I want to check in, take a break and check out each day, so that my working time is recorded.',
        acceptanceCriteria: [
          'Given a staff member who is off, when they check in, then a session starts; they can start and end a break, then check out.',
          'Given an invalid step (for example checking in twice), when attempted, then it is refused with a message.',
        ],
        evidence: { screen: 'Staff → My work → Time clock', test: 'routes/attendance.test.js' },
      },
      {
        id: 'US13.2', points: 3,
        text: 'As a Manager, I want breaks to be unpaid and a standard 1-hour break applied when none is recorded on a long day, so that paid time is fair and consistent.',
        acceptanceCriteria: [
          'Given recorded breaks, when paid time is calculated, then break time is excluded.',
          'Given more than 6 worked hours and no recorded break, then a 1-hour unpaid break is deducted and marked as automatic (both values are settings).',
        ],
        evidence: { screen: 'My work → Sessions (auto break flagged)', test: 'lib/attendance.test.js' },
      },
      {
        id: 'US13.3', points: 3,
        text: 'As a Manager, I want late arrivals flagged automatically, so that punctuality is measured the same way for everyone.',
        acceptanceCriteria: ['Given a scheduled shift and a grace period from settings (default 5 minutes), when a staff member checks in after start + grace, then the session is marked late with the minutes late.'],
        evidence: { screen: 'My work → Sessions; Settings → Attendance & pay', test: 'lib/attendance.test.js' },
      },
      {
        id: 'US13.4', points: 8,
        text: 'As a staff member, I want a My work page with my hours, punctuality and attendance as charts and progress rings, broken down by day, week, month and hour of day, so that I can see how I am doing.',
        acceptanceCriteria: [
          'Given my shifts and sessions, when I open My work, then I see rings for hours vs scheduled, on-time rate and attendance rate.',
          'Given the breakdown switch, when I choose day, week, month or hour of day, then the chart shows paid vs scheduled time for that grouping, with a table alternative.',
          'Given my sessions, then each shows check-in, check-out, breaks, late minutes and paid hours.',
        ],
        evidence: { screen: 'Staff → My work', test: 'routes/workforce.test.js' },
      },
      {
        id: 'US13.5', points: 3,
        text: 'As a staff member, I want to see which colleagues at my level are working, on break or off right now, so that I know who is around.',
        acceptanceCriteria: [
          'Given a waiter, then they see every waiter\'s current state, since when, and today\'s shift; a chef sees chefs; a manager sees managers, waiters and chefs; the admin sees everyone.',
        ],
        evidence: { screen: 'My work → Colleagues now', test: 'routes/attendance.test.js' },
      },
    ],
  },
  {
    sprint: 14,
    module: 'Payroll & Workforce Hub',
    goal: 'Turn paid hours, tips and bonuses into an estimated monthly pay for each person, and give the admin one hub that shows everything about everyone.',
    priority: 'Should',
    lead: '#1',
    status: 'done',
    stakeholders: ['Waiter', 'Chef', 'Manager', 'Admin'],
    stories: [
      {
        id: 'US14.1', points: 5,
        text: 'As a staff member, I want my estimated pay for the month, so that I know what I will earn.',
        acceptanceCriteria: [
          'Given a month, then pay = paid hours × hourly wage + tips + bonuses − late deductions, each line itemised, marked "estimated" until the month ends.',
          'Given a waiter, then tips from bills they served are included.',
        ],
        evidence: { screen: 'My work → Pay estimate', test: 'lib/payroll.test.js' },
      },
      {
        id: 'US14.2', points: 3,
        text: 'As an Admin, I want a deduction for each late arrival, so that the late policy is applied consistently.',
        acceptanceCriteria: ['Given the late-arrival penalty in settings (default 5.00), when a month is calculated, then each late session deducts it and is listed.'],
        evidence: { screen: 'Settings → Attendance & pay; My work → Pay estimate', test: 'lib/payroll.test.js' },
      },
      {
        id: 'US14.3', points: 3,
        text: 'As an Admin, I want to set each staff member\'s hourly wage and give bonuses (for example for Eid or a birthday), so that pay reflects my decisions.',
        acceptanceCriteria: ['Given the admin, when they change a wage or add or remove a bonus with amount, reason and date, then it appears on that person\'s pay; nobody else can.'],
        evidence: { screen: 'Workforce → person → Wage / Add bonus', test: 'routes/workforce.test.js' },
      },
      {
        id: 'US14.4', points: 8,
        text: 'As an Admin, I want a Workforce hub with live presence, team charts, progress rings and a staff table with pay, so that I can see everything about everyone in one place.',
        acceptanceCriteria: [
          'Given the admin and a month, then they see KPIs, who is working now, team hours by day and week, lateness trends, and every person with hours, late count, wage, tips, bonuses and net pay, with totals.',
          'Given a person in the table, when opened, then the admin sees the same breakdowns as that person\'s My work page.',
        ],
        evidence: { screen: 'Staff → Workforce', test: 'routes/workforce.test.js' },
      },
      {
        id: 'US14.5', points: 3,
        text: 'As a Manager, I want the Workforce hub for waiters and chefs without any pay figures, so that I can run the rota while pay stays private.',
        acceptanceCriteria: [
          'Given a manager, then the hub shows waiters\' and chefs\' attendance, hours and lateness, and no wage, tips, bonus or pay figure anywhere.',
          'Given a waiter or chef, when they request someone else\'s analytics or pay, then it is refused.',
        ],
        evidence: { screen: 'Staff → Workforce as a manager', test: 'routes/workforce.test.js · routes/access-matrix.test.js' },
      },
    ],
  },
];

export const BACKLOG_SUMMARY: BacklogSummary = (() => {
  const points = (s: SprintBacklog) => s.stories.reduce((p, st) => p + st.points, 0);
  const allStories = SPRINTS.flatMap((s) => s.stories);
  const totalPoints = allStories.reduce((sum, s) => sum + s.points, 0);
  return {
    totalStories: allStories.length,
    totalPoints,
    donePoints: SPRINTS.filter((s) => s.status === 'done').reduce((sum, s) => sum + points(s), 0),
    plannedPoints: SPRINTS.filter((s) => s.status === 'planned').reduce((sum, s) => sum + points(s), 0),
    averageVelocity: Math.round((totalPoints / SPRINTS.length) * 10) / 10,
  };
})();

export const TEAM_ROSTER: { id: string; role: string; moduleLead: string }[] = [
  { id: '#1', role: 'Product Owner', moduleLead: 'Order Management + Billing' },
  { id: '#2', role: 'Scrum Master', moduleLead: 'Kitchen Workflow' },
  { id: '#3', role: 'Developer', moduleLead: 'Menu Management + Inventory' },
  { id: '#4', role: 'Developer', moduleLead: 'Customer Management + Reservations' },
  { id: '#5', role: 'Developer', moduleLead: 'Table Management + Staff Management' },
  { id: '#6', role: 'UI/UX + Developer', moduleLead: 'Storefront (Customer) UI — all sprints' },
  { id: '#7', role: 'QA / DevOps', moduleLead: 'Analytics + Infrastructure' },
];

import type { Role } from '@/types';

export interface Story {
  id: string;
  text: string;
  points: number;
  acceptanceCriteria: string[];
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

const sprint1Criteria: Record<string, string[]> = {
  'US1.1': [
    'Given a new user registers, when they sign up, then they are assigned exactly one role (Customer, Waiter, Chef, Manager, or Admin).',
    'Given a logged-in user, when they navigate to a route outside their role\'s permissions, then the system returns a 403 and redirects to their own dashboard.',
    'Given an Admin, when they view the user list, then they can change any user\'s role.',
  ],
  'US1.2': [
    'Given a Customer, when they register and access their profile, then they can edit their details and the changes persist.',
  ],
  'US1.3': [
    'Given a Waiter or Manager, when they search by name, email, or phone, then matching customer ledger records are returned and can be filtered by type.',
  ],
  'US1.4': [
    'Given a Customer record, when a Waiter, Manager, or Customer views it, then the order history and total spend are displayed.',
  ],
  'US1.5': [
    'Given a Customer, when a Waiter, Manager, or Customer edits preferences, then dietary and allergy restrictions are saved and displayed.',
  ],
};

const sprint2Criteria: Record<string, string[]> = {
  'US2.1': ['Given a Manager or Admin, when they add, edit, or remove a menu item, then the menu reflects the change immediately.'],
  'US2.2': ['Given a Manager, when they create or rename categories, then items are browsable grouped by category.'],
  'US2.3': ['Given a Manager, when they define modifier groups (size, extras), then customers can customize dishes at order time.'],
  'US2.4': ['Given a Customer, when they view a menu item, then dietary and allergen tags are shown.'],
  'US2.5': ['Given a Manager or Chef, when they mark an item out of stock, then customers cannot order it.'],
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
      { id: 'US1.1', points: 8, text: 'As an Admin, I want authentication and role-based access control (RBAC) set up for all five stakeholder roles, so that each role only sees the features and data it is permitted to access.', acceptanceCriteria: sprint1Criteria['US1.1'] },
      { id: 'US1.2', points: 5, text: 'As a Customer, I want to register and edit my profile, so that my details are saved for future visits and orders.', acceptanceCriteria: sprint1Criteria['US1.2'] },
      { id: 'US1.3', points: 3, text: 'As a Waiter or Manager, I want to search and filter the customer ledger, so that I can quickly find a customer during service.', acceptanceCriteria: sprint1Criteria['US1.3'] },
      { id: 'US1.4', points: 5, text: 'As a Waiter, Manager, or Customer, I want to view a customer\'s order history and totals, so that we can reference past orders and spend.', acceptanceCriteria: sprint1Criteria['US1.4'] },
      { id: 'US1.5', points: 3, text: 'As a Customer, I want to store my dietary and allergy preferences, so that the kitchen and waiter are aware of restrictions when I order.', acceptanceCriteria: sprint1Criteria['US1.5'] },
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
      { id: 'US2.1', points: 5, text: 'As a Manager or Admin, I want to add, edit, and remove menu items, so that the menu always reflects what the kitchen can currently serve.', acceptanceCriteria: sprint2Criteria['US2.1'] },
      { id: 'US2.2', points: 3, text: 'As a Manager, I want to organize items by category, so that customers and waiters can browse the menu logically.', acceptanceCriteria: sprint2Criteria['US2.2'] },
      { id: 'US2.3', points: 5, text: 'As a Manager, I want to support modifiers such as size and extras, so that customers can customize dishes at the point of order.', acceptanceCriteria: sprint2Criteria['US2.3'] },
      { id: 'US2.4', points: 3, text: 'As a Customer, I want to see dietary and allergen tags on menu items, so that I can make safe and informed choices.', acceptanceCriteria: sprint2Criteria['US2.4'] },
      { id: 'US2.5', points: 3, text: 'As a Manager or Chef, I want to control item availability / mark items out-of-stock, so that customers cannot order dishes the kitchen cannot currently prepare.', acceptanceCriteria: sprint2Criteria['US2.5'] },
    ],
  },
  {
    sprint: 3,
    module: 'Order Management',
    goal: 'Enable customers to place orders and waiters to confirm and track them end to end.',
    priority: 'Must',
    lead: '#1',
    status: 'done',
    stakeholders: ['Customer', 'Waiter', 'Chef', 'Manager'],
    stories: [
      { id: 'US3.1', points: 8, text: 'As a Customer, I want to place an order (dine-in or online), so that I can order food without waiting for staff availability.', acceptanceCriteria: [] },
      { id: 'US3.2', points: 5, text: 'As a Waiter, I want to confirm a placed order, so that it is officially accepted and routed to the kitchen.', acceptanceCriteria: [] },
      { id: 'US3.3', points: 5, text: 'As a Waiter, Chef, or Manager, I want to track order status through its lifecycle, so that everyone knows where each order stands.', acceptanceCriteria: [] },
      { id: 'US3.4', points: 3, text: 'As a Chef or Waiter, I want item-level status within an order, so that partially-ready orders can still be tracked accurately.', acceptanceCriteria: [] },
      { id: 'US3.5', points: 3, text: 'As a Waiter, I want to attach an order to a specific table, so that service staff know where to deliver food.', acceptanceCriteria: [] },
    ],
  },
  {
    sprint: 4,
    module: 'Kitchen Workflow',
    goal: 'Deliver a Kitchen Display System (KDS) so chefs can receive, prepare, and mark orders ready.',
    priority: 'Must',
    lead: '#2',
    status: 'done',
    stakeholders: ['Chef', 'Waiter', 'Manager'],
    stories: [
      { id: 'US4.1', points: 8, text: 'As a Chef, I want to see incoming confirmed orders in a kitchen queue, so that I know what to prepare next.', acceptanceCriteria: [] },
      { id: 'US4.2', points: 3, text: 'As a Chef, I want to mark an item as in-preparation, so that the team knows which dishes are actively being cooked.', acceptanceCriteria: [] },
      { id: 'US4.3', points: 3, text: 'As a Chef, I want to mark items as ready, so that waiters know when to collect and serve them.', acceptanceCriteria: [] },
      { id: 'US4.4', points: 5, text: 'As a Waiter, I want to be notified when items are ready, so that food is served promptly and doesn\'t sit under the lamp.', acceptanceCriteria: [] },
      { id: 'US4.5', points: 5, text: 'As a Chef or Manager, I want to prioritize and time orders in the kitchen queue, so that older or rush orders are handled first.', acceptanceCriteria: [] },
    ],
  },
  {
    sprint: 5,
    module: 'Billing',
    goal: 'Generate itemized bills from orders, support split bills, and settle payments.',
    priority: 'Must',
    lead: '#1',
    status: 'done',
    stakeholders: ['Waiter', 'Manager', 'Customer'],
    stories: [
      { id: 'US5.1', points: 8, text: 'As a Waiter or Customer, I want an itemized bill auto-generated from a served order, so that the customer can review and settle it accurately.', acceptanceCriteria: [] },
      { id: 'US5.2', points: 5, text: 'As a Manager, I want tax, service charge, and tip applied to bills, so that totals comply with restaurant policy.', acceptanceCriteria: [] },
      { id: 'US5.3', points: 5, text: 'As a Waiter, I want to split a bill across multiple payers, so that groups can each pay their own share.', acceptanceCriteria: [] },
      { id: 'US5.4', points: 3, text: 'As a Waiter or Manager, I want to mark a bill as paid or unpaid, so that the restaurant has an accurate settlement record.', acceptanceCriteria: [] },
      { id: 'US5.5', points: 3, text: 'As a Waiter or Customer, I want to issue a receipt or process a refund, so that customers have proof of payment and errors can be corrected.', acceptanceCriteria: [] },
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
      { id: 'US6.1', points: 5, text: 'As a Manager or Admin, I want to add and edit tables and floor zones, so that the floor plan matches the physical restaurant layout.', acceptanceCriteria: [] },
      { id: 'US6.2', points: 5, text: 'As a Waiter or Manager, I want to view the floor plan with live table status, so that I can seat guests and manage the floor efficiently.', acceptanceCriteria: [] },
      { id: 'US6.3', points: 3, text: 'As a Waiter, I want to assign a table to an order, so that the order and the physical table stay linked.', acceptanceCriteria: [] },
      { id: 'US6.4', points: 3, text: 'As a Waiter, I want to mark a table occupied or free, so that the floor status stays accurate as guests arrive and leave.', acceptanceCriteria: [] },
    ],
  },
  {
    sprint: 7,
    module: 'Reservations',
    goal: 'Let customers book tables by date/time/party size and let staff manage reservation lifecycle.',
    priority: 'Should',
    lead: '#4',
    status: 'done',
    stakeholders: ['Customer', 'Manager', 'Waiter'],
    stories: [
      { id: 'US7.1', points: 5, text: 'As a Customer, I want to book a reservation by date, time-slot, and party size, so that I can guarantee a table before arriving.', acceptanceCriteria: [] },
      { id: 'US7.2', points: 3, text: 'As a Manager or Waiter, I want to manage reservation status, so that the reservation book stays accurate.', acceptanceCriteria: [] },
      { id: 'US7.3', points: 5, text: 'As a Waiter or Manager, I want to assign a table to a reservation, so that the right table is held for the right party size.', acceptanceCriteria: [] },
      { id: 'US7.4', points: 3, text: 'As a Manager, I want to handle no-shows and cancellations, so that tables are freed up for other guests.', acceptanceCriteria: [] },
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
      { id: 'US8.1', points: 5, text: 'As a Manager, I want to manage ingredient stock records (CRUD), so that the system has an accurate baseline of what\'s on hand.', acceptanceCriteria: [] },
      { id: 'US8.2', points: 8, text: 'As a Manager, I want to map dishes to ingredients (a bill of materials), so that selling a dish can be translated into stock consumption.', acceptanceCriteria: [] },
      { id: 'US8.3', points: 8, text: 'As a System (Manager-facing), I want stock to auto-deduct per dish sold, so that inventory stays in sync with actual usage without manual entry.', acceptanceCriteria: [] },
      { id: 'US8.4', points: 3, text: 'As a Manager, I want low-stock alerts, so that I can reorder before running out mid-service.', acceptanceCriteria: [] },
      { id: 'US8.5', points: 3, text: 'As a Manager, I want a supplier reorder form, so that restocking is fast and consistent.', acceptanceCriteria: [] },
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
      { id: 'US9.1', points: 5, text: 'As an Admin or Manager, I want to onboard and approve new staff, so that only vetted staff can access operational systems.', acceptanceCriteria: [] },
      { id: 'US9.2', points: 5, text: 'As an Admin, I want to assign roles and permissions to staff, so that access matches each person\'s job function.', acceptanceCriteria: [] },
      { id: 'US9.3', points: 5, text: 'As a Manager, I want to set shift schedules, so that staffing matches expected demand.', acceptanceCriteria: [] },
      { id: 'US9.4', points: 3, text: 'As an Admin, I want to suspend or remove staff, so that access is revoked promptly when needed.', acceptanceCriteria: [] },
      { id: 'US9.5', points: 3, text: 'As a Manager, I want to track staff performance, so that I can recognize strong performers and address gaps.', acceptanceCriteria: [] },
    ],
  },
  {
    sprint: 10,
    module: 'Analytics + Retrospective',
    goal: 'Deliver the KPI dashboard, complete final integration, and close the project with a final review/retrospective.',
    priority: 'Could',
    lead: '#7',
    status: 'done',
    stakeholders: ['Manager', 'Admin'],
    stories: [
      { id: 'US10.1', points: 5, text: 'As a Manager, I want revenue and order trend charts (day/week/month), so that I can track business performance over time.', acceptanceCriteria: [] },
      { id: 'US10.2', points: 3, text: 'As a Manager, I want a top-selling-dishes report, so that I know what to promote or restock.', acceptanceCriteria: [] },
      { id: 'US10.3', points: 5, text: 'As a Manager, I want table turnover and utilization metrics, so that I can optimize floor usage.', acceptanceCriteria: [] },
      { id: 'US10.4', points: 3, text: 'As a Manager, I want peak-hours analysis, so that I can plan staffing around demand.', acceptanceCriteria: [] },
      { id: 'US10.5', points: 3, text: 'As a Manager, I want an inventory health summary, so that I can see stock risk at a glance.', acceptanceCriteria: [] },
      { id: 'US10.6', points: 3, text: 'As a Manager, I want a reservation no-show rate metric, so that I can assess reservation policy effectiveness.', acceptanceCriteria: [] },
    ],
  },
];

export const BACKLOG_SUMMARY: BacklogSummary = (() => {
  const allStories = SPRINTS.flatMap((s) => s.stories);
  const done = SPRINTS.filter((s) => s.status === 'done');
  return {
    totalStories: allStories.length,
    totalPoints: allStories.reduce((sum, s) => sum + s.points, 0),
    donePoints: done.reduce((sum, s) => sum + s.stories.reduce((p, st) => p + st.points, 0), 0),
    plannedPoints: SPRINTS.filter((s) => s.status === 'planned').reduce(
      (sum, s) => sum + s.stories.reduce((p, st) => p + st.points, 0),
      0,
    ),
    averageVelocity: Math.round((217 / 10) * 10) / 10,
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
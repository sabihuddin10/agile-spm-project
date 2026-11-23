/** users, customers, customer_preferences. */
import { iso, num, ref, byParent } from './sql.js';

export function save(s, ids) {
  return [
    ['users', 'id bigint, ext_id text, name text, email text, phone text, role role, active boolean, must_change_password boolean, password_hash text, token_version integer, hourly_wage numeric, created_at timestamptz',
      s.users.map((u, i) => ({
        id: i + 1, ext_id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, active: u.active,
        must_change_password: u.mustChangePassword, password_hash: u.passwordHash, token_version: u.tokenVersion,
        hourly_wage: u.hourlyWage ?? null, created_at: u.createdAt,
      }))],
    ['customers', 'id bigint, ext_id text, user_id bigint, name text, email text, phone text, type customer_type, loyalty_points integer, notes text, created_at timestamptz',
      s.customers.map((c, i) => ({
        id: i + 1, ext_id: c.id, user_id: ref(ids.users, c.userId), name: c.name, email: c.email, phone: c.phone,
        type: c.type, loyalty_points: c.loyaltyPoints, notes: c.notes, created_at: c.createdAt,
      }))],
    ['customer_preferences', 'customer_id bigint, kind text, value text',
      s.customers.flatMap((c, i) => [
        ...(c.preferences?.dietary ?? []).map((value) => ({ customer_id: i + 1, kind: 'dietary', value })),
        ...(c.preferences?.allergies ?? []).map((value) => ({ customer_id: i + 1, kind: 'allergy', value })),
      ]), { identity: false }],
  ];
}

export function load(r, x) {
  const prefsOf = byParent(r.customer_preferences, 'customer_id');
  const prefs = (id, kind) => prefsOf(id).filter((p) => p.kind === kind).map((p) => p.value);
  return {
    users: r.users.map((u) => ({
      id: u.ext_id, name: u.name, email: u.email, role: u.role, phone: u.phone, active: u.active,
      mustChangePassword: u.must_change_password, tokenVersion: u.token_version, passwordHash: u.password_hash,
      ...(u.hourly_wage == null ? {} : { hourlyWage: num(u.hourly_wage) }), createdAt: iso(u.created_at),
    })),
    customers: r.customers.map((c) => ({
      id: c.ext_id, userId: ref(x.users, c.user_id), phone: c.phone, type: c.type, loyaltyPoints: c.loyalty_points,
      preferences: { dietary: prefs(c.id, 'dietary'), allergies: prefs(c.id, 'allergy') },
      notes: c.notes, createdAt: iso(c.created_at), name: c.name, email: c.email,
    })),
  };
}

/** tables, reservations (and the tables.reserved_for link, set once reservations exist). */
import { iso, hm, ref } from './sql.js';

export function save(s, ids) {
  const reservedFor = s.tables
    .map((t, i) => ({ id: i + 1, r: ref(ids.reservations, t.reservedFor) }))
    .filter((t) => t.r != null);
  return [
    ['tables', 'id bigint, ext_id text, number integer, seats integer, zone text, status table_status, waiter_id bigint, held boolean',
      s.tables.map((t, i) => ({
        id: i + 1, ext_id: t.id, number: t.number, seats: t.seats, zone: t.zone, status: t.status,
        waiter_id: ref(ids.users, t.waiterId), held: t.held,
      }))],
    ['reservations', 'id bigint, ext_id text, customer_name text, email text, phone text, party_size integer, date date, time time, table_id bigint, status reservation_status, special_requests text, customer_id bigint, created_at timestamptz, confirmed_at timestamptz, seated_at timestamptz, cancelled_at timestamptz, notified_at timestamptz',
      s.reservations.map((b, i) => ({
        id: i + 1, ext_id: b.id, customer_name: b.customerName, email: b.email, phone: b.phone, party_size: b.partySize,
        date: b.date, time: b.time, table_id: ref(ids.tables, b.tableId), status: b.status, special_requests: b.specialRequests,
        customer_id: ref(ids.customers, b.customerId), created_at: b.createdAt, confirmed_at: b.confirmedAt,
        seated_at: b.seatedAt, cancelled_at: b.cancelledAt, notified_at: b.notifiedAt,
      }))],
    async (db) => {
      if (!reservedFor.length) return;
      await db.query(
        'UPDATE tables t SET reserved_for = x.r FROM jsonb_to_recordset($1::jsonb) AS x(id bigint, r bigint) WHERE t.id = x.id',
        [JSON.stringify(reservedFor)],
      );
    },
  ];
}

export function load(r, x) {
  return {
    tables: r.tables.map((t) => ({
      id: t.ext_id, number: t.number, seats: t.seats, zone: t.zone, status: t.status,
      waiterId: ref(x.users, t.waiter_id), held: t.held, reservedFor: ref(x.reservations, t.reserved_for),
    })),
    reservations: r.reservations.map((b) => ({
      id: b.ext_id, customerName: b.customer_name, email: b.email, phone: b.phone, partySize: b.party_size,
      date: b.date, time: hm(b.time), tableId: ref(x.tables, b.table_id), status: b.status,
      specialRequests: b.special_requests, customerId: ref(x.customers, b.customer_id), createdAt: iso(b.created_at),
      confirmedAt: iso(b.confirmed_at), seatedAt: iso(b.seated_at), cancelledAt: iso(b.cancelled_at), notifiedAt: iso(b.notified_at),
    })),
  };
}

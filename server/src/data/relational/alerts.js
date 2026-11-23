/** notifications, notification_reads. */
import { iso, ref, byParent } from './sql.js';

export function save(s, ids) {
  return [
    ['notifications', 'id bigint, ext_id text, user_id bigint, role role, channel notification_channel, to_email text, type text, title text, message text, link text, order_id bigint, reservation_id bigint, created_at timestamptz',
      s.notifications.map((n, i) => ({
        id: i + 1, ext_id: n.id, user_id: ref(ids.users, n.userId), role: n.role ?? null, channel: n.channel, to_email: n.to ?? null,
        type: n.type, title: n.title, message: n.message, link: n.link ?? null, order_id: ref(ids.orders, n.orderId),
        reservation_id: ref(ids.reservations, n.reservationId), created_at: n.createdAt,
      }))],
    ['notification_reads', 'notification_id bigint, user_id bigint, read_at timestamptz',
      s.notifications.flatMap((n, i) => n.readBy.map((userId) => ({
        notification_id: i + 1, user_id: ref(ids.users, userId), read_at: n.createdAt,
      }))).filter((row) => row.user_id != null), { identity: false }],
  ];
}

export function load(r, x) {
  const readsOf = byParent(r.notification_reads, 'notification_id');
  return {
    notifications: r.notifications.map((n) => ({
      id: n.ext_id, userId: ref(x.users, n.user_id), role: n.role, channel: n.channel, to: n.to_email, link: n.link,
      orderId: ref(x.orders, n.order_id), reservationId: ref(x.reservations, n.reservation_id),
      readBy: readsOf(n.id).map((rd) => ref(x.users, rd.user_id)), createdAt: iso(n.created_at),
      type: n.type, title: n.title, message: n.message,
    })),
  };
}

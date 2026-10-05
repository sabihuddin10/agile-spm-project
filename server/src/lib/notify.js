import { notifications, nextId } from '../data/store.js';
import { iso } from './time.js';

const MAX_NOTIFICATIONS = 1000;

/**
 * Create a notification. Target one user with `userId`, or broadcast to every
 * user of a role with `role`. `channel: 'email'` records a (simulated) email to
 * `to` — used for guests without an account.
 */
export function notify({ userId = null, role = null, channel = 'in-app', to = null, type, title, message, link = null, orderId = null, reservationId = null }) {
  const n = { id: nextId('ntf'), userId, role, channel, to, type, title, message, link, orderId, reservationId, readBy: [], createdAt: iso() };
  notifications.push(n);
  if (notifications.length > MAX_NOTIFICATIONS) notifications.splice(0, notifications.length - MAX_NOTIFICATIONS);
  return n;
}

/** In-app notifications visible to `user`, newest first. */
export function notificationsFor(user) {
  return notifications
    .filter((n) => n.channel === 'in-app' && (n.userId === user.id || (!n.userId && n.role === user.role)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function serializeNotification(n, user) {
  const { readBy, ...rest } = n;
  return { ...rest, read: readBy.includes(user.id) };
}

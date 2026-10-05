import { Router } from 'express';
import { notifications } from '../data/store.js';
import { notificationsFor, serializeNotification } from '../lib/notify.js';

const router = Router();

/** GET /api/notifications — the caller's in-app notifications (US4.4, US7.2). */
router.get('/', (req, res) => {
  const mine = notificationsFor(req.user);
  res.json({
    notifications: mine.slice(0, 30).map((n) => serializeNotification(n, req.user)),
    unreadCount: mine.filter((n) => !n.readBy.includes(req.user.id)).length,
  });
});

/** POST /api/notifications/read-all */
router.post('/read-all', (req, res) => {
  for (const n of notificationsFor(req.user)) {
    if (!n.readBy.includes(req.user.id)) n.readBy.push(req.user.id);
  }
  res.json({ ok: true });
});

/** POST /api/notifications/:id/read */
router.post('/:id/read', (req, res) => {
  const n = notifications.find((x) => x.id === req.params.id);
  if (!n || !notificationsFor(req.user).includes(n)) return res.status(404).json({ error: 'Notification not found.' });
  if (!n.readBy.includes(req.user.id)) n.readBy.push(req.user.id);
  res.json({ notification: serializeNotification(n, req.user) });
});

export default router;

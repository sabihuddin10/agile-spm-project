import { Router } from 'express';
import { settings, TIME_SLOTS } from '../data/store.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

/** [field, min, max] for numeric policy settings. */
const NUMERIC = [
  ['taxRate', 0, 0.5],
  ['serviceChargeRate', 0, 0.5],
  ['pointValue', 0, 1],
  ['kitchenDelayMinutes', 1, 240],
  ['reservationDurationMinutes', 30, 300],
  ['reservationGraceMinutes', 0, 120],
  ['openingHour', 0, 23],
  ['closingHour', 1, 24],
];

/** GET /api/settings — restaurant policy (public: the storefront needs tax & points). */
router.get('/', (req, res) => {
  res.json({ settings, timeSlots: TIME_SLOTS });
});

/** PATCH /api/settings — update tax, service charge, kitchen threshold, etc. (manager/admin). */
router.patch('/', requireRole('manager', 'admin'), (req, res) => {
  const body = req.body || {};
  const next = { ...settings };

  for (const [field, min, max] of NUMERIC) {
    if (body[field] === undefined) continue;
    const value = Number(body[field]);
    if (!(value >= min && value <= max)) {
      return res.status(400).json({ error: `${field} must be between ${min} and ${max}.` });
    }
    next[field] = value;
  }
  for (const field of ['restaurantName', 'address']) {
    if (body[field] === undefined) continue;
    if (!String(body[field]).trim()) return res.status(400).json({ error: `${field} cannot be empty.` });
    next[field] = String(body[field]).trim();
  }
  if (next.openingHour >= next.closingHour) {
    return res.status(400).json({ error: 'Opening hour must be before closing hour.' });
  }

  Object.assign(settings, next);
  return res.json({ settings });
});

export default router;

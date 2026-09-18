import { Router } from 'express';
import { tables, tableStatuses, nextId } from '../data/store.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();
const staffRoles = requireRole('waiter', 'chef', 'manager', 'admin');

/** GET /api/tables — list tables. */
router.get('/', staffRoles, (req, res) => {
  res.json({ tables });
});

/** POST /api/tables — create a table (manager/admin). */
router.post('/', requireRole('manager', 'admin'), (req, res) => {
  const { number, seats = 4, status = 'free' } = req.body || {};
  if (!number) return res.status(400).json({ error: 'Table number is required.' });
  if (tables.some((t) => t.number === Number(number))) {
    return res.status(409).json({ error: 'A table with that number already exists.' });
  }
  const table = {
    id: nextId('tab'),
    number: Number(number),
    seats: Number(seats),
    status: tableStatuses.includes(status) ? status : 'free',
    waiterId: null,
  };
  tables.push(table);
  return res.status(201).json({ table });
});

/** PATCH /api/tables/:id — change status / assign waiter (staff). */
router.patch('/:id', staffRoles, (req, res) => {
  const table = tables.find((t) => t.id === req.params.id);
  if (!table) return res.status(404).json({ error: 'Table not found.' });
  const { status, waiterId, seats } = req.body || {};
  if (status !== undefined) {
    if (!tableStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status.' });
    table.status = status;
  }
  if (waiterId !== undefined) table.waiterId = waiterId || null;
  if (seats !== undefined) table.seats = Number(seats);
  return res.json({ table });
});

/** DELETE /api/tables/:id — remove table (manager/admin). */
router.delete('/:id', requireRole('manager', 'admin'), (req, res) => {
  const idx = tables.findIndex((t) => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Table not found.' });
  const [removed] = tables.splice(idx, 1);
  return res.json({ deleted: true, id: removed.id });
});

export default router;

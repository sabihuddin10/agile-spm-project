import { Router } from 'express';
import { inventory, inventoryUnits, nextId } from '../data/store.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();
const staffRoles = requireRole('chef', 'manager', 'admin');

/** GET /api/inventory — list with low-stock flag. */
router.get('/', staffRoles, (req, res) => {
  const list = inventory.map((i) => ({
    ...i,
    lowStock: i.stock <= i.reorderLevel,
  }));
  res.json({ inventory: list, units: inventoryUnits });
});

/** POST /api/inventory — add item (manager/admin). */
router.post('/', requireRole('manager', 'admin'), (req, res) => {
  const { name, category = 'Dry Goods', stock = 0, unit = 'units', reorderLevel = 0, costPerUnit = 0 } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Item name is required.' });
  const item = { id: nextId('inv'), name, category, stock: Number(stock), unit, reorderLevel: Number(reorderLevel), costPerUnit: Number(costPerUnit) };
  inventory.push(item);
  return res.status(201).json({ item });
});

/** PATCH /api/inventory/:id — adjust stock/fields. Body: { delta?, ... }. */
router.patch('/:id', staffRoles, (req, res) => {
  const item = inventory.find((i) => i.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Inventory item not found.' });
  const { delta, stock, name, category, unit, reorderLevel, costPerUnit } = req.body || {};
  if (delta !== undefined) item.stock = Math.max(0, item.stock + Number(delta));
  if (stock !== undefined) item.stock = Math.max(0, Number(stock));
  if (name !== undefined) item.name = name;
  if (category !== undefined) item.category = category;
  if (unit !== undefined) item.unit = unit;
  if (reorderLevel !== undefined) item.reorderLevel = Number(reorderLevel);
  if (costPerUnit !== undefined) item.costPerUnit = Number(costPerUnit);
  return res.json({ item });
});

/** DELETE /api/inventory/:id — remove item (manager/admin). */
router.delete('/:id', requireRole('manager', 'admin'), (req, res) => {
  const idx = inventory.findIndex((i) => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Inventory item not found.' });
  const [removed] = inventory.splice(idx, 1);
  return res.json({ deleted: true, id: removed.id });
});

export default router;

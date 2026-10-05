import { Router } from 'express';
import { inventory, inventoryUnits, menuItems, stockMovements, purchaseOrders, nextId } from '../data/store.js';
import { requireRole } from '../middleware/auth.js';
import { adjustStock } from '../lib/orders.js';
import { iso } from '../lib/time.js';

const router = Router();
const kitchenRoles = requireRole('chef', 'manager', 'admin');
const managerRoles = requireRole('manager', 'admin');

const round2 = (n) => Math.round(n * 100) / 100;

/** Stock health: 'low' at/below reorder level, 'near' within 25% above it. */
function health(item) {
  if (item.stock <= item.reorderLevel) return 'low';
  if (item.stock <= item.reorderLevel * 1.25) return 'near';
  return 'ok';
}

function serialize(item) {
  return {
    ...item,
    lowStock: item.stock <= item.reorderLevel,
    health: health(item),
    usedBy: menuItems.filter((m) => m.recipe.some((r) => r.inventoryId === item.id)).map((m) => m.name),
  };
}

/** Suggested order quantity: bring stock back up to twice the reorder level. */
function suggestedQty(item) {
  const target = item.reorderLevel * 2;
  const qty = Math.max(target - item.stock, item.reorderLevel);
  return item.unit === 'units' || item.unit === 'dozen' || item.unit === 'boxes' ? Math.ceil(qty) : round2(Math.ceil(qty * 10) / 10);
}

function validateFields(body, partial) {
  const { name, unit, stock, reorderLevel, costPerUnit } = body;
  if (!partial || name !== undefined) {
    if (!String(name || '').trim()) return 'Ingredient name is required.';
  }
  if (unit !== undefined && !inventoryUnits.includes(unit)) return `Unit must be one of: ${inventoryUnits.join(', ')}.`;
  for (const [label, value] of [['Stock', stock], ['Reorder level', reorderLevel], ['Cost per unit', costPerUnit]]) {
    if (value !== undefined && !(Number(value) >= 0)) return `${label} must be zero or more.`;
  }
  return null;
}

/** GET /api/inventory — stock list with low-stock flags (US8.1, US8.4). */
router.get('/', kitchenRoles, (req, res) => {
  const categories = [...new Set(inventory.map((i) => i.category))].sort();
  res.json({ inventory: inventory.map(serialize), units: inventoryUnits, categories });
});

/** POST /api/inventory — add an ingredient (manager/admin). */
router.post('/', managerRoles, (req, res) => {
  const error = validateFields(req.body || {}, false);
  if (error) return res.status(400).json({ error });
  const { name, category = 'Dry Goods', stock = 0, unit = 'units', reorderLevel = 0, costPerUnit = 0, supplier = '' } = req.body;
  if (inventory.some((i) => i.name.toLowerCase() === String(name).trim().toLowerCase())) {
    return res.status(409).json({ error: 'An ingredient with that name already exists.' });
  }
  const item = {
    id: nextId('inv'),
    name: String(name).trim(),
    category: String(category).trim() || 'Dry Goods',
    stock: Number(stock),
    unit,
    reorderLevel: Number(reorderLevel),
    costPerUnit: Number(costPerUnit),
    supplier: String(supplier).trim(),
  };
  inventory.push(item);
  return res.status(201).json({ item: serialize(item) });
});

/**
 * PATCH /api/inventory/:id — { delta } adjusts stock (chef/manager/admin);
 * other fields are manager/admin only.
 */
router.patch('/:id', kitchenRoles, (req, res) => {
  const item = inventory.find((i) => i.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Inventory item not found.' });
  const body = req.body || {};
  const fieldKeys = Object.keys(body).filter((k) => k !== 'delta');
  if (fieldKeys.length && !['manager', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Only managers can edit ingredient details.' });
  }
  const error = validateFields(body, true);
  if (error) return res.status(400).json({ error });

  const { delta, stock, name, category, unit, reorderLevel, costPerUnit, supplier } = body;
  if (name !== undefined) {
    const clean = String(name).trim();
    if (inventory.some((i) => i.id !== item.id && i.name.toLowerCase() === clean.toLowerCase())) {
      return res.status(409).json({ error: 'An ingredient with that name already exists.' });
    }
    item.name = clean;
  }
  if (category !== undefined) item.category = String(category).trim() || item.category;
  if (unit !== undefined) item.unit = unit;
  if (reorderLevel !== undefined) item.reorderLevel = Number(reorderLevel);
  if (costPerUnit !== undefined) item.costPerUnit = Number(costPerUnit);
  if (supplier !== undefined) item.supplier = String(supplier).trim();
  if (stock !== undefined) adjustStock(item, Number(stock) - item.stock, 'count', { userId: req.user.id });
  if (delta !== undefined) {
    if (!Number.isFinite(Number(delta))) return res.status(400).json({ error: 'delta must be a number.' });
    adjustStock(item, Number(delta), Number(delta) >= 0 ? 'restock' : 'wastage', { userId: req.user.id });
  }
  return res.json({ item: serialize(item) });
});

/** DELETE /api/inventory/:id — remove an ingredient not used in any recipe (manager/admin). */
router.delete('/:id', managerRoles, (req, res) => {
  const idx = inventory.findIndex((i) => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Inventory item not found.' });
  const usedBy = menuItems.filter((m) => m.recipe.some((r) => r.inventoryId === req.params.id));
  if (usedBy.length) {
    return res.status(409).json({ error: `Used in recipes: ${usedBy.map((m) => m.name).join(', ')}. Remove it from those recipes first.` });
  }
  const [removed] = inventory.splice(idx, 1);
  return res.json({ deleted: true, id: removed.id });
});

/** GET /api/inventory/movements — recent stock movements (sales deductions, adjustments, restocks). */
router.get('/movements', kitchenRoles, (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 500);
  const list = req.query.inventoryId ? stockMovements.filter((m) => m.inventoryId === req.query.inventoryId) : stockMovements;
  res.json({ movements: list.slice(-limit).reverse() });
});

/**
 * GET /api/inventory/reorder — supplier reorder suggestions for low-stock
 * ingredients (US8.5). ?all=1 lists every ingredient.
 */
router.get('/reorder', managerRoles, (req, res) => {
  const source = req.query.all ? inventory : inventory.filter((i) => i.stock <= i.reorderLevel);
  const lines = source.map((i) => ({
    inventoryId: i.id,
    name: i.name,
    unit: i.unit,
    supplier: i.supplier,
    stock: i.stock,
    reorderLevel: i.reorderLevel,
    suggestedQty: suggestedQty(i),
    costPerUnit: i.costPerUnit,
    estimatedCost: round2(suggestedQty(i) * i.costPerUnit),
  }));
  res.json({ lines, estimatedTotal: round2(lines.reduce((s, l) => s + l.estimatedCost, 0)) });
});

/** GET /api/inventory/purchase-orders — submitted reorder forms. */
router.get('/purchase-orders', managerRoles, (req, res) => {
  res.json({ purchaseOrders: purchaseOrders.slice().reverse() });
});

/** POST /api/inventory/purchase-orders — submit a reorder form { lines: [{ inventoryId, qty }], notes }. */
router.post('/purchase-orders', managerRoles, (req, res) => {
  const raw = Array.isArray(req.body?.lines) ? req.body.lines : [];
  const lines = [];
  for (const l of raw) {
    const item = inventory.find((i) => i.id === l?.inventoryId);
    if (!item) return res.status(400).json({ error: 'Unknown ingredient on reorder form.' });
    const qty = Number(l.qty);
    if (!(qty > 0)) return res.status(400).json({ error: `Quantity for ${item.name} must be greater than zero.` });
    lines.push({ inventoryId: item.id, name: item.name, unit: item.unit, supplier: item.supplier, qty, costPerUnit: item.costPerUnit, cost: round2(qty * item.costPerUnit) });
  }
  if (lines.length === 0) return res.status(400).json({ error: 'Add at least one ingredient to the reorder form.' });

  const po = {
    id: nextId('po'),
    number: `PO-${String(purchaseOrders.length + 1).padStart(4, '0')}`,
    lines,
    total: round2(lines.reduce((s, l) => s + l.cost, 0)),
    notes: String(req.body?.notes || ''),
    status: 'sent',
    createdAt: iso(),
    createdBy: req.user.id,
    receivedAt: null,
  };
  purchaseOrders.push(po);
  return res.status(201).json({ purchaseOrder: po });
});

/** POST /api/inventory/purchase-orders/:id/receive — goods arrived: restock every line. */
router.post('/purchase-orders/:id/receive', managerRoles, (req, res) => {
  const po = purchaseOrders.find((p) => p.id === req.params.id);
  if (!po) return res.status(404).json({ error: 'Purchase order not found.' });
  if (po.status === 'received') return res.status(409).json({ error: 'This order was already received.' });
  for (const line of po.lines) {
    const item = inventory.find((i) => i.id === line.inventoryId);
    if (item) adjustStock(item, line.qty, 'restock', { userId: req.user.id });
  }
  po.status = 'received';
  po.receivedAt = iso();
  return res.json({ purchaseOrder: po });
});

export default router;

import { Router } from 'express';
import {
  categories,
  menuItems,
  cuisineTagList,
  allergenList,
  nextId,
} from '../data/store.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

// Only Chef, Manager and Admin may mutate the menu.
const manageMenu = requireRole('chef', 'manager', 'admin');

function serializeCategory(category, includeItems = false) {
  const cat = { ...category, itemCount: menuItems.filter((m) => m.categoryId === category.id).length };
  if (includeItems) cat.items = menuItems.filter((m) => m.categoryId === category.id);
  return cat;
}

function serializeMenu() {
  return categories
    .slice()
    .sort((a, b) => a.sort - b.sort)
    .map((c) => serializeCategory(c, true));
}

/* ----------------------------------------------------------------- menu */

/** GET /api/menu — full menu grouped by category (public). */
router.get('/', (req, res) => {
  res.json({ menu: serializeMenu(), tags: cuisineTagList, allergens: allergenList });
});

/** GET /api/menu/items — flat item list (with category name lookup). */
router.get('/items', (req, res) => {
  const items = menuItems.map((item) => ({
    ...item,
    category: categories.find((c) => c.id === item.categoryId)?.name || '',
  }));
  if (req.query.category) {
    const cid = categories.find((c) => c.name === req.query.category)?.id;
    return res.json({ items: items.filter((i) => i.categoryId === cid) });
  }
  res.json({ items });
});

/** POST /api/menu/items — create a menu item. */
router.post('/items', manageMenu, (req, res) => {
  const {
    name,
    categoryId,
    price,
    description = '',
    dietaryTags = [],
    allergens = [],
    modifiers = [],
    available = true,
    outOfStockReason = '',
  } = req.body || {};

  if (!name || !categoryId || price === undefined) {
    return res.status(400).json({ error: 'name, categoryId and price are required.' });
  }
  if (!categories.some((c) => c.id === categoryId)) {
    return res.status(400).json({ error: 'Unknown category.' });
  }

  const item = {
    id: nextId('mi'),
    name,
    categoryId,
    price: Number(price),
    description,
    dietaryTags,
    allergens,
    modifiers: Array.isArray(modifiers) ? modifiers : [],
    available: Boolean(available),
    outOfStockReason: Boolean(available) ? '' : (outOfStockReason || ''),
    createdAt: new Date().toISOString(),
  };
  menuItems.push(item);
  return res.status(201).json({ item: { ...item, category: categories.find((c) => c.id === categoryId)?.name } });
});

/** PATCH /api/menu/items/:id — update a menu item (incl. availability control). */
router.patch('/items/:id', manageMenu, (req, res) => {
  const item = menuItems.find((m) => m.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Menu item not found.' });

  const { name, categoryId, price, description, dietaryTags, allergens, modifiers, available, outOfStockReason } = req.body || {};

  if (name !== undefined) item.name = name;
  if (categoryId !== undefined) {
    if (!categories.some((c) => c.id === categoryId)) return res.status(400).json({ error: 'Unknown category.' });
    item.categoryId = categoryId;
  }
  if (price !== undefined) item.price = Number(price);
  if (description !== undefined) item.description = description;
  if (dietaryTags !== undefined) item.dietaryTags = dietaryTags;
  if (allergens !== undefined) item.allergens = allergens;
  if (modifiers !== undefined) item.modifiers = modifiers;
  if (available !== undefined) {
    item.available = Boolean(available);
    item.outOfStockReason = Boolean(available) ? '' : (outOfStockReason || item.outOfStockReason || '');
  } else if (outOfStockReason !== undefined) {
    item.outOfStockReason = outOfStockReason;
  }

  return res.json({ item: { ...item, category: categories.find((c) => c.id === item.categoryId)?.name } });
});

/** DELETE /api/menu/items/:id — remove a menu item. */
router.delete('/items/:id', manageMenu, (req, res) => {
  const idx = menuItems.findIndex((m) => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Menu item not found.' });
  const [removed] = menuItems.splice(idx, 1);
  return res.json({ deleted: true, id: removed.id });
});

/* ------------------------------------------------------------- categories */

/** GET /api/menu/categories */
router.get('/categories', (req, res) => {
  res.json({ categories: categories.slice().sort((a, b) => a.sort - b.sort) });
});

/** POST /api/menu/categories — create a category. */
router.post('/categories', manageMenu, (req, res) => {
  const { name, sort = categories.length + 1 } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Category name is required.' });
  if (categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
    return res.status(409).json({ error: 'A category with that name already exists.' });
  }
  const category = { id: nextId('cat'), name, sort: Number(sort), active: true };
  categories.push(category);
  return res.status(201).json({ category: serializeCategory(category) });
});

/** PATCH /api/menu/categories/:id */
router.patch('/categories/:id', manageMenu, (req, res) => {
  const category = categories.find((c) => c.id === req.params.id);
  if (!category) return res.status(404).json({ error: 'Category not found.' });
  const { name, sort, active } = req.body || {};
  if (name !== undefined) category.name = name;
  if (sort !== undefined) category.sort = Number(sort);
  if (active !== undefined) category.active = Boolean(active);
  return res.json({ category: serializeCategory(category) });
});

/** DELETE /api/menu/categories/:id */
router.delete('/categories/:id', manageMenu, (req, res) => {
  const idx = categories.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Category not found.' });
  const hasItems = menuItems.some((m) => m.categoryId === req.params.id);
  if (hasItems) return res.status(409).json({ error: 'Cannot delete a category that still has items.' });
  const [removed] = categories.splice(idx, 1);
  return res.json({ deleted: true, id: removed.id });
});

export default router;

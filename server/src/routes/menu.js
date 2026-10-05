import { Router } from 'express';
import {
  categories,
  menuItems,
  inventory,
  cuisineTagList,
  allergenList,
  nextId,
  STAFF_ROLES,
} from '../data/store.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

// US2.1: Manager/Admin add, edit and remove items and categories.
// US2.5: Chefs may additionally toggle availability (out of stock).
const manageMenu = requireRole('manager', 'admin');
const editItems = requireRole('chef', 'manager', 'admin');
const AVAILABILITY_FIELDS = ['available', 'outOfStockReason'];

const isStaff = (req) => Boolean(req.user && STAFF_ROLES.includes(req.user.role));

function serializeItem(item, withRecipe) {
  const out = { ...item, category: categories.find((c) => c.id === item.categoryId)?.name || '' };
  if (withRecipe) {
    out.recipe = item.recipe.map((r) => {
      const ing = inventory.find((i) => i.id === r.inventoryId);
      return { ...r, name: ing?.name ?? 'Unknown ingredient', unit: ing?.unit ?? '' };
    });
  } else {
    delete out.recipe;
  }
  return out;
}

/**
 * Normalize modifier groups from the admin form. Options may be objects
 * ({ label, priceDelta }) or strings like "Large +4".
 */
function normalizeModifiers(raw) {
  if (!Array.isArray(raw)) return { modifiers: [] };
  const modifiers = [];
  for (const g of raw) {
    const name = String(g?.name || '').trim();
    if (!name) continue;
    const options = (Array.isArray(g.options) ? g.options : [])
      .map((o) => {
        if (typeof o === 'string') {
          const match = o.trim().match(/^(.*?)(?:\s*\+\s*\$?(\d+(?:\.\d+)?))?$/);
          return { label: match[1].trim(), priceDelta: match[2] ? Number(match[2]) : 0 };
        }
        return { label: String(o?.label || '').trim(), priceDelta: Number(o?.priceDelta) || 0 };
      })
      .filter((o) => o.label);
    if (options.length === 0) return { error: `Modifier group "${name}" needs at least one option.` };
    if (options.some((o) => o.priceDelta < 0)) return { error: 'Modifier price changes cannot be negative.' };
    modifiers.push({ id: g.id || nextId('mod'), name, type: g.type === 'multi' ? 'multi' : 'single', options });
  }
  return { modifiers };
}

/* ----------------------------------------------------------------- menu */

/**
 * GET /api/menu — menu grouped by category. The public view hides inactive and
 * empty categories (US2.2); staff pass ?scope=manage to see everything.
 */
router.get('/', (req, res) => {
  const manage = req.query.scope === 'manage' && isStaff(req);
  const menu = categories
    .slice()
    .sort((a, b) => a.sort - b.sort)
    .map((c) => {
      const items = menuItems.filter((m) => m.categoryId === c.id).map((m) => serializeItem(m, manage));
      return { ...c, itemCount: items.length, items };
    })
    .filter((c) => manage || (c.active && c.items.length > 0));
  res.json({ menu, tags: cuisineTagList, allergens: allergenList });
});

/** GET /api/menu/items — flat item list. */
router.get('/items', (req, res) => {
  const withRecipe = isStaff(req);
  res.json({ items: menuItems.map((m) => serializeItem(m, withRecipe)) });
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

  if (!String(name || '').trim() || !categoryId || price === undefined || price === '') {
    return res.status(400).json({ error: 'Name, category and price are required.' });
  }
  if (!(Number(price) >= 0)) return res.status(400).json({ error: 'Price must be zero or more.' });
  if (!categories.some((c) => c.id === categoryId)) {
    return res.status(400).json({ error: 'Unknown category.' });
  }
  const normalized = normalizeModifiers(modifiers);
  if (normalized.error) return res.status(400).json({ error: normalized.error });

  const item = {
    id: nextId('mi'),
    name: String(name).trim(),
    categoryId,
    price: Number(price),
    description: String(description),
    dietaryTags: Array.isArray(dietaryTags) ? dietaryTags : [],
    allergens: Array.isArray(allergens) ? allergens : [],
    modifiers: normalized.modifiers,
    recipe: [],
    available: Boolean(available),
    outOfStockReason: available ? '' : String(outOfStockReason || ''),
    createdAt: new Date().toISOString(),
  };
  menuItems.push(item);
  return res.status(201).json({ item: serializeItem(item, true) });
});

/** PATCH /api/menu/items/:id — update an item; chefs may only change availability. */
router.patch('/items/:id', editItems, (req, res) => {
  const item = menuItems.find((m) => m.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Menu item not found.' });

  const body = req.body || {};
  if (req.user.role === 'chef' && Object.keys(body).some((k) => !AVAILABILITY_FIELDS.includes(k))) {
    return res.status(403).json({ error: 'Chefs can only change item availability.' });
  }

  const { name, categoryId, price, description, dietaryTags, allergens, modifiers, available, outOfStockReason } = body;

  if (name !== undefined) {
    if (!String(name).trim()) return res.status(400).json({ error: 'Name cannot be empty.' });
    item.name = String(name).trim();
  }
  if (categoryId !== undefined) {
    if (!categories.some((c) => c.id === categoryId)) return res.status(400).json({ error: 'Unknown category.' });
    item.categoryId = categoryId;
  }
  if (price !== undefined) {
    if (!(Number(price) >= 0)) return res.status(400).json({ error: 'Price must be zero or more.' });
    item.price = Number(price);
  }
  if (description !== undefined) item.description = String(description);
  if (dietaryTags !== undefined) item.dietaryTags = Array.isArray(dietaryTags) ? dietaryTags : item.dietaryTags;
  if (allergens !== undefined) item.allergens = Array.isArray(allergens) ? allergens : item.allergens;
  if (modifiers !== undefined) {
    const normalized = normalizeModifiers(modifiers);
    if (normalized.error) return res.status(400).json({ error: normalized.error });
    item.modifiers = normalized.modifiers;
  }
  if (available !== undefined) {
    item.available = Boolean(available);
    item.outOfStockReason = item.available ? '' : String(outOfStockReason || item.outOfStockReason || '');
  } else if (outOfStockReason !== undefined) {
    item.outOfStockReason = String(outOfStockReason);
  }

  return res.json({ item: serializeItem(item, true) });
});

/** PUT /api/menu/items/:id/recipe — define the dish's ingredients (bill of materials, US8.2). */
router.put('/items/:id/recipe', manageMenu, (req, res) => {
  const item = menuItems.find((m) => m.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Menu item not found.' });

  const lines = Array.isArray(req.body?.recipe) ? req.body.recipe : null;
  if (!lines) return res.status(400).json({ error: 'recipe must be a list of { inventoryId, qty }.' });

  const recipe = [];
  for (const line of lines) {
    if (!inventory.some((i) => i.id === line?.inventoryId)) {
      return res.status(400).json({ error: 'Unknown ingredient in recipe.' });
    }
    const qty = Number(line.qty);
    if (!(qty > 0)) return res.status(400).json({ error: 'Each ingredient quantity must be greater than zero.' });
    if (recipe.some((r) => r.inventoryId === line.inventoryId)) {
      return res.status(400).json({ error: 'Each ingredient can appear only once in a recipe.' });
    }
    recipe.push({ inventoryId: line.inventoryId, qty });
  }
  item.recipe = recipe;
  return res.json({ item: serializeItem(item, true) });
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
  res.json({
    categories: categories
      .slice()
      .sort((a, b) => a.sort - b.sort)
      .map((c) => ({ ...c, itemCount: menuItems.filter((m) => m.categoryId === c.id).length })),
  });
});

/** POST /api/menu/categories — create a category. */
router.post('/categories', manageMenu, (req, res) => {
  const { name, sort = categories.length + 1 } = req.body || {};
  const clean = String(name || '').trim();
  if (!clean) return res.status(400).json({ error: 'Category name is required.' });
  if (categories.some((c) => c.name.toLowerCase() === clean.toLowerCase())) {
    return res.status(409).json({ error: 'A category with that name already exists.' });
  }
  const category = { id: nextId('cat'), name: clean, sort: Number(sort) || categories.length + 1, active: true };
  categories.push(category);
  return res.status(201).json({ category: { ...category, itemCount: 0 } });
});

/** PATCH /api/menu/categories/:id */
router.patch('/categories/:id', manageMenu, (req, res) => {
  const category = categories.find((c) => c.id === req.params.id);
  if (!category) return res.status(404).json({ error: 'Category not found.' });
  const { name, sort, active } = req.body || {};
  if (name !== undefined) {
    const clean = String(name).trim();
    if (!clean) return res.status(400).json({ error: 'Category name is required.' });
    if (categories.some((c) => c.id !== category.id && c.name.toLowerCase() === clean.toLowerCase())) {
      return res.status(409).json({ error: 'A category with that name already exists.' });
    }
    category.name = clean;
  }
  if (sort !== undefined) category.sort = Number(sort);
  if (active !== undefined) category.active = Boolean(active);
  return res.json({
    category: { ...category, itemCount: menuItems.filter((m) => m.categoryId === category.id).length },
  });
});

/** DELETE /api/menu/categories/:id */
router.delete('/categories/:id', manageMenu, (req, res) => {
  const idx = categories.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Category not found.' });
  if (menuItems.some((m) => m.categoryId === req.params.id)) {
    return res.status(409).json({ error: 'Cannot delete a category that still has items.' });
  }
  const [removed] = categories.splice(idx, 1);
  return res.json({ deleted: true, id: removed.id });
});

export default router;

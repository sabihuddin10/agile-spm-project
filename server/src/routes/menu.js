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
import { text, number, bool, stringList, list } from '../lib/validate.js';

const router = Router();

// US2.1: Manager/Admin add, edit and remove items and categories.
// US2.5: Chefs may additionally toggle availability (out of stock).
const manageMenu = requireRole('manager', 'admin');
const editItems = requireRole('chef', 'manager', 'admin');
const AVAILABILITY_FIELDS = ['available', 'outOfStockReason'];
const MAX_PRICE = 10000;
const ITEM_NAME_MAX = 80;
const DESCRIPTION_MAX = 500;
const REASON_MAX = 200;
const TAG_LIMITS = { maxItems: 20, maxLength: 40 };

const isStaff = (req) => Boolean(req.user && STAFF_ROLES.includes(req.user.role));
// Recipes (ingredients and quantities) are kitchen and management information.
const canSeeRecipes = (req) => Boolean(req.user && ['chef', 'manager', 'admin'].includes(req.user.role));

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
  if (raw.length > 20) return { error: 'An item can have at most 20 modifier groups.' };
  const modifiers = [];
  for (const g of raw) {
    if (g === null || typeof g !== 'object' || Array.isArray(g)) return { error: 'Each modifier group must be an object.' };
    const name = text(g.name ?? '', 'Modifier group name', { max: 60 });
    if (!name) continue;
    const rawOptions = list(g.options, `Options for "${name}"`, { maxItems: 30 }) ?? [];
    const options = rawOptions
      .map((o) => {
        if (typeof o === 'string') {
          const match = text(o, 'Modifier option', { max: 80 }).match(/^(.*?)(?:\s*\+\s*\$?(\d+(?:\.\d+)?))?$/);
          return { label: match[1].trim(), priceDelta: match[2] ? Number(match[2]) : 0 };
        }
        if (o === null || typeof o !== 'object') return { label: '' };
        const label = text(o.label ?? '', 'Modifier option', { max: 60 });
        const delta = o.priceDelta === undefined || o.priceDelta === '' ? 0 : number(o.priceDelta, 'Modifier price change', { min: -MAX_PRICE, max: MAX_PRICE });
        return { label, priceDelta: delta };
      })
      .filter((o) => o.label);
    if (options.length === 0) return { error: `Modifier group "${name}" needs at least one option.` };
    if (options.some((o) => o.priceDelta < 0)) return { error: 'Modifier price changes cannot be negative.' };
    const groupId = typeof g.id === 'string' && g.id && g.id.length <= 64 ? g.id : nextId('mod');
    modifiers.push({ id: groupId, name, type: g.type === 'multi' ? 'multi' : 'single', options });
  }
  return { modifiers };
}

/** The editable text/list fields of a menu item, validated (undefined when not sent). */
function readItemFields(body) {
  return {
    description: text(body.description, 'Description', { max: DESCRIPTION_MAX, multiline: true }),
    dietaryTags: stringList(body.dietaryTags, 'Dietary tags', TAG_LIMITS),
    allergens: stringList(body.allergens, 'Allergens', TAG_LIMITS),
    available: bool(body.available, 'available'),
    outOfStockReason: text(body.outOfStockReason, 'Out-of-stock reason', { max: REASON_MAX }),
  };
}

const readPrice = (value) => number(value, 'Price', { min: 0, max: MAX_PRICE, message: `Price must be between 0 and ${MAX_PRICE}.` });

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
      const items = menuItems.filter((m) => m.categoryId === c.id).map((m) => serializeItem(m, manage && canSeeRecipes(req)));
      return { ...c, itemCount: items.length, items };
    })
    .filter((c) => manage || (c.active && c.items.length > 0));
  res.json({ menu, tags: cuisineTagList, allergens: allergenList });
});

/** GET /api/menu/items — flat item list. */
router.get('/items', (req, res) => {
  const withRecipe = canSeeRecipes(req);
  res.json({ items: menuItems.map((m) => serializeItem(m, withRecipe)) });
});

/** POST /api/menu/items — create a menu item. */
router.post('/items', manageMenu, (req, res) => {
  const body = req.body || {};
  const { categoryId, price, modifiers = [] } = body;

  if (typeof body.name !== 'string' || !body.name.trim() || !categoryId || price === undefined || price === null || price === '') {
    return res.status(400).json({ error: 'Name, category and price are required.' });
  }
  const name = text(body.name, 'Name', { required: true, max: ITEM_NAME_MAX });
  if (typeof price === 'number' && price < 0) return res.status(400).json({ error: 'Price must be zero or more.' });
  const cleanPrice = readPrice(price);
  const fields = readItemFields(body);
  const available = fields.available ?? true;
  if (!categories.some((c) => c.id === categoryId)) {
    return res.status(400).json({ error: 'Unknown category.' });
  }
  const normalized = normalizeModifiers(modifiers);
  if (normalized.error) return res.status(400).json({ error: normalized.error });

  const item = {
    id: nextId('mi'),
    name,
    categoryId,
    price: cleanPrice,
    description: fields.description ?? '',
    dietaryTags: fields.dietaryTags ?? [],
    allergens: fields.allergens ?? [],
    modifiers: normalized.modifiers,
    recipe: [],
    available,
    outOfStockReason: available ? '' : fields.outOfStockReason ?? '',
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

  const { categoryId, price, modifiers } = body;

  // Validate everything first so a rejected request changes nothing.
  if (body.name !== undefined && (typeof body.name !== 'string' || !body.name.trim())) {
    return res.status(400).json({ error: 'Name cannot be empty.' });
  }
  const name = text(body.name, 'Name', { max: ITEM_NAME_MAX });
  if (categoryId !== undefined && !categories.some((c) => c.id === categoryId)) {
    return res.status(400).json({ error: 'Unknown category.' });
  }
  if (typeof price === 'number' && price < 0) return res.status(400).json({ error: 'Price must be zero or more.' });
  const cleanPrice = readPrice(price);
  const { description, dietaryTags, allergens, available, outOfStockReason } = readItemFields(body);
  const normalized = modifiers === undefined ? null : normalizeModifiers(modifiers);
  if (normalized?.error) return res.status(400).json({ error: normalized.error });

  if (name !== undefined) item.name = name;
  if (categoryId !== undefined) item.categoryId = categoryId;
  if (cleanPrice !== undefined) item.price = cleanPrice;
  if (description !== undefined) item.description = description;
  if (dietaryTags !== undefined) item.dietaryTags = dietaryTags;
  if (allergens !== undefined) item.allergens = allergens;
  if (normalized) item.modifiers = normalized.modifiers;
  if (available !== undefined) {
    item.available = available;
    item.outOfStockReason = item.available ? '' : outOfStockReason || item.outOfStockReason || '';
  } else if (outOfStockReason !== undefined) {
    item.outOfStockReason = outOfStockReason;
  }

  return res.json({ item: serializeItem(item, true) });
});

/** PUT /api/menu/items/:id/recipe — define the dish's ingredients (bill of materials, US8.2). */
router.put('/items/:id/recipe', manageMenu, (req, res) => {
  const item = menuItems.find((m) => m.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Menu item not found.' });

  const lines = Array.isArray(req.body?.recipe) ? req.body.recipe : null;
  if (!lines) return res.status(400).json({ error: 'recipe must be a list of { inventoryId, qty }.' });
  if (lines.length > 50) return res.status(400).json({ error: 'A recipe can have at most 50 ingredients.' });

  const recipe = [];
  for (const line of lines) {
    if (!inventory.some((i) => i.id === line?.inventoryId)) {
      return res.status(400).json({ error: 'Unknown ingredient in recipe.' });
    }
    const qty = typeof line.qty === 'number' || (typeof line.qty === 'string' && line.qty.trim()) ? Number(line.qty) : NaN;
    if (!(qty > 0 && qty <= 100000)) return res.status(400).json({ error: 'Each ingredient quantity must be greater than zero.' });
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
  const { name, sort } = req.body || {};
  const clean = typeof name === 'string' ? name.trim() : '';
  if (!clean) return res.status(400).json({ error: 'Category name is required.' });
  text(clean, 'Category name', { max: 60 });
  const sortValue = number(sort ?? undefined, 'Sort order', { min: -100000, max: 100000, message: 'Sort order must be a number.' });
  if (categories.some((c) => c.name.toLowerCase() === clean.toLowerCase())) {
    return res.status(409).json({ error: 'A category with that name already exists.' });
  }
  const category = { id: nextId('cat'), name: clean, sort: sortValue || categories.length + 1, active: true };
  categories.push(category);
  return res.status(201).json({ category: { ...category, itemCount: 0 } });
});

/** PATCH /api/menu/categories/:id */
router.patch('/categories/:id', manageMenu, (req, res) => {
  const category = categories.find((c) => c.id === req.params.id);
  if (!category) return res.status(404).json({ error: 'Category not found.' });
  const { name, sort } = req.body || {};
  // Validate before changing anything, so a rejected request saves nothing.
  const sortValue = number(sort, 'Sort order', { min: -100000, max: 100000, message: 'Sort order must be a number.' });
  const active = bool(req.body?.active, 'active');
  if (name !== undefined) {
    const clean = typeof name === 'string' ? name.trim() : '';
    if (!clean) return res.status(400).json({ error: 'Category name is required.' });
    text(clean, 'Category name', { max: 60 });
    if (categories.some((c) => c.id !== category.id && c.name.toLowerCase() === clean.toLowerCase())) {
      return res.status(409).json({ error: 'A category with that name already exists.' });
    }
    category.name = clean;
  }
  if (sortValue !== undefined) category.sort = sortValue;
  if (active !== undefined) category.active = active;
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

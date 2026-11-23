/** menu_categories, inventory_items, menu_items, recipe_lines. */
import { num, ref, byParent } from './sql.js';

export function save(s, ids) {
  let line = 0;
  return [
    ['menu_categories', 'id bigint, ext_id text, name text, sort integer, active boolean',
      s.categories.map((c, i) => ({ id: i + 1, ext_id: c.id, name: c.name, sort: c.sort, active: c.active }))],
    ['inventory_items', 'id bigint, ext_id text, name text, category text, stock numeric, unit text, reorder_level numeric, cost_per_unit numeric, supplier text',
      s.inventory.map((v, i) => ({
        id: i + 1, ext_id: v.id, name: v.name, category: v.category, stock: v.stock, unit: v.unit,
        reorder_level: v.reorderLevel, cost_per_unit: v.costPerUnit, supplier: v.supplier,
      }))],
    ['menu_items', 'id bigint, ext_id text, category_id bigint, name text, price numeric, description text, dietary_tags text[], allergens text[], modifiers jsonb, available boolean, out_of_stock_reason text',
      s.menuItems.map((m, i) => ({
        id: i + 1, ext_id: m.id, category_id: ref(ids.categories, m.categoryId), name: m.name, price: m.price,
        description: m.description, dietary_tags: m.dietaryTags, allergens: m.allergens, modifiers: m.modifiers,
        available: m.available, out_of_stock_reason: m.outOfStockReason,
      }))],
    ['recipe_lines', 'id bigint, menu_item_id bigint, inventory_id bigint, qty numeric',
      s.menuItems.flatMap((m, i) => m.recipe.map((l) => ({
        id: ++line, menu_item_id: i + 1, inventory_id: ref(ids.inventory, l.inventoryId), qty: l.qty,
      })))],
  ];
}

export function load(r, x) {
  const recipeOf = byParent(r.recipe_lines, 'menu_item_id');
  return {
    categories: r.menu_categories.map((c) => ({ id: c.ext_id, name: c.name, sort: c.sort, active: c.active })),
    inventory: r.inventory_items.map((v) => ({
      id: v.ext_id, name: v.name, category: v.category, stock: num(v.stock), unit: v.unit,
      reorderLevel: num(v.reorder_level), costPerUnit: num(v.cost_per_unit), supplier: v.supplier,
    })),
    menuItems: r.menu_items.map((m) => ({
      id: m.ext_id, description: m.description, dietaryTags: m.dietary_tags, allergens: m.allergens,
      modifiers: m.modifiers, recipe: recipeOf(m.id).map((l) => ({ inventoryId: ref(x.inventory, l.inventory_id), qty: num(l.qty) })),
      available: m.available, outOfStockReason: m.out_of_stock_reason, name: m.name,
      categoryId: ref(x.categories, m.category_id), price: num(m.price),
    })),
  };
}

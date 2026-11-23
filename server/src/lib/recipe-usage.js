/**
 * Which menu items use each ingredient. The inventory list needs this for every ingredient; computing it by
 * scanning every menu item and every recipe line for each ingredient is O(ingredients x items x lines).
 * Built once per request, it is O(items x lines), and a lookup is O(1).
 */

/**
 * ingredient id -> names of the menu items whose recipe uses it, in menu order, each item at most once even
 * when its recipe lists the ingredient twice.
 * @param {{ name: string, recipe: { inventoryId: string }[] }[]} menuItems
 * @returns {Map<string, string[]>}
 */
export function recipeUsage(menuItems) {
  const usage = new Map();
  for (const item of menuItems) {
    const seen = new Set();
    for (const line of item.recipe) {
      if (seen.has(line.inventoryId)) continue;
      seen.add(line.inventoryId);
      const names = usage.get(line.inventoryId);
      if (names) names.push(item.name);
      else usage.set(line.inventoryId, [item.name]);
    }
  }
  return usage;
}

/** The menu items (not just names) that use an ingredient, in menu order. */
export function itemsUsing(menuItems, inventoryId) {
  return menuItems.filter((m) => m.recipe.some((r) => r.inventoryId === inventoryId));
}

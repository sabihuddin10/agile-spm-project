/** Recipe usage — lib/recipe-usage.js: which menu items use each ingredient. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { itemsUsing, recipeUsage } from '../../src/lib/recipe-usage.js';

/** Small deterministic random numbers, so a failure can be reproduced from its seed. */
function rng(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The original way: scan every menu item and every recipe line for each ingredient. */
const naiveUsedBy = (menuItems, inventoryId) => menuItems.filter((m) => m.recipe.some((r) => r.inventoryId === inventoryId)).map((m) => m.name);

test('lists the menu items using each ingredient, in menu order, once each', () => {
  // Arrange
  const menu = [
    { name: 'Salad', recipe: [{ inventoryId: 'inv_lettuce' }, { inventoryId: 'inv_oil' }] },
    { name: 'Fries', recipe: [{ inventoryId: 'inv_potato' }, { inventoryId: 'inv_oil' }, { inventoryId: 'inv_oil' }] },
    { name: 'Water', recipe: [] },
  ];

  // Act
  const usage = recipeUsage(menu);

  // Assert
  assert.deepEqual(usage.get('inv_oil'), ['Salad', 'Fries'], 'a recipe listing an ingredient twice counts once');
  assert.deepEqual(usage.get('inv_lettuce'), ['Salad']);
  assert.equal(usage.get('inv_unused'), undefined);
  assert.deepEqual(itemsUsing(menu, 'inv_oil').map((m) => m.name), ['Salad', 'Fries']);
  assert.deepEqual(itemsUsing(menu, 'inv_unused'), []);
});

test('gives the same answer as scanning for each ingredient, on 25 random menus', () => {
  for (let seed = 1; seed <= 25; seed += 1) {
    // Arrange
    const random = rng(seed);
    const ingredients = Array.from({ length: 12 }, (_, i) => `inv_${i}`);
    const menu = Array.from({ length: 1 + Math.floor(random() * 30) }, (_, i) => ({
      name: `Dish ${i}`,
      recipe: Array.from({ length: Math.floor(random() * 6) }, () => ({ inventoryId: ingredients[Math.floor(random() * ingredients.length)] })),
    }));

    // Act
    const usage = recipeUsage(menu);

    // Assert
    for (const id of ingredients) assert.deepEqual(usage.get(id) ?? [], naiveUsedBy(menu, id), `seed ${seed}, ${id}`);
  }
});

test('building the index reads each recipe line once, where scanning per ingredient reads them all again', () => {
  // Arrange: count reads of `inventoryId` across 40 ingredients and 200 dishes of 5 lines
  let reads = 0;
  const line = (id) => ({ get inventoryId() { reads += 1; return id; } });
  const menu = Array.from({ length: 200 }, (_, i) => ({ name: `Dish ${i}`, recipe: Array.from({ length: 5 }, (_, j) => line(`inv_${(i + j) % 40}`)) }));
  const ids = Array.from({ length: 40 }, (_, i) => `inv_${i}`);

  // Act
  reads = 0;
  recipeUsage(menu);
  const indexed = reads;
  reads = 0;
  for (const id of ids) naiveUsedBy(menu, id);
  const scanned = reads;

  // Assert
  assert.ok(indexed <= 200 * 5 * 4, `the index read ${indexed} times: a small constant number per recipe line`);
  assert.ok(scanned > indexed * 4, `scanning read ${scanned} times against ${indexed} for the index`);
});

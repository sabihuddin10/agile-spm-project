/**
 * Small collection helpers for turning "search the whole list for every item" (O(n x m)) into "build a map
 * once, then look up" (O(n + m)). All of them keep the original order: a group lists its items in the order
 * they appeared in the input, and a Map iterates in first-seen key order.
 */

/** key -> items with that key, in input order. */
export function groupBy(list, keyOf) {
  const groups = new Map();
  for (const item of list) {
    const key = keyOf(item);
    const bucket = groups.get(key);
    if (bucket) bucket.push(item);
    else groups.set(key, [item]);
  }
  return groups;
}

/** key -> the FIRST item with that key (what Array.find would return). */
export function indexBy(list, keyOf) {
  const index = new Map();
  for (const item of list) {
    const key = keyOf(item);
    if (!index.has(key)) index.set(key, item);
  }
  return index;
}

/** key -> how many items have that key. */
export function countBy(list, keyOf) {
  const counts = new Map();
  for (const item of list) {
    const key = keyOf(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/** The items for `key`, or an empty list: lets callers skip the "might be missing" check. */
export function itemsFor(groups, key) {
  return groups.get(key) ?? [];
}

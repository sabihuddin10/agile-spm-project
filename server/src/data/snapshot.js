/**
 * Whole-store snapshot for persistence.
 *
 * `snapshot()` copies every mutable part of the in-memory store into plain
 * JSON; `restore()` writes a snapshot back in place (array contents and object
 * keys) so the references the route modules imported stay valid.
 */
import {
  counters, settings, orderSeq,
  users, customers, inventory, stockMovements, purchaseOrders, categories,
  menuItems, tables, orders, reservations, applications, shifts, notifications,
} from './store.js';

const COLLECTIONS = {
  users, customers, inventory, stockMovements, purchaseOrders, categories,
  menuItems, tables, orders, reservations, applications, shifts, notifications,
};
const OBJECTS = { counters, settings, orderSeq };

export function snapshot() {
  return JSON.parse(JSON.stringify({ ...COLLECTIONS, ...OBJECTS }));
}

export function restore(data) {
  const copy = JSON.parse(JSON.stringify(data));
  for (const [name, list] of Object.entries(COLLECTIONS)) {
    list.length = 0;
    for (const item of copy[name] ?? []) list.push(item);
  }
  for (const [name, target] of Object.entries(OBJECTS)) {
    for (const key of Object.keys(target)) delete target[key];
    Object.assign(target, copy[name] ?? {});
  }
}

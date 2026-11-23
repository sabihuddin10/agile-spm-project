/**
 * The collection of user accounts, behind one object instead of a bare array that eight files reach into.
 *
 * Lookups by id and by email are O(1) once warm, which matters because every authenticated request looks
 * its user up by id. The indexes are a *verified* cache, not a second source of truth: the array stays the
 * truth, and a cached answer is used only after checking it is still the object at its recorded position
 * (and, for an email, still has that email). Anything else falls back to a scan, which also refreshes the
 * index. That makes the directory safe against everything that changes the array behind its back:
 * `restore()` replaces every user object on each reload, handlers edit `user.email` in place, and accounts
 * are added or removed directly.
 */

const normalizeEmail = (email) => String(email ?? '').toLowerCase().trim();

export class UserDirectory {
  #list;
  /** id -> { user, position } */
  #byId = new Map();
  /** normalised email -> { user, position } */
  #byEmail = new Map();

  /** @param {object[]} list the live users array (it is read, and changed by add/remove, in place) */
  constructor(list) {
    this.#list = list;
  }

  /** The live array, for code that still needs to iterate every account (reports, persistence). */
  get all() {
    return this.#list;
  }

  get size() {
    return this.#list.length;
  }

  byId(id) {
    const hit = this.#byId.get(id);
    if (hit && this.#list[hit.position] === hit.user && hit.user.id === id) return hit.user;
    return this.#scan((u) => u.id === id);
  }

  byEmail(email) {
    const key = normalizeEmail(email);
    const hit = this.#byEmail.get(key);
    if (hit && this.#list[hit.position] === hit.user && normalizeEmail(hit.user.email) === key) return hit.user;
    return this.#scan((u) => normalizeEmail(u.email) === key);
  }

  /** True when another account (not `exceptId`) already uses this email. */
  emailTaken(email, exceptId = null) {
    const owner = this.byEmail(email);
    return Boolean(owner && owner.id !== exceptId);
  }

  /** The account's display name, or `fallback` for an unknown or removed account. */
  nameOf(id, fallback = null) {
    return this.byId(id)?.name ?? fallback;
  }

  add(user) {
    this.#list.push(user);
    this.#index(user, this.#list.length - 1);
    return user;
  }

  /** Remove an account; returns the removed user, or undefined when there is no such account. */
  remove(id) {
    const position = this.#list.findIndex((u) => u.id === id);
    if (position === -1) return undefined;
    const [removed] = this.#list.splice(position, 1);
    // Positions after the removed one moved, so the cached ones are no longer trustworthy.
    this.#byId.clear();
    this.#byEmail.clear();
    return removed;
  }

  #scan(test) {
    for (let position = 0; position < this.#list.length; position += 1) {
      if (test(this.#list[position])) {
        this.#index(this.#list[position], position);
        return this.#list[position];
      }
    }
    return undefined;
  }

  #index(user, position) {
    // Emails edited in place leave stale keys behind (they fail verification); keep the maps from growing.
    if (this.#byEmail.size > this.#list.length * 2 + 16) this.#byEmail.clear();
    if (this.#byId.size > this.#list.length * 2 + 16) this.#byId.clear();
    this.#byId.set(user.id, { user, position });
    this.#byEmail.set(normalizeEmail(user.email), { user, position });
  }
}

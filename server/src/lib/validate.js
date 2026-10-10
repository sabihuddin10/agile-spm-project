/**
 * Request-body type checks shared by the route modules.
 *
 * Each reader takes a raw value from req.body and either returns a clean value
 * (trimmed string, finite number, real boolean …) or throws a BadRequest, which
 * the app's error handler turns into `400 { error }`. Express 4 forwards errors
 * thrown by synchronous handlers, so a route can read every field up front and
 * only then change the store.
 *
 * `undefined` (and `null`) mean "not sent": optional readers return undefined so
 * PATCH handlers can leave the field alone.
 */

export class BadRequest extends Error {
  constructor(message) {
    super(message);
    this.name = 'BadRequest';
    this.status = 400;
    this.expose = true;
  }
}

export function badRequest(message) {
  throw new BadRequest(message);
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const EMAIL_MAX = 254;
export const NAME_MAX = 80;
export const PHONE_MAX = 30;
export const PHONE_RE = /^[0-9+()\-.\s]*$/;
export const ID_MAX = 64;

/** C0 controls and DEL; multi-line text may still contain tab, newline and carriage return. */
const CONTROL_SINGLE = /[\u0000-\u001F\u007F]/;
const CONTROL_MULTI = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

const missing = (value) => value === undefined || value === null;

/**
 * A string field. Options: required, max (characters, default 200), multiline
 * (allow line breaks), trim (default true).
 */
export function text(value, label, { required = false, max = 200, multiline = false, trim = true } = {}) {
  if (missing(value)) {
    if (required) badRequest(`${label} is required.`);
    return undefined;
  }
  if (typeof value !== 'string') badRequest(`${label} must be text.`);
  const clean = trim ? value.trim() : value;
  if (required && !clean) badRequest(`${label} is required.`);
  if (clean.length > max) badRequest(`${label} must be at most ${max} characters.`);
  if ((multiline ? CONTROL_MULTI : CONTROL_SINGLE).test(clean)) badRequest(`${label} contains characters that aren't allowed.`);
  return clean;
}

/** A person's name: 1–80 characters on one line. */
export function personName(value, label = 'Name', { required = true } = {}) {
  return text(value, label, { required, max: NAME_MAX });
}

/** An email address, lower-cased. Optional emails may be empty (''). */
export function email(value, { required = true, label = 'Email' } = {}) {
  const clean = text(value, label, { required, max: EMAIL_MAX });
  if (clean === undefined || (!required && clean === '')) return clean;
  if (!EMAIL_RE.test(clean)) badRequest('Please enter a valid email address.');
  return clean.toLowerCase();
}

/** A phone number: digits, spaces, + ( ) - . with 7–20 digits. Empty is allowed. */
export function phone(value, label = 'Phone') {
  if (missing(value)) return undefined;
  if (typeof value !== 'string') badRequest('Please enter a valid phone number.');
  const clean = value.trim();
  if (!clean) return '';
  const digits = clean.replace(/\D/g, '').length;
  if (clean.length > PHONE_MAX || !PHONE_RE.test(clean) || digits < 7 || digits > 20) {
    badRequest(`Please enter a valid ${label.toLowerCase()} number.`);
  }
  return clean;
}

/**
 * A number, sent as a JSON number or a numeric string. Rejects booleans, null,
 * '', arrays, NaN and ±Infinity. Options: required, min, max, integer, message.
 */
export function number(value, label, { required = false, min = -Infinity, max = Infinity, integer = false, message } = {}) {
  // null is a wrong type here, not "not sent": Number(null) is 0 and would silently zero a value.
  if (value === undefined) {
    if (required) badRequest(message ?? `${label} is required.`);
    return undefined;
  }
  const parsed = typeof value === 'number' || (typeof value === 'string' && value.trim() !== '') ? Number(value) : NaN;
  const ok = Number.isFinite(parsed) && parsed >= min && parsed <= max && (!integer || Number.isInteger(parsed));
  if (!ok) {
    if (message) badRequest(message);
    const kind = integer ? 'a whole number' : 'a number';
    if (Number.isFinite(min) && Number.isFinite(max)) badRequest(`${label} must be ${kind} between ${min} and ${max}.`);
    if (Number.isFinite(min)) badRequest(`${label} must be ${kind} of at least ${min}.`);
    badRequest(`${label} must be ${kind}.`);
  }
  return parsed;
}

/** A real JSON boolean (the string "false" is not accepted). */
export function bool(value, label) {
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') badRequest(`${label} must be true or false.`);
  return value;
}

/** One of a fixed set of strings. */
export function oneOf(value, label, allowed, { required = false, message } = {}) {
  if (value === undefined) {
    if (required) badRequest(message ?? `${label} is required.`);
    return undefined;
  }
  if (typeof value !== 'string' || !allowed.includes(value)) {
    badRequest(message ?? `${label} must be one of: ${allowed.join(', ')}.`);
  }
  return value;
}

/** A record id (string, at most 64 characters). Empty string / null → null when `nullable`. */
export function id(value, label, { required = false, nullable = false } = {}) {
  if (value === undefined) {
    if (required) badRequest(`${label} is required.`);
    return undefined;
  }
  if (nullable && (value === null || value === '')) return null;
  if (typeof value !== 'string' || !value || value.length > ID_MAX) badRequest(`${label} must be a valid id.`);
  return value;
}

/** A list of short strings (trimmed, empty entries dropped). */
export function stringList(value, label, { maxItems = 30, maxLength = 40, lower = false } = {}) {
  if (missing(value)) return undefined;
  if (!Array.isArray(value)) badRequest(`${label} must be a list.`);
  if (value.length > maxItems) badRequest(`${label} can have at most ${maxItems} entries.`);
  const out = [];
  for (const entry of value) {
    if (typeof entry !== 'string') badRequest(`${label} must be a list of text values.`);
    const clean = lower ? entry.trim().toLowerCase() : entry.trim();
    if (clean.length > maxLength) badRequest(`Each ${label.toLowerCase()} entry must be at most ${maxLength} characters.`);
    if (CONTROL_SINGLE.test(clean)) badRequest(`${label} contains characters that aren't allowed.`);
    if (clean && !out.includes(clean)) out.push(clean);
  }
  return out;
}

/** A list (array) with at most `maxItems` entries. */
export function list(value, label, { maxItems = 100, required = false } = {}) {
  if (missing(value)) {
    if (required) badRequest(`${label} must be a list.`);
    return undefined;
  }
  if (!Array.isArray(value)) badRequest(`${label} must be a list.`);
  if (value.length > maxItems) badRequest(`${label} can have at most ${maxItems} entries.`);
  return value;
}

export const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));

/** An optional nested object (e.g. preferences). */
export function object(value, label) {
  if (missing(value)) return undefined;
  if (!isPlainObject(value)) badRequest(`${label} must be an object.`);
  return value;
}

const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** True when a parsed JSON value contains a key that could pollute an object prototype. */
export function hasUnsafeKeys(value, depth = 0) {
  if (depth > 32 || value === null || typeof value !== 'object') return false;
  for (const key of Object.keys(value)) {
    if (UNSAFE_KEYS.has(key)) return true;
    if (hasUnsafeKeys(value[key], depth + 1)) return true;
  }
  return false;
}

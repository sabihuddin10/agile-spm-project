/** Shared helpers for the store ↔ table mappers. */

/** Timestamps: Postgres JSON carries an offset; the store keeps UTC ISO strings. */
export const iso = (v) => (v == null ? null : new Date(v).toISOString());
/** `time` columns come back as HH:MM:SS; the store keeps HH:MM. */
export const hm = (v) => (v == null ? null : String(v).slice(0, 5));
export const num = (v) => (v == null ? null : Number(v));

/** ext id → bigint id, where bigint id = array index + 1. */
export const idsOf = (list) => new Map(list.map((x, i) => [x.id, i + 1]));
/** bigint id → ext id, from loaded rows. */
export const extsOf = (rows) => new Map(rows.map((r) => [r.id, r.ext_id]));
export const ref = (map, key) => (key == null ? null : map.get(key) ?? null);

/** Group child rows by a foreign-key column. */
export function byParent(rows, column) {
  const groups = new Map();
  for (const r of rows) {
    if (!groups.has(r[column])) groups.set(r[column], []);
    groups.get(r[column]).push(r);
  }
  return (id) => groups.get(id) ?? [];
}

const IDENT = /^[a-z_][a-z0-9_]*$/;
const TYPE = /^[a-z_][a-z0-9_ ]*(\[\])?$/;

/** Table, column and type names are interpolated into SQL, so only plain identifiers are accepted. */
function identifier(name) {
  if (!IDENT.test(name)) throw new Error(`Not a plain SQL identifier: ${name}`);
  return name;
}

/** Parse 'id bigint, "start" time' into [{ name, type }], rejecting anything but identifiers. */
function columns(defs) {
  return defs.split(',').map((d) => {
    const [, name, type] = /^\s*"?([^"\s]+)"?\s+(.+?)\s*$/.exec(d) ?? [];
    if (!name || !TYPE.test(type ?? '')) throw new Error(`Not a plain SQL identifier: ${d.trim()}`);
    return { name: identifier(name), type };
  });
}

/**
 * Insert all rows in one statement. `defs` is the column list with types,
 * e.g. 'id bigint, name text'. Identity tables get their ids from the rows.
 */
export async function insertRows(db, table, defs, rows, { identity = true } = {}) {
  const list = columns(defs);
  identifier(table);
  if (!rows.length) return;
  const cols = list.map((c) => `"${c.name}"`).join(', ');
  const types = list.map((c) => `"${c.name}" ${c.type}`).join(', ');
  const overriding = identity ? 'OVERRIDING SYSTEM VALUE' : '';
  await db.query(
    `INSERT INTO ${table} (${cols}) ${overriding} SELECT ${cols} FROM jsonb_to_recordset($1::jsonb) AS x(${types})`,
    [JSON.stringify(rows)],
  );
}

/** All rows of a table as plain JSON objects, in `orderBy` order. */
export async function selectRows(db, table, orderBy = 'id') {
  identifier(table);
  identifier(orderBy);
  const { rows } = await db.query(`SELECT coalesce(json_agg(t ORDER BY ${orderBy}), '[]'::json) AS rows FROM ${table} t`);
  return rows[0].rows;
}

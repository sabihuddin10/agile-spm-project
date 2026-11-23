/** Apply the schema files in order. Every file is idempotent (IF NOT EXISTS). */
import { readFile } from 'node:fs/promises';

/** In order; each runs as its own transaction (004 adds an enum value that 005 then uses). */
export const SCHEMA_FILES = [
  '001_schema.sql',
  '003_store_fields.sql',
  '004_superadmin_role.sql',
  '005_one_superadmin.sql',
  '006_attendance_integrity.sql',
  '007_rate_limits.sql',
];
const dir = new URL('../../../schema/', import.meta.url);

export async function ensureSchema(db) {
  for (const file of SCHEMA_FILES) await db.query(await readFile(new URL(file, dir), 'utf8'));
}

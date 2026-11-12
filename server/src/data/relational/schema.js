/** Apply the schema files in order. Every file is idempotent (IF NOT EXISTS). */
import { readFile } from 'node:fs/promises';

const FILES = ['001_schema.sql', '003_store_fields.sql'];
const dir = new URL('../../../schema/', import.meta.url);

export async function ensureSchema(db) {
  for (const file of FILES) await db.query(await readFile(new URL(file, dir), 'utf8'));
}

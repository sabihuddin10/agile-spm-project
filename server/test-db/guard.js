/**
 * Every test-db file drops and recreates the `public` schema, and server/.env
 * may point at the production Neon database. Refuse anything but a throwaway
 * database before a single connection is opened.
 */
import 'dotenv/config';
import { isNeonUrl } from '../src/data/db.js';

export function requireTestDatabase() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required for the database tests.');
  if (isNeonUrl(url)) {
    throw new Error('Refusing to run the database tests against Neon: they drop the public schema. Point DATABASE_URL at a throwaway database.');
  }
  return url;
}

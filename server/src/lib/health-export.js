/** Where the web app's copies of the /api/health page live, and the catalogue snapshot format. */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCatalog } from './api-catalog.js';
import { SERVICE } from '../routes/health.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const webLib = path.resolve(here, '../../../frontend/src/lib/api-health');

export function exportPaths() {
  return {
    pageSource: path.join(here, 'health-page.js'),
    pageCopy: path.join(webLib, 'health-page.js'),
    catalogCopy: path.join(webLib, 'catalog.json'),
  };
}

export function catalogSnapshot(app) {
  return `${JSON.stringify({ service: SERVICE, endpoints: buildCatalog(app) }, null, 2)}\n`;
}

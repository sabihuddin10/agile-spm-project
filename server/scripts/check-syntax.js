/** Syntax-check every server source and test file (used by `npm run lint`). */
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : path.endsWith('.js') ? [path] : [];
  });
}

const all = [...files('src'), ...files('test'), ...files('scripts')];
for (const file of all) execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
console.log(`Syntax OK — ${all.length} files`);

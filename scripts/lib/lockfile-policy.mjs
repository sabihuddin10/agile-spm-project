/**
 * Lockfile policy (bolt 009). Pure functions; scripts/check-lockfiles.mjs does the I/O.
 *
 * pnpm-lock.yaml is the canonical lockfile for local work and CI. Two npm lockfiles are kept on
 * purpose: the Vercel projects deploy from `server/` and `frontend/` and install from them, so
 * they decide what production runs. The policy therefore is:
 *   1. no lockfile other than the three allowed ones is committed, and
 *   2. each npm lockfile matches its own package.json, so it cannot go stale unnoticed
 *      (the frontend one had drifted a whole major version behind its manifest), and
 *   3. the audit gate (audit-gate.mjs) audits all three.
 */

export const ALLOWED_LOCKFILES = ['pnpm-lock.yaml', 'frontend/package-lock.json', 'server/package-lock.json'];

const LOCKFILE_NAME = /(^|\/)(package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?)$/;

/** Tracked lockfiles that are not on the allow list. */
export function findUnexpectedLockfiles(trackedPaths) {
  return trackedPaths.filter((p) => LOCKFILE_NAME.test(p) && !ALLOWED_LOCKFILES.includes(p));
}

/** Allowed lockfiles that are missing from the repository. */
export function findMissingLockfiles(trackedPaths) {
  return ALLOWED_LOCKFILES.filter((p) => !trackedPaths.includes(p));
}

/**
 * Compares a package.json with the root entry of its package-lock.json.
 * Returns human-readable problems; empty means in sync.
 */
export function diffManifestAgainstLock(name, manifest, lock) {
  const root = lock?.packages?.[''];
  if (!root) return [`${name}: package-lock.json has no root entry; regenerate it`];
  const problems = [];
  for (const field of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    const wanted = manifest[field] ?? {};
    const locked = root[field] ?? {};
    for (const dep of new Set([...Object.keys(wanted), ...Object.keys(locked)])) {
      if (wanted[dep] === locked[dep]) continue;
      problems.push(`${name}: ${field}.${dep} is "${wanted[dep] ?? '(absent)'}" in package.json but "${locked[dep] ?? '(absent)'}" in package-lock.json`);
    }
  }
  return problems;
}

/**
 * Production advisory policy (bolt 009). Pure functions, no I/O: the CLI in scripts/audit-gate.mjs
 * feeds them real audit output, and scripts/audit-policy.test.mjs feeds them fixtures.
 *
 * Outcomes:
 *   pass            no unapproved high/critical finding
 *   policy-failure  an unapproved high/critical finding, or a malformed/expired exception
 *   infrastructure  an audit could not run or returned something unreadable. NEVER a pass:
 *                   a registry outage must not turn into a green build.
 */

export const BLOCKING_SEVERITIES = ['high', 'critical'];
/** An exception may not be dated further out than this, so none can quietly become permanent. */
export const MAX_EXCEPTION_DAYS = 90;
const DAY_MS = 86_400_000;

const GHSA = /GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}/i;

/** Advisory id: the GitHub advisory id when there is one (stable across pnpm and npm), else the numeric id. */
function advisoryId({ ghsa, url, id }) {
  return (ghsa ?? GHSA.exec(url ?? '')?.[0] ?? (id === undefined ? 'unknown' : String(id))).toUpperCase();
}

/**
 * pnpm: `pnpm audit --prod --json`. Returns { findings } or { outage: reason }.
 * A usable report has `metadata.vulnerabilities`; an error object or non-JSON text is an outage.
 */
export function parsePnpmAudit(stdout, source = 'pnpm') {
  const report = tryJson(stdout);
  if (!report) return { outage: `${source}: the audit did not return JSON` };
  if (report.error) return { outage: `${source}: ${describeError(report.error)}` };
  if (!report.metadata?.vulnerabilities || typeof report.advisories !== 'object') {
    return { outage: `${source}: the audit report has no vulnerability summary` };
  }
  const findings = Object.values(report.advisories ?? {}).map((a) => ({
    id: advisoryId({ ghsa: a.github_advisory_id, url: a.url, id: a.id }),
    package: a.module_name,
    severity: String(a.severity).toLowerCase(),
    title: a.title,
    source,
  }));
  return { findings };
}

/** npm: `npm audit --omit=dev --json`. Advisories are the object entries of each package's `via`. */
export function parseNpmAudit(stdout, source) {
  const report = tryJson(stdout);
  if (!report) return { outage: `${source}: the audit did not return JSON` };
  if (report.error) return { outage: `${source}: ${describeError(report.error)}` };
  if (!report.metadata?.vulnerabilities || typeof report.vulnerabilities !== 'object') {
    return { outage: `${source}: the audit report has no vulnerability summary` };
  }
  const findings = [];
  for (const vuln of Object.values(report.vulnerabilities ?? {})) {
    for (const via of vuln.via ?? []) {
      if (typeof via !== 'object') continue; // a string means "vulnerable through another package"
      findings.push({
        id: advisoryId({ url: via.url, id: via.source }),
        package: via.name,
        severity: String(via.severity).toLowerCase(),
        title: via.title,
        source,
      });
    }
  }
  return { findings };
}

function tryJson(text) {
  try {
    const value = JSON.parse(text);
    return value && typeof value === 'object' ? value : null;
  } catch {
    return null;
  }
}

function describeError(error) {
  if (typeof error === 'string') return error;
  return [error.code, error.summary ?? error.message].filter(Boolean).join(': ') || 'the audit service returned an error';
}

/**
 * Validates security/audit-exceptions.json. Returns { exceptions, problems }.
 * An exception needs an advisory id, a package, an owner, a real reason, and an expiry that is
 * in the future but no more than MAX_EXCEPTION_DAYS away. Expired ones are problems, not silently ignored.
 */
export function validateExceptions(file, now = new Date()) {
  const problems = [];
  const list = file?.exceptions;
  if (!Array.isArray(list)) return { exceptions: [], problems: ['security/audit-exceptions.json must contain an "exceptions" array'] };

  const exceptions = [];
  list.forEach((entry, i) => {
    const where = `exceptions[${i}]${entry?.advisory ? ` (${entry.advisory})` : ''}`;
    const bad = (why) => problems.push(`${where}: ${why}`);
    if (!entry || typeof entry !== 'object') return bad('must be an object');
    if (!GHSA.test(entry.advisory ?? '')) return bad('"advisory" must be a GitHub advisory id like GHSA-xxxx-xxxx-xxxx');
    if (!isText(entry.package)) return bad('"package" is required');
    if (!isText(entry.owner)) return bad('"owner" is required');
    if (!isText(entry.reason) || entry.reason.trim().length < 20) return bad('"reason" is required (at least 20 characters)');
    const expires = parseDay(entry.expires);
    if (!expires) return bad('"expires" must be a date like 2026-12-31');
    if (expires.getTime() < startOfDay(now).getTime()) return bad(`expired on ${entry.expires}: fix the finding or renew it with a new reason`);
    if (expires.getTime() - startOfDay(now).getTime() > MAX_EXCEPTION_DAYS * DAY_MS) {
      return bad(`"expires" is more than ${MAX_EXCEPTION_DAYS} days away`);
    }
    exceptions.push({ ...entry, advisory: entry.advisory.toUpperCase() });
  });
  return { exceptions, problems };
}

const isText = (v) => typeof v === 'string' && v.trim().length > 0;
const startOfDay = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
function parseDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Decides the outcome from the audit results (one per lockfile set) and the exceptions file.
 * `results` is a list of { findings } | { outage }. Returns { outcome, blocking, excepted, problems, outages, unusedExceptions }.
 */
export function evaluate({ results, exceptionsFile, now = new Date() }) {
  const outages = results.filter((r) => r.outage).map((r) => r.outage);
  const { exceptions, problems } = validateExceptions(exceptionsFile, now);

  const findings = results.flatMap((r) => r.findings ?? []).filter((f) => BLOCKING_SEVERITIES.includes(f.severity));
  const excepted = [];
  const blocking = [];
  for (const finding of findings) {
    const match = exceptions.find((e) => e.advisory === finding.id && e.package === finding.package);
    (match ? excepted : blocking).push(match ? { ...finding, exception: match } : finding);
  }
  const used = new Set(excepted.map((f) => f.exception.advisory));
  const unusedExceptions = exceptions.filter((e) => !used.has(e.advisory));

  let outcome = 'pass';
  if (blocking.length || problems.length) outcome = 'policy-failure';
  // An outage outranks everything: even with no visible findings, an unreadable audit is not a pass.
  if (outages.length) outcome = 'infrastructure';
  return { outcome, blocking, excepted, problems, outages, unusedExceptions };
}

export const EXIT_CODES = { pass: 0, 'policy-failure': 1, infrastructure: 2 };

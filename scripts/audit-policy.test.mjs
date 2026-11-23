/**
 * Tests for the production advisory policy and the lockfile policy (bolt 009).
 * Run with `pnpm run test:scripts`. Pure fixtures: no network, no registry.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EXIT_CODES, MAX_EXCEPTION_DAYS, evaluate, parseNpmAudit, parsePnpmAudit, validateExceptions,
} from './lib/audit-policy.mjs';
import { diffManifestAgainstLock, findMissingLockfiles, findUnexpectedLockfiles } from './lib/lockfile-policy.mjs';

const NOW = new Date('2026-11-17T12:00:00Z');
const GHSA = 'GHSA-AAAA-BBBB-CCCC'; // ids are normalised to upper case

const pnpmReport = (advisories = {}) => JSON.stringify({ advisories, metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0 } } });
const pnpmAdvisory = (over = {}) => ({ id: 1, github_advisory_id: GHSA, module_name: 'left-pad', severity: 'critical', title: 'Bad thing', ...over });
const npmReport = (vulnerabilities = {}) => JSON.stringify({ vulnerabilities, metadata: { vulnerabilities: { total: 0 } } });
const goodException = (over = {}) => ({
  advisory: GHSA, package: 'left-pad', owner: 'Zain', reason: 'Patched release is not published yet; tracked upstream.', expires: '2026-12-31', ...over,
});

// ---------------------------------------------------------------- parsing

test('a clean pnpm report has no findings', () => {
  // Arrange / Act
  const result = parsePnpmAudit(pnpmReport());

  // Assert
  assert.deepEqual(result, { findings: [] });
});

test('a pnpm advisory becomes a finding keyed by its GitHub advisory id', () => {
  // Arrange / Act
  const { findings } = parsePnpmAudit(pnpmReport({ 1: pnpmAdvisory() }));

  // Assert
  assert.deepEqual(findings[0], { id: GHSA, package: 'left-pad', severity: 'critical', title: 'Bad thing', source: 'pnpm' });
});

test('npm findings come from the advisory objects in "via"; plain-string via entries are skipped', () => {
  // Arrange
  const report = npmReport({
    'body-parser': { via: [{ source: 7, name: 'body-parser', severity: 'high', title: 'DoS', url: `https://github.com/advisories/${GHSA}` }] },
    express: { via: ['body-parser'] },
  });

  // Act
  const { findings } = parseNpmAudit(report, 'server/package-lock.json');

  // Assert
  assert.equal(findings.length, 1);
  assert.equal(findings[0].id, GHSA);
  assert.equal(findings[0].package, 'body-parser');
});

test('an audit that returns text, an error object, or no summary is an outage, not an empty result', () => {
  // Arrange
  const outputs = [
    'ERR_PNPM_AUDIT_BAD_RESPONSE The audit endpoint responded with 503',
    JSON.stringify({ error: { code: 'ENOTFOUND', summary: 'request to https://registry.npmjs.org failed' } }),
    JSON.stringify({ advisories: {} }), // valid JSON but no vulnerability summary
    '',
  ];

  for (const out of outputs) {
    // Act
    const pnpm = parsePnpmAudit(out);
    const npm = parseNpmAudit(out, 'frontend/package-lock.json');

    // Assert
    assert.ok(pnpm.outage, `pnpm should report an outage for: ${out.slice(0, 40)}`);
    assert.ok(npm.outage, `npm should report an outage for: ${out.slice(0, 40)}`);
    assert.equal(pnpm.findings, undefined);
  }
});

// ---------------------------------------------------------------- exceptions

test('a complete, unexpired exception is accepted', () => {
  // Arrange / Act
  const { exceptions, problems } = validateExceptions({ exceptions: [goodException()] }, NOW);

  // Assert
  assert.deepEqual(problems, []);
  assert.equal(exceptions.length, 1);
});

test('an expired exception is a problem, not silently ignored', () => {
  // Arrange / Act
  const { exceptions, problems } = validateExceptions({ exceptions: [goodException({ expires: '2026-11-16' })] }, NOW);

  // Assert
  assert.equal(exceptions.length, 0);
  assert.match(problems[0], /expired on 2026-11-16/);
});

test('an exception that expires today is still valid, and one dated too far ahead is rejected', () => {
  // Arrange
  const today = goodException({ expires: '2026-11-17' });
  const tooFar = goodException({ advisory: 'GHSA-DDDD-EEEE-FFFF', expires: '2027-06-30' });

  // Act
  const { exceptions, problems } = validateExceptions({ exceptions: [today, tooFar] }, NOW);

  // Assert
  assert.equal(exceptions.length, 1);
  assert.match(problems[0], new RegExp(`more than ${MAX_EXCEPTION_DAYS} days`));
});

test('exceptions missing an owner, a real reason, a package or a valid id are rejected', () => {
  // Arrange
  const bad = [
    goodException({ owner: '' }),
    goodException({ reason: 'later' }),
    goodException({ package: undefined }),
    goodException({ advisory: 'CVE-2026-0001' }),
    goodException({ expires: 'next week' }),
    'not an object',
  ];

  for (const entry of bad) {
    // Act
    const { exceptions, problems } = validateExceptions({ exceptions: [entry] }, NOW);

    // Assert
    assert.equal(exceptions.length, 0, JSON.stringify(entry));
    assert.equal(problems.length, 1, JSON.stringify(entry));
  }
});

test('a file without an "exceptions" array is malformed', () => {
  // Arrange / Act
  const { problems } = validateExceptions({}, NOW);

  // Assert
  assert.match(problems[0], /"exceptions" array/);
});

// ---------------------------------------------------------------- the decision

const finding = (over = {}) => ({ id: GHSA, package: 'left-pad', severity: 'critical', title: 'Bad thing', source: 'pnpm', ...over });
const decide = (results, exceptions = []) => evaluate({ results, exceptionsFile: { exceptions }, now: NOW });

test('no findings passes', () => {
  assert.equal(decide([{ findings: [] }, { findings: [] }]).outcome, 'pass');
});

test('moderate and low findings never block', () => {
  // Arrange
  const results = [{ findings: [finding({ severity: 'moderate' }), finding({ id: 'GHSA-zzzz-zzzz-zzzz', severity: 'low' })] }];

  // Act / Assert
  assert.equal(decide(results).outcome, 'pass');
});

test('an unapproved high or critical finding fails the policy, in any lockfile set', () => {
  for (const severity of ['high', 'critical']) {
    // Arrange
    const results = [{ findings: [] }, { findings: [finding({ severity, source: 'server/package-lock.json' })] }];

    // Act
    const verdict = decide(results);

    // Assert
    assert.equal(verdict.outcome, 'policy-failure');
    assert.equal(verdict.blocking.length, 1);
  }
});

test('a valid exception for that advisory and package lets the finding through', () => {
  // Arrange / Act
  const verdict = decide([{ findings: [finding()] }], [goodException()]);

  // Assert
  assert.equal(verdict.outcome, 'pass');
  assert.equal(verdict.excepted.length, 1);
});

test('an exception is narrow: the same advisory in a different package is not covered', () => {
  // Arrange / Act
  const verdict = decide([{ findings: [finding({ package: 'right-pad' })] }], [goodException()]);

  // Assert
  assert.equal(verdict.outcome, 'policy-failure');
});

test('an expired exception does not cover its finding, and the gate fails', () => {
  // Arrange / Act
  const verdict = decide([{ findings: [finding()] }], [goodException({ expires: '2026-01-01' })]);

  // Assert
  assert.equal(verdict.outcome, 'policy-failure');
  assert.equal(verdict.blocking.length, 1);
  assert.equal(verdict.problems.length, 1);
});

test('an expired exception fails the gate even when its finding is already gone', () => {
  // Arrange / Act
  const verdict = decide([{ findings: [] }], [goodException({ expires: '2026-01-01' })]);

  // Assert
  assert.equal(verdict.outcome, 'policy-failure');
});

test('an exception with no matching finding is reported as unused but does not fail', () => {
  // Arrange / Act
  const verdict = decide([{ findings: [] }], [goodException()]);

  // Assert
  assert.equal(verdict.outcome, 'pass');
  assert.equal(verdict.unusedExceptions.length, 1);
});

test('an advisory-service outage is an infrastructure failure, never a pass', () => {
  // Arrange: one audit worked and found nothing, another could not run
  const results = [{ findings: [] }, { outage: 'server/package-lock.json: ENOTFOUND registry.npmjs.org' }];

  // Act
  const verdict = decide(results);

  // Assert
  assert.equal(verdict.outcome, 'infrastructure');
  assert.notEqual(EXIT_CODES[verdict.outcome], EXIT_CODES.pass);
  assert.equal(verdict.outages.length, 1);
});

test('an outage outranks a policy failure, so a half-run audit is never reported as a clean result', () => {
  // Arrange
  const results = [{ findings: [finding()] }, { outage: 'frontend/package-lock.json: timed out' }];

  // Act
  const verdict = decide(results);

  // Assert
  assert.equal(verdict.outcome, 'infrastructure');
});

test('exit codes distinguish pass, policy failure and infrastructure failure', () => {
  assert.deepEqual(EXIT_CODES, { pass: 0, 'policy-failure': 1, infrastructure: 2 });
});

// ---------------------------------------------------------------- lockfile policy

test('the three allowed lockfiles are fine, any other lockfile is flagged', () => {
  // Arrange
  const tracked = ['pnpm-lock.yaml', 'frontend/package-lock.json', 'server/package-lock.json', 'package.json', 'docs/yarn.lockdown.md'];
  const sneaky = [...tracked, 'yarn.lock', 'e2e/package-lock.json', 'npm-shrinkwrap.json', 'bun.lockb'];

  // Act / Assert
  assert.deepEqual(findUnexpectedLockfiles(tracked), []);
  assert.deepEqual(findUnexpectedLockfiles(sneaky), ['yarn.lock', 'e2e/package-lock.json', 'npm-shrinkwrap.json', 'bun.lockb']);
});

test('a missing allowed lockfile is reported', () => {
  assert.deepEqual(findMissingLockfiles(['pnpm-lock.yaml', 'server/package-lock.json']), ['frontend/package-lock.json']);
});

test('a lockfile that matches its manifest is in sync', () => {
  // Arrange
  const manifest = { dependencies: { next: '^15.5.29' }, devDependencies: { vitest: '^5.0.3' } };
  const lock = { packages: { '': { dependencies: { next: '^15.5.29' }, devDependencies: { vitest: '^5.0.3' } } } };

  // Act / Assert
  assert.deepEqual(diffManifestAgainstLock('frontend', manifest, lock), []);
});

test('a lockfile that fell behind its manifest is reported, naming each dependency', () => {
  // Arrange: the real failure this guards against: manifest on Next 15, lockfile still on 14, tooling missing
  const manifest = { dependencies: { next: '^15.5.29' }, devDependencies: { vitest: '^5.0.3' } };
  const lock = { packages: { '': { dependencies: { next: '^14.2.35' } } } };

  // Act
  const problems = diffManifestAgainstLock('frontend', manifest, lock);

  // Assert
  assert.equal(problems.length, 2);
  assert.match(problems[0], /dependencies\.next is "\^15\.5\.29" in package\.json but "\^14\.2\.35"/);
  assert.match(problems[1], /devDependencies\.vitest is "\^5\.0\.3" in package\.json but "\(absent\)"/);
});

test('a lockfile with no root entry must be regenerated', () => {
  assert.match(diffManifestAgainstLock('server', {}, { packages: {} })[0], /no root entry/);
});

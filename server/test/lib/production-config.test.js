import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateProductionConfig } from '../../src/lib/production-config.js';

const secret = 'a'.repeat(48);
const valid = { NODE_ENV: 'production', JWT_SECRET: secret, DATABASE_URL: 'postgres://user:pass@db.example.com/app' };
const strict = (env) => ({ ...env, STRICT_PRODUCTION_CONFIG: '1' });

/** Runs the validator, collecting what it logs. */
function check(env) {
  const logged = [];
  const warnings = validateProductionConfig(env, (m) => logged.push(m));
  return { warnings, logged };
}

test('production configuration accepts a strong secret and remote PostgreSQL URL, without any warning', () => {
  // Arrange / Act
  const { warnings, logged } = check(valid);

  // Assert
  assert.deepEqual(warnings, []);
  assert.deepEqual(logged, []);
});

test('local development does not require production settings', () => {
  assert.doesNotThrow(() => validateProductionConfig({ NODE_ENV: 'development' }));
  assert.doesNotThrow(() => validateProductionConfig({}));
});

// ---- rules that always refuse to start (they were enforced before, or can never work)

test('production always rejects an absent or built-in secret, without printing values', () => {
  for (const JWT_SECRET of [undefined, '', '   ', 'dev-insecure-secret-change-me']) {
    assert.throws(() => validateProductionConfig({ ...valid, JWT_SECRET }), /JWT_SECRET must be configured/);
    assert.throws(() => validateProductionConfig(strict({ ...valid, JWT_SECRET })), /JWT_SECRET must be configured/);
  }
});

test('production always rejects a DATABASE_URL that is set but malformed, not PostgreSQL, or local', () => {
  for (const DATABASE_URL of ['not a url', 'mysql://user:pass@db.example.com/app', 'postgres://user:pass@localhost/app', 'postgres://user:pass@127.0.0.1/app', 'postgres://user:pass@[::1]/app']) {
    assert.throws(() => validateProductionConfig({ ...valid, DATABASE_URL }), /DATABASE_URL/, DATABASE_URL);
  }
});

test('production errors do not expose configured secrets', () => {
  assert.throws(
    () => validateProductionConfig({ ...valid, JWT_SECRET: '' , DATABASE_URL: 'postgres://user:topsecret-pw@localhost/app' }),
    (error) => !error.message.includes('topsecret-pw'),
  );
  assert.throws(
    () => validateProductionConfig(strict({ ...valid, JWT_SECRET: 'private-value' })),
    (error) => !error.message.includes('private-value'),
  );
});

// ---- rules that warn by default, so a live API is never taken down by a setting nobody could check

test('a short secret only warns by default: the API still starts, and the warning names the problem without the value', () => {
  // Arrange
  const env = { ...valid, JWT_SECRET: 'short-but-real-secret' };

  // Act
  const { warnings, logged } = check(env);

  // Assert
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /JWT_SECRET is shorter than 32 characters/);
  assert.match(logged[0], /^\[config\] JWT_SECRET/);
  assert.ok(!logged.join('\n').includes('short-but-real-secret'));
});

test('a missing DATABASE_URL only warns by default, and says what that means', () => {
  // Arrange / Act
  const { warnings, logged } = check({ ...valid, DATABASE_URL: '' });

  // Assert
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /DATABASE_URL is not set/);
  assert.match(warnings[0], /lost on every restart/);
  assert.match(logged[0], /^\[config\] DATABASE_URL/);
});

test('both problems together give two warnings', () => {
  // Arrange / Act
  const { warnings } = check({ NODE_ENV: 'production', JWT_SECRET: 'short-but-real-secret' });

  // Assert
  assert.equal(warnings.length, 2);
});

// ---- STRICT_PRODUCTION_CONFIG=1 turns the warnings into refusals to start

test('strict mode refuses a short secret and a missing DATABASE_URL', () => {
  // Arrange / Act / Assert
  assert.throws(() => validateProductionConfig(strict({ ...valid, JWT_SECRET: 'short' })), /JWT_SECRET must be at least 32 characters/);
  assert.throws(() => validateProductionConfig(strict({ ...valid, DATABASE_URL: '' })), /DATABASE_URL must be configured/);
  assert.throws(() => validateProductionConfig(strict({ NODE_ENV: 'production', JWT_SECRET: secret })), /DATABASE_URL must be configured/);
});

test('strict mode still accepts a compliant configuration, and only the exact value "1" counts', () => {
  // Arrange / Act / Assert
  assert.doesNotThrow(() => validateProductionConfig(strict(valid)));
  assert.doesNotThrow(() => validateProductionConfig({ ...valid, JWT_SECRET: 'short-but-real-secret', STRICT_PRODUCTION_CONFIG: 'true' }, () => {}));
});

test('the application starts in production with a short secret and no database, and warns instead', async () => {
  // Arrange
  const { createApp } = await import('../../src/app.js');
  const saved = { NODE_ENV: process.env.NODE_ENV, JWT_SECRET: process.env.JWT_SECRET, DATABASE_URL: process.env.DATABASE_URL, STRICT: process.env.STRICT_PRODUCTION_CONFIG, RL: process.env.RATE_LIMIT_STORE };
  const originalWarn = console.warn;
  const warned = [];
  console.warn = (m) => warned.push(String(m));
  process.env.NODE_ENV = 'production';
  process.env.JWT_SECRET = 'short-but-real-secret';
  delete process.env.DATABASE_URL;
  delete process.env.STRICT_PRODUCTION_CONFIG;
  delete process.env.RATE_LIMIT_STORE;

  try {
    // Act
    const app = createApp({ logging: false, persistence: false, rateLimits: false });

    // Assert
    assert.equal(typeof app.listen, 'function');
    assert.ok(warned.some((m) => m.includes('[config] JWT_SECRET')));
    assert.ok(warned.some((m) => m.includes('[config] DATABASE_URL')));
  } finally {
    console.warn = originalWarn;
    for (const [key, value] of [['NODE_ENV', saved.NODE_ENV], ['JWT_SECRET', saved.JWT_SECRET], ['DATABASE_URL', saved.DATABASE_URL], ['STRICT_PRODUCTION_CONFIG', saved.STRICT], ['RATE_LIMIT_STORE', saved.RL]]) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

/** Password policy — lib/password-policy.js: the rules, the error sentence and generated temporary passwords. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkPassword, passwordError, generateTempPassword, PASSWORD_RULES, PASSWORD_MAX } from '../../src/lib/password-policy.js';

test('a password meeting every rule passes', () => {
  // Act
  const problems = checkPassword('Grill-master7', { email: 'sam@rest.test', name: 'Sam Lee' });

  // Assert
  assert.deepEqual(problems, []);
});

test('each character rule is reported on its own', () => {
  // Arrange
  const cases = [
    ['Ab1!', /at least 8 characters/],
    ['ABCDEFG1!', /a lowercase letter/],
    ['abcdefg1!', /an uppercase letter/],
    ['Abcdefgh!', /a number/],
    ['Abcdefgh1', /a special character/],
  ];

  for (const [password, expected] of cases) {
    // Act
    const problems = checkPassword(password);

    // Assert
    assert.equal(problems.length, 1, `${password} → ${problems.join(' | ')}`);
    assert.match(problems[0], expected);
  }
});

test('the five character rules are the ones shown as a checklist', () => {
  // Assert
  assert.deepEqual(PASSWORD_RULES.map((r) => r.id), ['length', 'lower', 'upper', 'number', 'special']);
});

test('over-long, personal and very common passwords are refused', () => {
  // Arrange
  const long = `Aa1!${'x'.repeat(PASSWORD_MAX)}`;

  // Act
  const tooLong = checkPassword(long);
  const asEmail = checkPassword('Sam.Lee@Rest1.test', { email: 'sam.lee@rest1.test' });
  const asName = checkPassword('Sam Lee-2024!', { name: 'Sam Lee-2024!' });
  const common = checkPassword('P@ssw0rd!');

  // Assert
  assert.ok(tooLong.some((p) => /at most 128/.test(p)));
  assert.ok(asEmail.some((p) => /different from your email/.test(p)));
  assert.ok(asName.some((p) => /different from your email and name/.test(p)));
  assert.ok(common.some((p) => /less common/.test(p)));
});

test('non-string input never passes', () => {
  // Act / Assert
  for (const value of [undefined, null, 12345678, ['Aa1!aaaa'], { length: 9 }]) {
    assert.ok(checkPassword(value).length > 0);
  }
});

test('passwordError joins the failures into one sentence, or returns null', () => {
  // Act
  const message = passwordError('abc');
  const ok = passwordError('Wood-fired9');

  // Assert
  assert.match(message, /^Password needs: at least 8 characters, an uppercase letter, a number, a special character/);
  assert.equal(ok, null);
});

test('generated temporary passwords always satisfy the policy and differ', () => {
  // Act
  const samples = Array.from({ length: 300 }, () => generateTempPassword());

  // Assert
  for (const pw of samples) {
    assert.equal(pw.length, 12);
    assert.deepEqual(checkPassword(pw), [], pw);
  }
  assert.equal(new Set(samples).size, samples.length);
});

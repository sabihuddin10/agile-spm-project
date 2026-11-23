import { describe, expect, it } from 'vitest';
import { checkPassword, confirmError, passwordError, passwordStrength, PASSWORD_MAX_BYTES, PASSWORD_RULES } from '@/lib/validation/password';

describe('checkPassword', () => {
  it('reports each rule separately', () => {
    // Act
    const result = checkPassword('abcdefgh');

    // Assert
    expect(result.rules.filter((r) => r.met).map((r) => r.id)).toEqual(['length', 'lower']);
    expect(result.metCount).toBe(2);
    expect(result.valid).toBe(false);
  });

  it('accepts a password that meets every rule', () => {
    // Act
    const result = checkPassword('Grill-master7', { email: 'sam@rest.test', name: 'Sam Lee' });

    // Assert
    expect(result.valid).toBe(true);
    expect(result.extra).toEqual([]);
  });

  it('flags common passwords and ones that repeat the email or name', () => {
    // Act
    const common = checkPassword('P@ssw0rd!');
    const personal = checkPassword('Sam.Lee@Rest1.test', { email: 'sam.lee@rest1.test' });

    // Assert
    expect(common.valid).toBe(false);
    expect(common.extra[0]).toMatch(/too common/);
    expect(personal.extra[0]).toMatch(/email or name/);
  });

  it('uses the same five checklist rules as the server', () => {
    // Assert
    expect(PASSWORD_RULES.map((r) => r.id)).toEqual(['length', 'lower', 'upper', 'number', 'special']);
  });
});

describe('passwordStrength', () => {
  it('grades empty, weak, fair and strong', () => {
    // Act / Assert
    expect(passwordStrength('')).toBe('empty');
    expect(passwordStrength('abc')).toBe('weak');
    expect(passwordStrength('Password1!')).toBe('weak');
    expect(passwordStrength('Grill-7a')).toBe('fair');
    expect(passwordStrength('Grill-master7')).toBe('strong');
  });
});

describe('passwordError and confirmError', () => {
  it('returns one message, or undefined when fine', () => {
    // Act / Assert
    expect(passwordError('')).toBe('Choose a password.');
    expect(passwordError('abc')).toMatch(/does not meet all the requirements/);
    expect(passwordError('Grill-master7')).toBeUndefined();
    expect(confirmError('Grill-master7', '')).toMatch(/again/);
    expect(confirmError('Grill-master7', 'Grill-master8')).toBe("Passwords don't match.");
    expect(confirmError('Grill-master7', 'Grill-master7')).toBeUndefined();
  });
});

describe('the 72-byte limit (bcrypt ignores anything after it)', () => {
  it('accepts a password of exactly 72 bytes and rejects one of 73', () => {
    // Arrange
    const exact = `Aa1!${'x'.repeat(PASSWORD_MAX_BYTES - 4)}`;

    // Act
    const ok = checkPassword(exact);
    const tooLong = checkPassword(`${exact}y`);

    // Assert
    expect(ok.valid).toBe(true);
    expect(tooLong.valid).toBe(false);
    expect(tooLong.extra.join(' ')).toMatch(/at most 72 bytes/);
  });

  it('counts bytes, not characters: 40 accented letters are 80 bytes', () => {
    // Arrange
    const accented = `Aa1!${'é'.repeat(40)}`;

    // Act
    const result = checkPassword(accented);

    // Assert
    expect(accented.length).toBeLessThan(PASSWORD_MAX_BYTES);
    expect(result.valid).toBe(false);
    expect(result.extra.join(' ')).toMatch(/bytes/);
  });

  it('says the same thing as the server, in sentence form', () => {
    // Arrange / Act
    const message = passwordError(`Aa1!${'x'.repeat(PASSWORD_MAX_BYTES)}`);

    // Assert
    expect(message).toMatch(/72 bytes/);
  });
});

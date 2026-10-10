import { describe, expect, it } from 'vitest';
import {
  isValidEmail, validateEmail, validateFutureDate, validateIntegerInRange, validateMaxLength, validateName, validatePhone, validateRequired,
} from '@/lib/validation/fields';

describe('field validators', () => {
  it('validateName: required, at most 80 characters, no control characters', () => {
    // Act / Assert
    expect(validateName('  Ada  ')).toBeUndefined();
    expect(validateName('')).toBe('Please enter your name.');
    expect(validateName('', { required: false })).toBeUndefined();
    expect(validateName('x'.repeat(81))).toMatch(/80 characters/);
    expect(validateName('Bad\u0007Name')).toMatch(/unsupported/);
  });

  it('validateEmail and isValidEmail', () => {
    // Act / Assert
    expect(validateEmail(' sam@rest.test ')).toBeUndefined();
    expect(validateEmail('')).toBe('Please enter your email address.');
    expect(validateEmail('sam@rest')).toMatch(/name@example.com/);
    expect(validateEmail(`${'a'.repeat(250)}@x.io`)).toMatch(/254/);
    expect(isValidEmail('sam@rest.test')).toBe(true);
    expect(isValidEmail('nope')).toBe(false);
  });

  it('validatePhone: optional, allowed characters, 7–20 digits', () => {
    // Act / Assert
    expect(validatePhone('')).toBeUndefined();
    expect(validatePhone('', { required: true })).toMatch(/phone number/);
    expect(validatePhone('+1 (555) 010-2000')).toBeUndefined();
    expect(validatePhone('call me')).toMatch(/digits, spaces/);
    expect(validatePhone('12-34')).toMatch(/7 to 20 digits/);
    expect(validatePhone('1'.repeat(21))).toMatch(/7 to 20 digits/);
  });

  it('validateIntegerInRange, validateMaxLength and validateRequired', () => {
    // Act / Assert
    expect(validateIntegerInRange(4, 1, 12, 'Party size')).toBeUndefined();
    expect(validateIntegerInRange('13', 1, 12, 'Party size')).toBe('Party size must be between 1 and 12.');
    expect(validateIntegerInRange(2.5, 1, 12, 'Party size')).toBe('Party size must be a whole number.');
    expect(validateIntegerInRange('', 1, 12, 'Party size')).toBe('Party size must be a whole number.');
    expect(validateMaxLength('abcd', 3, 'Notes')).toMatch(/at most 3/);
    expect(validateMaxLength('abc', 3)).toBeUndefined();
    expect(validateRequired('  ', 'Needed.')).toBe('Needed.');
  });

  it('validateFutureDate refuses empty, malformed and past dates', () => {
    // Act / Assert
    expect(validateFutureDate('', '2026-10-10')).toBe('Please choose a date.');
    expect(validateFutureDate('10/11/2026', '2026-10-10')).toBe('Choose a valid date.');
    expect(validateFutureDate('2026-10-09', '2026-10-10')).toBe('Please choose today or a later date.');
    expect(validateFutureDate('2026-10-10', '2026-10-10')).toBeUndefined();
  });
});

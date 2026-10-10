import { describe, expect, it } from 'vitest';
import {
  CONTACT_MISSING, formatPhoneInput, isValidEmail, PHONE_FORMAT_RE,normalizeName, validateContact, validateNumberInRange, validateEmail, validateFutureDate, validateIntegerInRange, validateMaxLength, validateName, validatePhone, validateRequired,
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

  it('validateName: letters and spaces/\'-. only, and two words or at least three letters', () => {
    // Act / Assert
    expect(validateName('SS')).toMatch(/full name/);
    expect(validateName('Jo')).toMatch(/full name/);
    expect(validateName('Li Na')).toBeUndefined();
    expect(validateName("Seán O'Brien-Murphy Jr.")).toBeUndefined();
    expect(validateName('José')).toBeUndefined();
    expect(validateName('R2D2')).toMatch(/letters, spaces/);
    expect(validateName('ana@x')).toMatch(/letters, spaces/);
    expect(normalizeName('  Ana    Silva ')).toBe('Ana Silva');
  });

  it('validateContact and validateNumberInRange', () => {
    // Act / Assert
    expect(validateContact('', '  ')).toBe(CONTACT_MISSING);
    expect(validateContact('', '+92 300 1234567')).toBeUndefined();
    expect(validateContact('a@b.co', '')).toBeUndefined();
    expect(validateNumberInRange('12.5', 0, 10000, 'Price')).toBeUndefined();
    expect(validateNumberInRange('10001', 0, 10000, 'Price')).toBe('Price must be between 0 and 10,000.');
    expect(validateNumberInRange('', 0, 10, 'Price')).toBe('Price is required.');
    expect(validateNumberInRange('', 0, 10, 'Price', { required: false })).toBeUndefined();
    expect(validateNumberInRange('abc', 0, 10, 'Price')).toBe('Price must be a number.');
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

  it('validatePhone: optional, and only a full Pakistani mobile in "+92 3XX XXXXXXX" form', () => {
    // Act / Assert
    expect(validatePhone('')).toBeUndefined();
    expect(validatePhone('   ')).toBeUndefined();
    expect(validatePhone('', { required: true })).toMatch(/phone number/);
    expect(validatePhone('+92 300 1234567')).toBeUndefined();
    expect(validatePhone(' +92 321 7654321 ')).toBeUndefined();
    expect(validatePhone('+92 300 123456')).toMatch(/0300 1234567/);
    expect(validatePhone('+92 212 1234567')).toMatch(/0300 1234567/);
    expect(validatePhone('03001234567')).toMatch(/0300 1234567/);
    expect(validatePhone('+1 (555) 010-2000')).toMatch(/0300 1234567/);
    expect(validatePhone('call me')).toMatch(/0300 1234567/);
  });

  it('PHONE_FORMAT_RE matches only the stored format', () => {
    // Act / Assert
    expect(PHONE_FORMAT_RE.test('+92 300 1234567')).toBe(true);
    expect(PHONE_FORMAT_RE.test('+923001234567')).toBe(false);
    expect(PHONE_FORMAT_RE.test('+92 300 12345678')).toBe(false);
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

describe('formatPhoneInput', () => {
  it('drops everything that is not a digit', () => {
    // Arrange
    const typed = 'abc0300-12x34 567!';

    // Act
    const formatted = formatPhoneInput(typed);

    // Assert
    expect(formatted).toBe('+92 300 1234567');
  });

  it('returns an empty string when there are no digits to keep', () => {
    // Arrange
    const inputs = ['', '   ', 'abc', '0', '00'];

    // Act
    const formatted = inputs.map(formatPhoneInput);

    // Assert
    expect(formatted).toEqual(['', '', '', '', '']);
  });

  it('keeps a country code that is still being typed', () => {
    // Arrange
    const inputs = ['+', '+9', '9', '+92', '92', '+92 '];

    // Act
    const formatted = inputs.map(formatPhoneInput);

    // Assert
    expect(formatted).toEqual(['+', '+9', '+9', '+92', '+92', '+92']);
  });

  it('turns a leading 0 into the +92 country code', () => {
    // Arrange
    const local = '03001234567';

    // Act
    const formatted = formatPhoneInput(local);

    // Assert
    expect(formatted).toBe('+92 300 1234567');
  });

  it('keeps a number that already has the country code, in any spelling', () => {
    // Arrange
    const inputs = ['923001234567', '+923001234567', '+92 300 1234567', '0092 300 1234567', '3001234567'];

    // Act
    const formatted = inputs.map(formatPhoneInput);

    // Assert
    expect(formatted).toEqual(Array(inputs.length).fill('+92 300 1234567'));
  });

  it('formats a local number as it is typed, key by key', () => {
    // Arrange
    const keys = '03001234567';
    let value = '';
    const seen: string[] = [];

    // Act
    for (const key of keys) {
      value = formatPhoneInput(value + key);
      seen.push(value);
    }

    // Assert
    expect(seen).toEqual([
      '', '+92 3', '+92 30', '+92 300', '+92 300 1', '+92 300 12', '+92 300 123',
      '+92 300 1234', '+92 300 12345', '+92 300 123456', '+92 300 1234567',
    ]);
  });

  it('formats a number typed with its country code, key by key', () => {
    // Arrange
    const typeKeys = (keys: string) => keys.split('').reduce((value, key) => formatPhoneInput(value + key), '');

    // Act
    const withPlus = typeKeys('+92 300 1234567');
    const withoutPlus = typeKeys('923001234567');

    // Assert
    expect(withPlus).toBe('+92 300 1234567');
    expect(withoutPlus).toBe('+92 300 1234567');
  });

  it('caps the number at ten digits after +92', () => {
    // Arrange
    const full = '+92 300 1234567';

    // Act
    const formatted = formatPhoneInput(`${full}89`);

    // Assert
    expect(formatted).toBe(full);
    expect(PHONE_FORMAT_RE.test(formatted)).toBe(true);
  });

  it('backspacing over the separator space keeps the remaining digits', () => {
    // Arrange
    const afterBackspace = '+92 300 ';

    // Act
    const formatted = formatPhoneInput(afterBackspace);

    // Assert
    expect(formatted).toBe('+92 300');
  });
});

import { test, expect, describe } from 'bun:test';
import { PhoneValidator } from './phone';

describe('PhoneValidator', () => {
  // Test parseAndFormat
  test('parseAndFormat should correctly format valid numbers to E.164', () => {
    expect(PhoneValidator.parseAndFormat('7771234567', 'KZ')).toBe('+77771234567');
    expect(PhoneValidator.parseAndFormat('87771234567', 'KZ')).toBe('+77771234567');
    expect(PhoneValidator.parseAndFormat('+77771234567', 'KZ')).toBe('+77771234567');
    expect(PhoneValidator.parseAndFormat('9123456789', 'RU')).toBe('+79123456789');
    expect(PhoneValidator.parseAndFormat('(212) 555-1234', 'US')).toBe('+12125551234');
  });

  test('parseAndFormat should return null for invalid numbers', () => {
    expect(PhoneValidator.parseAndFormat('123', 'KZ')).toBeNull(); // Too short
    expect(PhoneValidator.parseAndFormat('invalid', 'KZ')).toBeNull(); // Non-numeric
    expect(PhoneValidator.parseAndFormat('7771234567', 'US')).toBeNull(); // Wrong country
  });

  // Test isValid
  test('isValid should return true for valid numbers', () => {
    expect(PhoneValidator.isValid('7771234567', 'KZ')).toBeTrue();
    expect(PhoneValidator.isValid('+77771234567', 'KZ')).toBeTrue();
    expect(PhoneValidator.isValid('87771234567', 'KZ')).toBeTrue();
    expect(PhoneValidator.isValid('9123456789', 'RU')).toBeTrue();
  });

  test('isValid should return false for invalid numbers', () => {
    expect(PhoneValidator.isValid('123', 'KZ')).toBeFalse();
    expect(PhoneValidator.isValid('invalid', 'KZ')).toBeFalse();
    expect(PhoneValidator.isValid('7771234567', 'US')).toBeFalse();
  });

  // Test cleanNumber
  test('cleanNumber should remove non-digits but keep leading plus', () => {
    expect(PhoneValidator.cleanNumber('+7 (777) 123-45-67')).toBe('+77771234567');
    expect(PhoneValidator.cleanNumber('8-777-123-45-67')).toBe('87771234567');
    expect(PhoneValidator.cleanNumber('123abc456')).toBe('123456');
    expect(PhoneValidator.cleanNumber('++777')).toBe('+777'); // Should keep only one leading +
    expect(PhoneValidator.cleanNumber('777')).toBe('777');
  });
});

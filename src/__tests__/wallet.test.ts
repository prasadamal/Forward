import {
  checkExpiry,
  cvvLength,
  detectBrand,
  formatCardNumber,
  formatExpiryInput,
  last4,
  luhnValid,
} from '../wallet/cards';
import { generatePassword, passwordStrength, DEFAULT_PASSWORD_OPTIONS } from '../wallet/passwords';
import { randomBytes } from 'crypto';

describe('cards', () => {
  it('validates numbers with the Luhn checksum', () => {
    expect(luhnValid('4111 1111 1111 1111')).toBe(true);
    expect(luhnValid('4111 1111 1111 1112')).toBe(false);
    expect(luhnValid('378282246310005')).toBe(true);
    expect(luhnValid('123')).toBe(false);
  });

  it.each([
    ['4111111111111111', 'visa'],
    ['5555555555554444', 'mastercard'],
    ['2223003122003222', 'mastercard'],
    ['378282246310005', 'amex'],
    ['6011111111111117', 'discover'],
    ['6522000000000000', 'rupay'],
    ['6080010000000000', 'rupay'],
    ['8100000000000000', 'rupay'],
    ['3530111333300000', 'jcb'],
    ['30569309025904', 'diners'],
    ['6200000000000005', 'unionpay'],
    ['6759000000000000', 'maestro'],
    ['9999', 'other'],
  ])('detects %s as %s', (n, brand) => {
    expect(detectBrand(n)).toBe(brand);
  });

  it('formats numbers by network', () => {
    expect(formatCardNumber('4111111111111111')).toBe('4111 1111 1111 1111');
    expect(formatCardNumber('378282246310005')).toBe('3782 822463 10005');
    expect(formatCardNumber('41111')).toBe('4111 1');
    expect(last4('4111 1111 1111 1234')).toBe('1234');
    expect(cvvLength('amex')).toBe(4);
    expect(cvvLength('visa')).toBe(3);
  });

  it('formats and checks expiry dates', () => {
    expect(formatExpiryInput('1')).toBe('1');
    expect(formatExpiryInput('4')).toBe('04/');
    expect(formatExpiryInput('1228')).toBe('12/28');
    const now = new Date(2026, 9, 6); // Oct 2026
    expect(checkExpiry('10/26', now)).toEqual({ valid: true, expired: false });
    expect(checkExpiry('09/26', now)).toEqual({ valid: true, expired: true });
    expect(checkExpiry('13/26', now).valid).toBe(false);
    expect(checkExpiry('1/26', now).valid).toBe(false);
  });
});

describe('passwords', () => {
  const rng = (n: number) => new Uint8Array(randomBytes(n));

  it('generates passwords with every enabled character set', () => {
    for (let i = 0; i < 50; i++) {
      const pw = generatePassword(DEFAULT_PASSWORD_OPTIONS, rng);
      expect(pw).toHaveLength(20);
      expect(pw).toMatch(/[a-z]/);
      expect(pw).toMatch(/[A-Z]/);
      expect(pw).toMatch(/[0-9]/);
      expect(pw).toMatch(/[^a-zA-Z0-9]/);
      expect(pw).not.toMatch(/[lIO01]/);
    }
  });

  it('respects options', () => {
    const pw = generatePassword({ length: 8, lowercase: false, uppercase: false, digits: true, symbols: false }, rng);
    expect(pw).toMatch(/^[2-9]{8}$/);
  });

  it('falls back to lowercase when nothing is selected', () => {
    const pw = generatePassword({ length: 6, lowercase: false, uppercase: false, digits: false, symbols: false }, rng);
    expect(pw).toMatch(/^[a-z]{6}$/);
  });

  it('rates strength', () => {
    expect(passwordStrength('password').score).toBe(0);
    expect(passwordStrength('abc').score).toBe(0);
    expect(passwordStrength('Tr0ub4dor&3xyz').score).toBeGreaterThanOrEqual(3);
    expect(passwordStrength(generatePassword(DEFAULT_PASSWORD_OPTIONS, rng)).score).toBe(4);
  });
});

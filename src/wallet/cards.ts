import { CardBrand } from '../types';

export function digitsOnly(s: string): string {
  return s.replace(/\D+/g, '');
}

/** Luhn checksum used by all major card networks. */
export function luhnValid(number: string): boolean {
  const digits = digitsOnly(number);
  if (digits.length < 12 || digits.length > 19) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

function inRange(prefix: string, digits: string, from: number, to: number): boolean {
  if (digits.length < prefix.length) return false;
  const n = Number(digits.slice(0, prefix.length));
  return n >= from && n <= to;
}

/** Best-effort network detection from the leading digits (IIN/BIN). */
export function detectBrand(number: string): CardBrand {
  const d = digitsOnly(number);
  if (!d) return 'other';
  const two = d.slice(0, 2);

  // RuPay before Discover/Maestro: several RuPay ranges overlap them.
  if (
    inRange('000000', d, 508500, 508999) ||
    inRange('000000', d, 606985, 607984) ||
    inRange('000000', d, 608001, 608500) ||
    inRange('000000', d, 652150, 653149) ||
    two === '81' ||
    two === '82'
  ) {
    return 'rupay';
  }
  if (d.startsWith('4')) return 'visa';
  if (inRange('00', d, 51, 55) || inRange('0000', d, 2221, 2720)) return 'mastercard';
  if (two === '34' || two === '37') return 'amex';
  if (inRange('000', d, 300, 305) || two === '36' || two === '38' || two === '39') return 'diners';
  if (inRange('0000', d, 3528, 3589)) return 'jcb';
  if (d.startsWith('6011') || inRange('000', d, 644, 649) || two === '65') return 'discover';
  if (two === '62') return 'unionpay';
  if (two === '50' || inRange('00', d, 56, 58) || two === '63' || two === '67') return 'maestro';
  return 'other';
}

export const BRAND_LABEL: Record<CardBrand, string> = {
  visa: 'VISA',
  mastercard: 'Mastercard',
  rupay: 'RuPay',
  amex: 'American Express',
  diners: 'Diners Club',
  discover: 'Discover',
  jcb: 'JCB',
  maestro: 'Maestro',
  unionpay: 'UnionPay',
  other: 'Card',
};

/** Expected lengths per network (used for gentle validation hints). */
export function expectedLengths(brand: CardBrand): number[] {
  switch (brand) {
    case 'amex':
      return [15];
    case 'diners':
      return [14, 16, 19];
    case 'visa':
      return [13, 16, 19];
    case 'maestro':
      return [12, 13, 14, 15, 16, 17, 18, 19];
    case 'other':
      return [12, 13, 14, 15, 16, 17, 18, 19];
    default:
      return [16, 19];
  }
}

export function cvvLength(brand: CardBrand): number {
  return brand === 'amex' ? 4 : 3;
}

/** "4111111111111111" → "4111 1111 1111 1111"; Amex → "3782 822463 10005". */
export function formatCardNumber(number: string, brand: CardBrand = detectBrand(number)): string {
  const d = digitsOnly(number).slice(0, 19);
  const groups = brand === 'amex' ? [4, 6, 5] : brand === 'diners' && d.length === 14 ? [4, 6, 4] : null;
  if (groups) {
    const out: string[] = [];
    let i = 0;
    for (const g of groups) {
      if (i >= d.length) break;
      out.push(d.slice(i, i + g));
      i += g;
    }
    if (i < d.length) out.push(d.slice(i));
    return out.join(' ');
  }
  return d.replace(/(\d{4})(?=\d)/g, '$1 ');
}

export function last4(number: string): string {
  return digitsOnly(number).slice(-4);
}

export function maskedNumber(last: string): string {
  return `•••• •••• •••• ${last || '••••'}`;
}

/** Formats typing into "MM/YY". */
export function formatExpiryInput(raw: string): string {
  const d = digitsOnly(raw).slice(0, 4);
  if (d.length === 0) return '';
  if (d.length === 1) return Number(d) > 1 ? `0${d}/` : d;
  const mm = d.slice(0, 2);
  return d.length > 2 ? `${mm}/${d.slice(2)}` : mm;
}

export interface ExpiryCheck {
  valid: boolean;
  expired: boolean;
}

export function checkExpiry(mmYY: string, now: Date = new Date()): ExpiryCheck {
  const m = /^(\d{2})\/(\d{2})$/.exec(mmYY.trim());
  if (!m) return { valid: false, expired: false };
  const month = Number(m[1]);
  const year = 2000 + Number(m[2]);
  if (month < 1 || month > 12) return { valid: false, expired: false };
  // Cards are valid through the last day of the expiry month.
  const endOfMonth = new Date(year, month, 1);
  return { valid: true, expired: endOfMonth.getTime() <= now.getTime() };
}

/** Card face gradients, picked per card. */
export const CARD_THEMES: [string, string][] = [
  ['#3B2F8F', '#7C6FE0'],
  ['#0F2027', '#2C5364'],
  ['#8E2DE2', '#4A00E0'],
  ['#141E30', '#243B55'],
  ['#C33764', '#1D2671'],
  ['#134E5E', '#71B280'],
  ['#232526', '#414345'],
  ['#B24592', '#F15F79'],
  ['#E65C00', '#F9D423'],
  ['#1F4037', '#99F2C8'],
];

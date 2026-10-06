export interface PasswordOptions {
  length: number;
  lowercase: boolean;
  uppercase: boolean;
  digits: boolean;
  symbols: boolean;
}

export const DEFAULT_PASSWORD_OPTIONS: PasswordOptions = {
  length: 20,
  lowercase: true,
  uppercase: true,
  digits: true,
  symbols: true,
};

// Look-alike characters (l/1/I, O/0) are left out so passwords are easy to type.
const SETS = {
  lowercase: 'abcdefghijkmnopqrstuvwxyz',
  uppercase: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
  digits: '23456789',
  symbols: '!@#$%^&*-_=+?',
};

export type RandomBytes = (count: number) => Uint8Array;

/** Uniform random integer in [0, max) using rejection sampling (no modulo bias). */
function randomInt(max: number, randomBytes: RandomBytes): number {
  if (max <= 0 || max > 256) throw new Error('max must be in 1..256');
  const limit = 256 - (256 % max);
  for (;;) {
    const [b] = randomBytes(1);
    if (b < limit) return b % max;
  }
}

/**
 * Generates a password with at least one character from every enabled set.
 * `randomBytes` must be a cryptographically secure source.
 */
export function generatePassword(options: PasswordOptions, randomBytes: RandomBytes): string {
  const sets = (Object.keys(SETS) as (keyof typeof SETS)[])
    .filter(k => options[k])
    .map(k => SETS[k]);
  if (sets.length === 0) sets.push(SETS.lowercase);
  const length = Math.max(sets.length, Math.min(128, Math.floor(options.length)));
  const all = sets.join('');

  const chars: string[] = sets.map(set => set[randomInt(set.length, randomBytes)]);
  while (chars.length < length) chars.push(all[randomInt(all.length, randomBytes)]);

  // Fisher–Yates shuffle so the guaranteed characters aren't always first.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1, randomBytes);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

export interface Strength {
  /** 0 (very weak) … 4 (very strong) */
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  bits: number;
}

const COMMON = new Set([
  'password', '123456', '12345678', '123456789', 'qwerty', 'abc123', 'password1', '111111',
  'iloveyou', 'admin', 'welcome', 'letmein', '1234', '000000', 'india123', 'qwerty123',
]);

/** Rough entropy estimate; good enough to nudge users toward longer secrets. */
export function passwordStrength(pw: string): Strength {
  if (!pw) return { score: 0, label: 'Empty', bits: 0 };
  if (COMMON.has(pw.toLowerCase())) return { score: 0, label: 'Very weak', bits: 0 };
  let pool = 0;
  if (/[a-z]/.test(pw)) pool += 26;
  if (/[A-Z]/.test(pw)) pool += 26;
  if (/[0-9]/.test(pw)) pool += 10;
  if (/[^a-zA-Z0-9]/.test(pw)) pool += 20;
  const uniqueRatio = new Set(pw).size / pw.length;
  const bits = Math.round(pw.length * Math.log2(Math.max(pool, 1)) * Math.min(1, 0.5 + uniqueRatio));
  const score: Strength['score'] = bits < 28 ? 0 : bits < 40 ? 1 : bits < 60 ? 2 : bits < 80 ? 3 : 4;
  const label = ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'][score];
  return { score, label, bits };
}

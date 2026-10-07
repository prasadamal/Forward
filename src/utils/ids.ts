import * as Crypto from 'expo-crypto';

/** Random UUID from the platform's secure generator. */
export function newId(): string {
  try {
    const id = Crypto.randomUUID();
    if (id) return id;
  } catch {
    // fall through (tests / unsupported runtimes)
  }
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

/** Cryptographically secure random bytes. */
export function secureRandomBytes(count: number): Uint8Array {
  const bytes = Crypto.getRandomBytes(count);
  if (!bytes || bytes.length !== count) throw new Error('Secure random number generator unavailable');
  return bytes;
}

import { bytesToHex, hexToBytes, utf8Encode } from '../utils/encoding';

/**
 * Key management for the vault.
 *
 *   pepper (32 random bytes)  → OS secure storage, this device only, never backed up
 *   vault key (32 random bytes) → stored in an encrypted "keyring" file whose
 *                                 passphrase is (passcode + pepper), run through
 *                                 SQLCipher's PBKDF2-HMAC-SHA512 (256k rounds)
 *                               → optionally also in OS secure storage behind
 *                                 Face ID / fingerprint, for quick unlock
 *   vault database             → SQLCipher (AES-256), keyed with the vault key
 *
 * Without the device-bound pepper the keyring file can't be brute-forced
 * offline, and without the passcode (or biometrics) the pepper alone is useless.
 */

export type PasscodeKind = 'pin' | 'password';

export interface KeyringState {
  version: 1;
  passcodeKind: PasscodeKind;
  biometrics: boolean;
  failedAttempts: number;
  /** Epoch ms until which passcode attempts are refused. */
  lockedUntil: number;
  createdAt: number;
}

export interface SecureKVOptions {
  requireAuth?: boolean;
  prompt?: string;
}

/** OS secure storage (Keychain / Android Keystore). */
export interface SecureKV {
  get(key: string, options?: SecureKVOptions): Promise<string | null>;
  set(key: string, value: string, options?: SecureKVOptions): Promise<void>;
  remove(key: string, options?: SecureKVOptions): Promise<void>;
}

/** Thrown by SecureKV when the user cancels a biometric prompt. */
export class AuthCancelledError extends Error {
  constructor() {
    super('Authentication cancelled');
    this.name = 'AuthCancelledError';
  }
}

/** The passphrase-protected file that holds the vault key. */
export interface KeyringFile {
  exists(): Promise<boolean>;
  /** Writes a new keyring atomically (replacing any existing one). */
  write(passphrase: string, vaultKeyHex: string): Promise<void>;
  /** The vault key, or null if the passphrase is wrong. */
  read(passphrase: string): Promise<string | null>;
  remove(): Promise<void>;
}

export interface KeyringDeps {
  kv: SecureKV;
  file: KeyringFile;
  randomBytes: (count: number) => Uint8Array;
  now: () => number;
}

export const KEYS = {
  state: 'forward.keyring.state',
  pepper: 'forward.keyring.pepper',
  bioKey: 'forward.keyring.biokey',
} as const;

export type KeyringStatus =
  /** No vault on this device yet. */
  | 'none'
  /** Vault exists and can be unlocked. */
  | 'ready'
  /** Vault files exist but this device's secret is missing (e.g. restored to a new phone). */
  | 'orphaned';

export type UnlockResult =
  | { ok: true; key: Uint8Array }
  | { ok: false; reason: 'wrong'; attemptsBeforeLockout: number }
  | { ok: false; reason: 'locked'; retryAt: number }
  | { ok: false; reason: 'unavailable' };

export type BiometricUnlockResult =
  | { ok: true; key: Uint8Array }
  | { ok: false; reason: 'cancelled' | 'unavailable' | 'invalidated' };

/** Free attempts before delays start. */
export const FREE_ATTEMPTS = 5;

/** Delay after the n-th consecutive failure (n is 1-based). */
export function lockoutDelayMs(failedAttempts: number): number {
  if (failedAttempts < FREE_ATTEMPTS) return 0;
  const steps = [30_000, 60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000];
  return steps[Math.min(failedAttempts - FREE_ATTEMPTS, steps.length - 1)];
}

export function validatePasscode(passcode: string, kind: PasscodeKind): string | null {
  if (kind === 'pin') {
    if (!/^\d{6}$/.test(passcode)) return 'Use exactly 6 digits.';
    if (/^(\d)\1{5}$/.test(passcode) || '0123456789'.includes(passcode) || '9876543210'.includes(passcode)) {
      return 'That PIN is too easy to guess.';
    }
    return null;
  }
  if (passcode.length < 8) return 'Use at least 8 characters.';
  return null;
}

/** The SQLCipher passphrase: hex(utf8(NFKC(passcode))) + ":" + hex(pepper). ASCII only, no escaping needed. */
export function keyringPassphrase(passcode: string, pepperHex: string): string {
  let normalized = passcode;
  try {
    normalized = passcode.normalize('NFKC');
  } catch {
    // keep as-is
  }
  return `${bytesToHex(utf8Encode(normalized))}:${pepperHex}`;
}

export class Keyring {
  constructor(private readonly deps: KeyringDeps) {}

  async getState(): Promise<KeyringState | null> {
    const raw = await this.deps.kv.get(KEYS.state);
    if (!raw) return null;
    try {
      const s = JSON.parse(raw) as KeyringState;
      return s && s.version === 1 ? s : null;
    } catch {
      return null;
    }
  }

  private async saveState(state: KeyringState): Promise<void> {
    await this.deps.kv.set(KEYS.state, JSON.stringify(state));
  }

  async status(): Promise<KeyringStatus> {
    const fileExists = await this.deps.file.exists();
    if (!fileExists) return 'none';
    const [state, pepper] = await Promise.all([this.getState(), this.deps.kv.get(KEYS.pepper)]);
    return state && pepper ? 'ready' : 'orphaned';
  }

  /** Creates a brand-new vault key protected by `passcode`. Returns the vault key. */
  async setup(passcode: string, kind: PasscodeKind): Promise<Uint8Array> {
    const problem = validatePasscode(passcode, kind);
    if (problem) throw new Error(problem);
    // Clear anything left behind by a previous install (iOS keeps Keychain items after uninstall).
    await this.deps.kv.remove(KEYS.bioKey).catch(() => undefined);
    const pepperHex = bytesToHex(this.deps.randomBytes(32));
    const key = this.deps.randomBytes(32);
    await this.deps.kv.set(KEYS.pepper, pepperHex);
    await this.deps.file.write(keyringPassphrase(passcode, pepperHex), bytesToHex(key));
    await this.saveState({
      version: 1,
      passcodeKind: kind,
      biometrics: false,
      failedAttempts: 0,
      lockedUntil: 0,
      createdAt: this.deps.now(),
    });
    return key;
  }

  async unlockWithPasscode(passcode: string): Promise<UnlockResult> {
    const [state, pepperHex] = await Promise.all([this.getState(), this.deps.kv.get(KEYS.pepper)]);
    if (!state || !pepperHex) return { ok: false, reason: 'unavailable' };
    const now = this.deps.now();
    if (state.lockedUntil > now) return { ok: false, reason: 'locked', retryAt: state.lockedUntil };

    const keyHex = await this.deps.file.read(keyringPassphrase(passcode, pepperHex));
    if (keyHex) {
      if (state.failedAttempts || state.lockedUntil) {
        await this.saveState({ ...state, failedAttempts: 0, lockedUntil: 0 });
      }
      return { ok: true, key: hexToBytes(keyHex) };
    }

    const failedAttempts = state.failedAttempts + 1;
    const delay = lockoutDelayMs(failedAttempts);
    const lockedUntil = delay ? now + delay : 0;
    await this.saveState({ ...state, failedAttempts, lockedUntil });
    if (lockedUntil) return { ok: false, reason: 'locked', retryAt: lockedUntil };
    return { ok: false, reason: 'wrong', attemptsBeforeLockout: Math.max(0, FREE_ATTEMPTS - failedAttempts) };
  }

  async unlockWithBiometrics(prompt: string): Promise<BiometricUnlockResult> {
    const state = await this.getState();
    if (!state?.biometrics) return { ok: false, reason: 'unavailable' };
    try {
      const keyHex = await this.deps.kv.get(KEYS.bioKey, { requireAuth: true, prompt });
      if (!keyHex) {
        // The OS dropped the key (e.g. fingerprints or Face ID were changed).
        await this.saveState({ ...state, biometrics: false });
        return { ok: false, reason: 'invalidated' };
      }
      if (state.failedAttempts || state.lockedUntil) {
        await this.saveState({ ...state, failedAttempts: 0, lockedUntil: 0 });
      }
      return { ok: true, key: hexToBytes(keyHex) };
    } catch (e) {
      if (e instanceof AuthCancelledError) return { ok: false, reason: 'cancelled' };
      return { ok: false, reason: 'invalidated' };
    }
  }

  /** Stores a copy of the vault key behind biometrics. Requires an unlocked vault. */
  async enableBiometrics(key: Uint8Array, prompt: string): Promise<boolean> {
    const state = await this.getState();
    if (!state) return false;
    try {
      await this.deps.kv.set(KEYS.bioKey, bytesToHex(key), { requireAuth: true, prompt });
      await this.saveState({ ...state, biometrics: true });
      return true;
    } catch {
      return false;
    }
  }

  async disableBiometrics(): Promise<void> {
    const state = await this.getState();
    await this.deps.kv.remove(KEYS.bioKey, { requireAuth: true }).catch(() => undefined);
    if (state) await this.saveState({ ...state, biometrics: false });
  }

  /** Re-protects the vault key with a new passcode. Requires an unlocked vault. */
  async changePasscode(key: Uint8Array, passcode: string, kind: PasscodeKind): Promise<void> {
    const problem = validatePasscode(passcode, kind);
    if (problem) throw new Error(problem);
    const [state, pepperHex] = await Promise.all([this.getState(), this.deps.kv.get(KEYS.pepper)]);
    if (!state || !pepperHex) throw new Error('Vault is not set up');
    await this.deps.file.write(keyringPassphrase(passcode, pepperHex), bytesToHex(key));
    await this.saveState({ ...state, passcodeKind: kind, failedAttempts: 0, lockedUntil: 0 });
  }

  /** Forgets every secret. The vault database must be deleted by the caller. */
  async erase(): Promise<void> {
    await this.deps.file.remove().catch(() => undefined);
    await this.deps.kv.remove(KEYS.bioKey, { requireAuth: true }).catch(() => undefined);
    await this.deps.kv.remove(KEYS.pepper).catch(() => undefined);
    await this.deps.kv.remove(KEYS.state).catch(() => undefined);
  }
}

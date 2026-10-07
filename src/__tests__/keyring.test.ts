import {
  AuthCancelledError,
  FREE_ATTEMPTS,
  KEYS,
  Keyring,
  KeyringFile,
  keyringPassphrase,
  lockoutDelayMs,
  SecureKV,
  SecureKVOptions,
  validatePasscode,
} from '../security/keyring';
import { randomBytes } from 'crypto';

class FakeKV implements SecureKV {
  store = new Map<string, string>();
  authBehaviour: 'ok' | 'cancel' | 'invalidated' | 'fail-set' = 'ok';
  prompts: string[] = [];

  async get(key: string, o?: SecureKVOptions) {
    if (o?.requireAuth) {
      this.prompts.push(o.prompt ?? '');
      if (this.authBehaviour === 'cancel') throw new AuthCancelledError();
      if (this.authBehaviour === 'invalidated') return null;
    }
    return this.store.get(key) ?? null;
  }
  async set(key: string, value: string, o?: SecureKVOptions) {
    if (o?.requireAuth && this.authBehaviour === 'fail-set') throw new Error('no biometrics');
    this.store.set(key, value);
  }
  async remove(key: string) {
    this.store.delete(key);
  }
}

class FakeFile implements KeyringFile {
  data: { passphrase: string; key: string } | null = null;
  async exists() {
    return this.data !== null;
  }
  async write(passphrase: string, key: string) {
    this.data = { passphrase, key };
  }
  async read(passphrase: string) {
    return this.data && this.data.passphrase === passphrase ? this.data.key : null;
  }
  async remove() {
    this.data = null;
  }
}

function setup() {
  const kv = new FakeKV();
  const file = new FakeFile();
  let now = 1_000_000;
  const keyring = new Keyring({
    kv,
    file,
    randomBytes: n => new Uint8Array(randomBytes(n)),
    now: () => now,
  });
  return { kv, file, keyring, advance: (ms: number) => (now += ms) };
}

describe('passcode rules', () => {
  it('requires 6-digit PINs that are not trivial', () => {
    expect(validatePasscode('12345', 'pin')).toBeTruthy();
    expect(validatePasscode('123456', 'pin')).toBeTruthy();
    expect(validatePasscode('111111', 'pin')).toBeTruthy();
    expect(validatePasscode('654321', 'pin')).toBeTruthy();
    expect(validatePasscode('48a913', 'pin')).toBeTruthy();
    expect(validatePasscode('482913', 'pin')).toBeNull();
  });

  it('requires passwords of 8+ characters', () => {
    expect(validatePasscode('short', 'password')).toBeTruthy();
    expect(validatePasscode('long enough', 'password')).toBeNull();
  });

  it('builds an ASCII passphrase that depends on passcode and pepper', () => {
    const p = keyringPassphrase('ಬೆಂಗಳೂರು 1', 'ab');
    expect(p).toMatch(/^[0-9a-f]+:ab$/);
    expect(keyringPassphrase('482913', 'aa')).not.toBe(keyringPassphrase('482913', 'bb'));
    // NFKC: full-width digits equal ASCII digits
    expect(keyringPassphrase('４８２９１３', 'aa')).toBe(keyringPassphrase('482913', 'aa'));
  });

  it('escalates lockout delays', () => {
    expect(lockoutDelayMs(FREE_ATTEMPTS - 1)).toBe(0);
    expect(lockoutDelayMs(FREE_ATTEMPTS)).toBe(30_000);
    expect(lockoutDelayMs(FREE_ATTEMPTS + 10)).toBe(3_600_000);
  });
});

describe('Keyring', () => {
  it('sets up a vault and unlocks with the passcode', async () => {
    const { keyring, kv } = setup();
    expect(await keyring.status()).toBe('none');
    const key = await keyring.setup('482913', 'pin');
    expect(key).toHaveLength(32);
    expect(await keyring.status()).toBe('ready');
    expect(kv.store.get(KEYS.pepper)).toMatch(/^[0-9a-f]{64}$/);

    const result = await keyring.unlockWithPasscode('482913');
    expect(result.ok && Buffer.from(result.key).equals(Buffer.from(key))).toBe(true);
  });

  it('never stores the passcode or the vault key in plain secure storage', async () => {
    const { keyring, kv } = setup();
    const key = await keyring.setup('482913', 'pin');
    const everything = [...kv.store.values()].join('|');
    expect(everything).not.toContain('482913');
    expect(everything).not.toContain(Buffer.from(key).toString('hex'));
  });

  it('rejects wrong passcodes and locks out after repeated failures', async () => {
    const { keyring, advance } = setup();
    await keyring.setup('482913', 'pin');
    for (let i = 1; i < FREE_ATTEMPTS; i++) {
      expect(await keyring.unlockWithPasscode('000001')).toEqual({
        ok: false,
        reason: 'wrong',
        attemptsBeforeLockout: FREE_ATTEMPTS - i,
      });
    }
    const locked = await keyring.unlockWithPasscode('000001');
    expect(locked).toMatchObject({ ok: false, reason: 'locked' });
    // Even the right passcode is refused while locked out.
    expect(await keyring.unlockWithPasscode('482913')).toMatchObject({ ok: false, reason: 'locked' });
    advance(31_000);
    expect((await keyring.unlockWithPasscode('482913')).ok).toBe(true);
    expect((await keyring.getState())?.failedAttempts).toBe(0);
  });

  it('detects a vault that was restored without this device’s secret', async () => {
    const { keyring, kv } = setup();
    await keyring.setup('482913', 'pin');
    kv.store.delete(KEYS.pepper);
    expect(await keyring.status()).toBe('orphaned');
    expect(await keyring.unlockWithPasscode('482913')).toEqual({ ok: false, reason: 'unavailable' });
  });

  it('unlocks with biometrics once enabled', async () => {
    const { keyring, kv } = setup();
    const key = await keyring.setup('482913', 'pin');
    expect(await keyring.unlockWithBiometrics('Unlock')).toEqual({ ok: false, reason: 'unavailable' });
    expect(await keyring.enableBiometrics(key, 'Enable')).toBe(true);
    const result = await keyring.unlockWithBiometrics('Unlock Forward');
    expect(result.ok && Buffer.from(result.key).equals(Buffer.from(key))).toBe(true);
    expect(kv.prompts).toContain('Unlock Forward');
  });

  it('reports cancellation and invalidation of biometrics', async () => {
    const { keyring, kv } = setup();
    const key = await keyring.setup('482913', 'pin');
    await keyring.enableBiometrics(key, 'Enable');
    kv.authBehaviour = 'cancel';
    expect(await keyring.unlockWithBiometrics('x')).toEqual({ ok: false, reason: 'cancelled' });
    expect((await keyring.getState())?.biometrics).toBe(true);
    kv.authBehaviour = 'invalidated';
    expect(await keyring.unlockWithBiometrics('x')).toEqual({ ok: false, reason: 'invalidated' });
    expect((await keyring.getState())?.biometrics).toBe(false);
    // Passcode still works.
    expect((await keyring.unlockWithPasscode('482913')).ok).toBe(true);
  });

  it('handles biometrics that cannot be enabled', async () => {
    const { keyring, kv } = setup();
    const key = await keyring.setup('482913', 'pin');
    kv.authBehaviour = 'fail-set';
    expect(await keyring.enableBiometrics(key, 'Enable')).toBe(false);
    expect((await keyring.getState())?.biometrics).toBe(false);
  });

  it('changes the passcode without changing the vault key', async () => {
    const { keyring } = setup();
    const key = await keyring.setup('482913', 'pin');
    await keyring.changePasscode(key, 'correct horse battery', 'password');
    expect((await keyring.unlockWithPasscode('482913')).ok).toBe(false);
    const result = await keyring.unlockWithPasscode('correct horse battery');
    expect(result.ok && Buffer.from(result.key).equals(Buffer.from(key))).toBe(true);
    expect((await keyring.getState())?.passcodeKind).toBe('password');
  });

  it('erases everything', async () => {
    const { keyring, kv } = setup();
    const key = await keyring.setup('482913', 'pin');
    await keyring.enableBiometrics(key, 'Enable');
    await keyring.erase();
    expect(kv.store.size).toBe(0);
    expect(await keyring.status()).toBe('none');
  });

  it('cleans up a stale biometric key from a previous install', async () => {
    const { keyring, kv } = setup();
    kv.store.set(KEYS.bioKey, 'stale');
    await keyring.setup('482913', 'pin');
    expect(kv.store.has(KEYS.bioKey)).toBe(false);
  });
});

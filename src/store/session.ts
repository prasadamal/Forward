import { Keyring } from '../security/keyring';
import { SecureStoreKV, SqlCipherKeyringFile } from '../security/keyringNative';
import { VaultRepository } from '../db/repository';
import { ExpoDatabase } from '../db/expoAdapter';
import { deleteVaultDatabase, openVaultDatabase } from '../db/vaultDatabase';
import { newId, secureRandomBytes } from '../utils/ids';
import { clearOpenedFiles } from '../ingest/media';

/**
 * The open vault: database connection, repository and the vault key. Lives
 * outside React state so secrets never end up in dev tools or re-render diffs.
 */
export interface Session {
  db: ExpoDatabase;
  repo: VaultRepository;
  key: Uint8Array;
}

export const keyring = new Keyring({
  kv: new SecureStoreKV(),
  file: new SqlCipherKeyringFile(),
  randomBytes: secureRandomBytes,
  now: () => Date.now(),
});

let current: Session | null = null;

export async function openSession(key: Uint8Array): Promise<Session> {
  if (current) await closeSession();
  const db = await openVaultDatabase(key);
  current = { db, repo: new VaultRepository(db, { newId, now: () => Date.now() }), key };
  return current;
}

export function getSession(): Session {
  if (!current) throw new Error('Vault is locked');
  return current;
}

export function hasSession(): boolean {
  return current !== null;
}

export async function closeSession(): Promise<void> {
  const s = current;
  current = null;
  clearOpenedFiles();
  if (s) {
    s.key.fill(0);
    await s.db.close().catch(() => undefined);
  }
}

export async function eraseEverything(): Promise<void> {
  await closeSession();
  await deleteVaultDatabase();
  await keyring.erase();
}

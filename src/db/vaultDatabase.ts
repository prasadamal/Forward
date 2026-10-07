import * as SQLite from 'expo-sqlite';
import { ExpoDatabase, openExpoDatabase } from './expoAdapter';
import { configureConnection, migrate } from './schema';
import { bytesToHex } from '../utils/encoding';
import { databaseFile } from '../security/keyringNative';

export const VAULT_DB = 'vault.db';

export class EncryptionUnavailableError extends Error {
  constructor() {
    super('Database encryption (SQLCipher) is not available in this build. Use a Forward development or release build, not Expo Go.');
    this.name = 'EncryptionUnavailableError';
  }
}

/** Refuses to continue unless the SQLite library is SQLCipher, so data is never written unencrypted. */
export async function assertSqlCipher(db: { get<T>(sql: string): Promise<T | null> }): Promise<void> {
  const row = await db.get<{ cipher_version: string }>('PRAGMA cipher_version;').catch(() => null);
  if (!row?.cipher_version) throw new EncryptionUnavailableError();
}

export function vaultExists(): boolean {
  return databaseFile(VAULT_DB).exists;
}

/** Opens (creating if needed) the SQLCipher-encrypted vault with a 256-bit raw key. */
export async function openVaultDatabase(key: Uint8Array): Promise<ExpoDatabase> {
  if (key.length !== 32) throw new Error('Invalid vault key');
  const db = await openExpoDatabase(VAULT_DB);
  try {
    await assertSqlCipher(db);
    // Raw-key syntax skips SQLCipher's passphrase KDF: the key is already random.
    await db.exec(`PRAGMA key = "x'${bytesToHex(key)}'";`);
    // Fails with "file is not a database" if the key is wrong.
    await db.get('SELECT count(*) AS n FROM sqlite_master');
    await configureConnection(db);
    await db.exec('PRAGMA journal_mode = WAL;');
    await db.exec('PRAGMA secure_delete = ON;');
    await migrate(db);
    return db;
  } catch (e) {
    await db.close().catch(() => undefined);
    throw e;
  }
}

export async function deleteVaultDatabase(): Promise<void> {
  if (!vaultExists()) return;
  await SQLite.deleteDatabaseAsync(VAULT_DB);
  for (const suffix of ['-wal', '-shm', '-journal']) {
    const f = databaseFile(VAULT_DB + suffix);
    if (f.exists) f.delete();
  }
}

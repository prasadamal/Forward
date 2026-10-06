import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';
import { File } from 'expo-file-system';
import { AuthCancelledError, KeyringFile, SecureKV, SecureKVOptions } from './keyring';

function storeOptions(o?: SecureKVOptions): SecureStore.SecureStoreOptions {
  if (o?.requireAuth) {
    return {
      requireAuthentication: true,
      authenticationPrompt: o.prompt,
      keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
    };
  }
  return { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
}

function isCancel(e: unknown): boolean {
  const message = e instanceof Error ? e.message : String(e);
  return /cancel/i.test(message);
}

/** Keychain (iOS) / Keystore-backed storage (Android). */
export class SecureStoreKV implements SecureKV {
  async get(key: string, o?: SecureKVOptions): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(key, storeOptions(o));
    } catch (e) {
      if (isCancel(e)) throw new AuthCancelledError();
      throw e;
    }
  }

  async set(key: string, value: string, o?: SecureKVOptions): Promise<void> {
    try {
      await SecureStore.setItemAsync(key, value, storeOptions(o));
    } catch (e) {
      if (isCancel(e)) throw new AuthCancelledError();
      throw e;
    }
  }

  async remove(key: string, o?: SecureKVOptions): Promise<void> {
    await SecureStore.deleteItemAsync(key, storeOptions(o));
  }
}

const KEYRING_DB = 'keyring.db';
const KEYRING_NEXT_DB = 'keyring.next.db';

export function databaseFile(name: string): File {
  const dir = SQLite.defaultDatabaseDirectory as string;
  const uri = dir.startsWith('file://') ? dir : `file://${dir}`;
  return new File(`${uri.replace(/\/+$/, '')}/${name}`);
}

async function deleteDatabaseIfExists(name: string): Promise<void> {
  if (!databaseFile(name).exists) return;
  await SQLite.deleteDatabaseAsync(name);
}

async function readKey(name: string, passphrase: string): Promise<string | null> {
  if (!databaseFile(name).exists) return null;
  const db = await SQLite.openDatabaseAsync(name, { useNewConnection: true });
  try {
    await db.execAsync(`PRAGMA key = '${passphrase}';`);
    const row = await db.getFirstAsync<{ vault_key: string }>('SELECT vault_key FROM keyring WHERE id = 1');
    return row?.vault_key ?? null;
  } catch {
    // SQLITE_NOTADB: wrong passphrase.
    return null;
  } finally {
    await db.closeAsync().catch(() => undefined);
  }
}

/**
 * The keyring is a tiny SQLCipher database. SQLCipher derives its encryption
 * key from the passphrase with PBKDF2-HMAC-SHA512 (256,000 iterations) and
 * authenticates every page with HMAC-SHA512, so a wrong passphrase fails cleanly.
 */
export class SqlCipherKeyringFile implements KeyringFile {
  /** Finishes a replacement that was interrupted (e.g. the app was killed). */
  private async recover(): Promise<void> {
    const next = databaseFile(KEYRING_NEXT_DB);
    if (!next.exists) return;
    if (databaseFile(KEYRING_DB).exists) {
      // The new keyring was never committed; keep the current one.
      await deleteDatabaseIfExists(KEYRING_NEXT_DB);
    } else {
      next.move(databaseFile(KEYRING_DB));
    }
  }

  async exists(): Promise<boolean> {
    await this.recover();
    return databaseFile(KEYRING_DB).exists;
  }

  async write(passphrase: string, vaultKeyHex: string): Promise<void> {
    await this.recover();
    await deleteDatabaseIfExists(KEYRING_NEXT_DB);
    const db = await SQLite.openDatabaseAsync(KEYRING_NEXT_DB, { useNewConnection: true });
    try {
      await db.execAsync(`PRAGMA key = '${passphrase}';`);
      await db.execAsync(
        'CREATE TABLE keyring (id INTEGER PRIMARY KEY CHECK (id = 1), vault_key TEXT NOT NULL);',
      );
      await db.runAsync('INSERT INTO keyring (id, vault_key) VALUES (1, ?)', [vaultKeyHex]);
    } finally {
      await db.closeAsync();
    }
    if ((await readKey(KEYRING_NEXT_DB, passphrase)) !== vaultKeyHex) {
      await deleteDatabaseIfExists(KEYRING_NEXT_DB);
      throw new Error('Could not verify the new keyring');
    }
    await deleteDatabaseIfExists(KEYRING_DB);
    databaseFile(KEYRING_NEXT_DB).move(databaseFile(KEYRING_DB));
  }

  async read(passphrase: string): Promise<string | null> {
    await this.recover();
    return readKey(KEYRING_DB, passphrase);
  }

  async remove(): Promise<void> {
    await deleteDatabaseIfExists(KEYRING_NEXT_DB);
    await deleteDatabaseIfExists(KEYRING_DB);
  }
}

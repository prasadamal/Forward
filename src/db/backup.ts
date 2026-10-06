import { SQLDatabase } from './types';
import { SCHEMA_VERSION } from './schema';
import { bytesToHex, utf8Encode } from '../utils/encoding';

/**
 * Encrypted backups.
 *
 * A backup is a complete SQLCipher database encrypted with a password the user
 * chooses (PBKDF2-HMAC-SHA512, 256k rounds), produced natively by
 * `sqlcipher_export`. The file can be kept anywhere (Files, Drive, a laptop);
 * without the password it is unreadable. Restoring merges it into the current
 * vault, so it also works for moving to a new phone.
 */

export const BACKUP_EXTENSION = 'forward';
export const MIN_BACKUP_PASSWORD = 8;

export class WrongBackupPasswordError extends Error {
  constructor() {
    super('Wrong password, or this file is not a Forward backup.');
    this.name = 'WrongBackupPasswordError';
  }
}

export function backupPassphrase(password: string): string {
  let normalized = password;
  try {
    normalized = password.normalize('NFKC');
  } catch {
    // keep as-is
  }
  return bytesToHex(utf8Encode(normalized));
}

function quotePath(path: string): string {
  return `'${path.replace(/^file:\/\//, '').replace(/'/g, "''")}'`;
}

/** Writes an encrypted copy of the whole vault to `destPath` (a file path or file:// URI that doesn't exist yet). */
export async function exportBackup(db: SQLDatabase, password: string, destPath: string): Promise<void> {
  if (password.length < MIN_BACKUP_PASSWORD) {
    throw new Error(`Use at least ${MIN_BACKUP_PASSWORD} characters for the backup password.`);
  }
  await db.exec(`ATTACH DATABASE ${quotePath(destPath)} AS backup KEY '${backupPassphrase(password)}';`);
  try {
    await db.exec(`SELECT sqlcipher_export('backup');`);
    await db.exec(`PRAGMA backup.user_version = ${SCHEMA_VERSION};`);
  } finally {
    await db.exec('DETACH DATABASE backup;');
  }
}

export interface MergeResult {
  items: number;
  folders: number;
}

interface FolderRow {
  id: string;
  parent_id: string | null;
  name: string;
}

/**
 * Merges data from an attached database (`schema`) into main. Folders with the
 * same name in the same place are merged rather than duplicated; items keep
 * their ids, so restoring the same backup twice changes nothing.
 */
export async function mergeFromAttached(db: SQLDatabase, schema: string, now: number): Promise<MergeResult> {
  let folders = 0;
  let items = 0;
  await db.transaction(async () => {
    await db.exec('PRAGMA defer_foreign_keys = ON;');

    const existing = await db.all<FolderRow>('SELECT id, parent_id, name FROM main.folders');
    const existingIds = new Set(existing.map(f => f.id));
    const incoming = await db.all<FolderRow & Record<string, unknown>>(
      `SELECT id, parent_id, name, emoji, color, keywords, auto, smart_key, created_at, updated_at FROM ${schema}.folders`,
    );
    const incomingIds = new Set(incoming.map(f => f.id));
    const idMap = new Map<string, string>();

    // Parents before children.
    const byParent = new Map<string | null, typeof incoming>();
    for (const f of incoming) {
      const parent = f.parent_id && incomingIds.has(f.parent_id) ? f.parent_id : null;
      byParent.set(parent, [...(byParent.get(parent) ?? []), f]);
    }
    const queue: (string | null)[] = [null];
    const visited = new Set<string>();
    while (queue.length) {
      const parentKey = queue.shift()!;
      for (const f of byParent.get(parentKey) ?? []) {
        if (visited.has(f.id)) continue;
        visited.add(f.id);
        queue.push(f.id);
        const mappedParent = parentKey === null ? null : idMap.get(parentKey) ?? null;
        if (existingIds.has(f.id)) {
          idMap.set(f.id, f.id);
          continue;
        }
        const twin = existing.find(
          e => (e.parent_id ?? null) === mappedParent && e.name.trim().toLowerCase() === String(f.name).trim().toLowerCase(),
        );
        if (twin) {
          idMap.set(f.id, twin.id);
          continue;
        }
        await db.run(
          `INSERT INTO main.folders (id, parent_id, name, emoji, color, keywords, auto, smart_key, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            f.id,
            mappedParent,
            f.name,
            String(f.emoji ?? '📁'),
            String(f.color ?? '#7C6FE0'),
            String(f.keywords ?? '[]'),
            Number(f.auto ?? 0),
            (f.smart_key as string | null) ?? null,
            Number(f.created_at ?? now),
            Number(f.updated_at ?? now),
          ],
        );
        existing.push({ id: f.id, parent_id: mappedParent, name: f.name });
        existingIds.add(f.id);
        idMap.set(f.id, f.id);
        folders++;
      }
    }

    const before = await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM main.items');
    await db.exec(
      `INSERT OR IGNORE INTO main.items (id, type, title, body, url, url_key, source, tags, meta, secret, pinned, sensitive,
         filing, has_thumb, has_blob, created_at, updated_at, trashed_at)
       SELECT id, type, title, body, url, url_key, source, tags, meta, secret, pinned, sensitive,
         filing, has_thumb, has_blob, created_at, updated_at, trashed_at FROM ${schema}.items;`,
    );
    const after = await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM main.items');
    items = (after?.n ?? 0) - (before?.n ?? 0);

    const memberships = await db.all<{ item_id: string; folder_id: string; added_at: number }>(
      `SELECT item_id, folder_id, added_at FROM ${schema}.item_folders`,
    );
    for (const m of memberships) {
      const folderId = idMap.get(m.folder_id);
      if (!folderId) continue;
      await db.run(
        `INSERT OR IGNORE INTO main.item_folders (item_id, folder_id, added_at)
         SELECT ?, ?, ? WHERE EXISTS (SELECT 1 FROM main.items WHERE id = ?)`,
        [m.item_id, folderId, m.added_at ?? now, m.item_id],
      );
    }

    await db.exec(
      `INSERT OR IGNORE INTO main.blobs (item_id, kind, mime, width, height, size, data)
       SELECT item_id, kind, mime, width, height, size, data FROM ${schema}.blobs
       WHERE item_id IN (SELECT id FROM main.items);`,
    );
  });
  return { items, folders };
}

/** Restores an encrypted backup file into the open vault. */
export async function importBackup(db: SQLDatabase, password: string, srcPath: string, now: number): Promise<MergeResult> {
  await db.exec(`ATTACH DATABASE ${quotePath(srcPath)} AS bk KEY '${backupPassphrase(password)}';`);
  try {
    try {
      await db.get('SELECT count(*) AS n FROM bk.sqlite_master');
    } catch {
      throw new WrongBackupPasswordError();
    }
    const version = await db.get<{ user_version: number }>('PRAGMA bk.user_version;');
    const v = version?.user_version ?? 0;
    if (v === 0) throw new WrongBackupPasswordError();
    if (v > SCHEMA_VERSION) throw new Error('This backup was made by a newer version of Forward. Update the app first.');
    return await mergeFromAttached(db, 'bk', now);
  } finally {
    await db.exec('DETACH DATABASE bk;').catch(() => undefined);
  }
}

import {
  BlobKind,
  DEFAULT_SETTINGS,
  Folder,
  Item,
  ItemMeta,
  ItemSecret,
  ItemType,
  Source,
  StoredBlob,
  VaultSettings,
} from '../types';
import { normalizeUrl } from '../ingest/urls';
import { buildTree, canMoveFolder, getDescendantIds } from '../folders/tree';
import { folderColor } from '../constants/palette';
import { AsyncQueue, SQLDatabase, SQLValue } from './types';

export interface NewItemInput {
  id?: string;
  type: ItemType;
  title: string;
  text?: string;
  url?: string;
  source: Source;
  tags?: string[];
  folderIds?: string[];
  pinned?: boolean;
  sensitive?: boolean;
  filing?: Item['filing'];
  meta?: ItemMeta;
  secret?: ItemSecret;
  blobs?: { kind: BlobKind; blob: StoredBlob }[];
  createdAt?: number;
  updatedAt?: number;
  trashedAt?: number;
}

export type ItemPatch = Partial<
  Pick<Item, 'title' | 'text' | 'url' | 'source' | 'tags' | 'pinned' | 'sensitive' | 'filing' | 'meta' | 'type'>
>;

export interface NewFolderInput {
  id?: string;
  parentId: string | null;
  name: string;
  emoji?: string;
  color?: string;
  keywords?: string[];
  auto?: boolean;
  smartKey?: string;
  createdAt?: number;
}

export type FolderPatch = Partial<Pick<Folder, 'name' | 'emoji' | 'color' | 'keywords' | 'auto' | 'smartKey'>>;

interface ItemRow {
  id: string;
  type: string;
  title: string;
  body: string;
  url: string | null;
  source: string;
  tags: string;
  meta: string;
  pinned: number;
  sensitive: number;
  filing: string;
  has_thumb: number;
  has_blob: number;
  created_at: number;
  updated_at: number;
  trashed_at: number | null;
}

interface FolderRow {
  id: string;
  parent_id: string | null;
  name: string;
  emoji: string;
  color: string;
  keywords: string;
  auto: number;
  smart_key: string | null;
  created_at: number;
  updated_at: number;
}

const ITEM_COLUMNS =
  'id, type, title, body, url, source, tags, meta, pinned, sensitive, filing, has_thumb, has_blob, created_at, updated_at, trashed_at';

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    const v = JSON.parse(raw);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

function stringArray(raw: string): string[] {
  const v = parseJson<unknown>(raw, []);
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

function toItem(row: ItemRow, folderIds: string[]): Item {
  return {
    id: row.id,
    type: row.type as ItemType,
    title: row.title,
    text: row.body,
    url: row.url ?? undefined,
    source: row.source as Source,
    tags: stringArray(row.tags),
    folderIds,
    pinned: row.pinned === 1,
    sensitive: row.sensitive === 1,
    filing: row.filing === 'manual' ? 'manual' : 'auto',
    meta: parseJson<ItemMeta>(row.meta, {}),
    hasThumb: row.has_thumb === 1,
    hasBlob: row.has_blob === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    trashedAt: row.trashed_at ?? undefined,
  };
}

function toFolder(row: FolderRow): Folder {
  return {
    id: row.id,
    parentId: row.parent_id,
    name: row.name,
    emoji: row.emoji,
    color: row.color,
    keywords: stringArray(row.keywords),
    auto: row.auto === 1,
    smartKey: row.smart_key ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function placeholders(n: number): string {
  return new Array(n).fill('?').join(', ');
}

export interface RepositoryDeps {
  newId: () => string;
  now: () => number;
}

/**
 * All reads and writes of vault data. Writes go through a queue so that
 * transactions on the single connection never interleave.
 */
export class VaultRepository {
  private readonly writes = new AsyncQueue();

  constructor(
    readonly db: SQLDatabase,
    private readonly deps: RepositoryDeps,
  ) {}

  private write<T>(task: () => Promise<T>): Promise<T> {
    return this.writes.run(task);
  }

  /** Runs a multi-step operation (backup, import) with no other writes interleaved. */
  exclusive<T>(task: (db: SQLDatabase) => Promise<T>): Promise<T> {
    return this.writes.run(() => task(this.db));
  }

  // ── Folders ──────────────────────────────────────────────────────────────

  async listFolders(): Promise<Folder[]> {
    const rows = await this.db.all<FolderRow>('SELECT * FROM folders ORDER BY created_at');
    return rows.map(toFolder);
  }

  async getFolder(id: string): Promise<Folder | null> {
    const row = await this.db.get<FolderRow>('SELECT * FROM folders WHERE id = ?', [id]);
    return row ? toFolder(row) : null;
  }

  createFolder(input: NewFolderInput): Promise<Folder> {
    return this.write(async () => {
      const now = input.createdAt ?? this.deps.now();
      const folder: Folder = {
        id: input.id ?? this.deps.newId(),
        parentId: input.parentId,
        name: input.name.trim() || 'New folder',
        emoji: input.emoji ?? '📁',
        color: input.color ?? folderColor(input.name),
        keywords: input.keywords ?? [],
        auto: input.auto ?? false,
        smartKey: input.smartKey,
        createdAt: now,
        updatedAt: now,
      };
      await this.db.run(
        `INSERT INTO folders (id, parent_id, name, emoji, color, keywords, auto, smart_key, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          folder.id,
          folder.parentId,
          folder.name,
          folder.emoji,
          folder.color,
          JSON.stringify(folder.keywords),
          folder.auto ? 1 : 0,
          folder.smartKey ?? null,
          folder.createdAt,
          folder.updatedAt,
        ],
      );
      return folder;
    });
  }

  updateFolder(id: string, patch: FolderPatch): Promise<void> {
    return this.write(async () => {
      const sets: string[] = [];
      const params: SQLValue[] = [];
      if (patch.name !== undefined) {
        sets.push('name = ?');
        params.push(patch.name.trim() || 'Untitled');
      }
      if (patch.emoji !== undefined) {
        sets.push('emoji = ?');
        params.push(patch.emoji);
      }
      if (patch.color !== undefined) {
        sets.push('color = ?');
        params.push(patch.color);
      }
      if (patch.keywords !== undefined) {
        sets.push('keywords = ?');
        params.push(JSON.stringify(patch.keywords));
      }
      if (patch.auto !== undefined) {
        sets.push('auto = ?');
        params.push(patch.auto ? 1 : 0);
      }
      if (patch.smartKey !== undefined) {
        sets.push('smart_key = ?');
        params.push(patch.smartKey || null);
      }
      if (!sets.length) return;
      sets.push('updated_at = ?');
      params.push(this.deps.now(), id);
      await this.db.run(`UPDATE folders SET ${sets.join(', ')} WHERE id = ?`, params);
    });
  }

  moveFolder(id: string, newParentId: string | null): Promise<void> {
    return this.write(async () => {
      const tree = buildTree(await this.listFolders());
      if (!canMoveFolder(tree, id, newParentId)) {
        throw new Error('A folder can’t be moved inside itself.');
      }
      await this.db.run('UPDATE folders SET parent_id = ?, updated_at = ? WHERE id = ?', [
        newParentId,
        this.deps.now(),
        id,
      ]);
    });
  }

  /**
   * Deletes a folder and all of its subfolders.
   * - `keep`: items stay in the vault (they lose these folders; unfiled ones go to the Inbox).
   * - `trash`: items that were only filed inside this folder tree move to the Trash.
   */
  deleteFolder(id: string, items: 'keep' | 'trash'): Promise<{ folderIds: string[]; trashedItemIds: string[] }> {
    return this.write(async () => {
      const tree = buildTree(await this.listFolders());
      if (!tree.byId.has(id)) return { folderIds: [], trashedItemIds: [] };
      const folderIds = [id, ...getDescendantIds(tree, id)];
      const ph = placeholders(folderIds.length);
      let trashedItemIds: string[] = [];
      await this.db.transaction(async () => {
        if (items === 'trash') {
          const rows = await this.db.all<{ item_id: string }>(
            `SELECT item_id FROM item_folders GROUP BY item_id
             HAVING SUM(CASE WHEN folder_id IN (${ph}) THEN 1 ELSE 0 END) = COUNT(*)
                AND SUM(CASE WHEN folder_id IN (${ph}) THEN 1 ELSE 0 END) > 0`,
            [...folderIds, ...folderIds],
          );
          trashedItemIds = rows.map(r => r.item_id);
          if (trashedItemIds.length) {
            await this.db.run(
              `UPDATE items SET trashed_at = ?, pinned = 0 WHERE id IN (${placeholders(trashedItemIds.length)}) AND trashed_at IS NULL`,
              [this.deps.now(), ...trashedItemIds],
            );
          }
        }
        await this.db.run(`DELETE FROM item_folders WHERE folder_id IN (${ph})`, folderIds);
        // Children first is unnecessary with ON DELETE CASCADE, but explicit is predictable.
        await this.db.run(`DELETE FROM folders WHERE id IN (${ph})`, folderIds);
      });
      return { folderIds, trashedItemIds };
    });
  }

  // ── Items ────────────────────────────────────────────────────────────────

  private async folderMap(itemIds?: string[]): Promise<Map<string, string[]>> {
    const rows = itemIds
      ? await this.db.all<{ item_id: string; folder_id: string }>(
          `SELECT item_id, folder_id FROM item_folders WHERE item_id IN (${placeholders(itemIds.length)}) ORDER BY added_at`,
          itemIds,
        )
      : await this.db.all<{ item_id: string; folder_id: string }>(
          'SELECT item_id, folder_id FROM item_folders ORDER BY added_at',
        );
    const map = new Map<string, string[]>();
    for (const r of rows) map.set(r.item_id, [...(map.get(r.item_id) ?? []), r.folder_id]);
    return map;
  }

  async listItems(): Promise<Item[]> {
    const [rows, folders] = await Promise.all([
      this.db.all<ItemRow>(`SELECT ${ITEM_COLUMNS} FROM items ORDER BY created_at DESC`),
      this.folderMap(),
    ]);
    return rows.map(r => toItem(r, folders.get(r.id) ?? []));
  }

  async getItem(id: string): Promise<Item | null> {
    const row = await this.db.get<ItemRow>(`SELECT ${ITEM_COLUMNS} FROM items WHERE id = ?`, [id]);
    if (!row) return null;
    const folders = await this.folderMap([id]);
    return toItem(row, folders.get(id) ?? []);
  }

  /** A non-trashed item already saved with the same (normalised) link. */
  async findByUrl(url: string): Promise<Item | null> {
    const row = await this.db.get<ItemRow>(
      `SELECT ${ITEM_COLUMNS} FROM items WHERE url_key = ? AND trashed_at IS NULL ORDER BY created_at DESC LIMIT 1`,
      [normalizeUrl(url)],
    );
    if (!row) return null;
    const folders = await this.folderMap([row.id]);
    return toItem(row, folders.get(row.id) ?? []);
  }

  createItem(input: NewItemInput): Promise<Item> {
    return this.write(async () => {
      const now = this.deps.now();
      const id = input.id ?? this.deps.newId();
      const createdAt = input.createdAt ?? now;
      const updatedAt = input.updatedAt ?? createdAt;
      const folderIds = [...new Set(input.folderIds ?? [])];
      const original = input.blobs?.find(b => b.kind === 'original');
      const thumb = input.blobs?.find(b => b.kind === 'thumb');
      await this.db.transaction(async () => {
        await this.db.run(
          `INSERT INTO items (id, type, title, body, url, url_key, source, tags, meta, secret, pinned, sensitive, filing,
                              has_thumb, has_blob, created_at, updated_at, trashed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            input.type,
            input.title,
            input.text ?? '',
            input.url ?? null,
            input.url ? normalizeUrl(input.url) : null,
            input.source,
            JSON.stringify(input.tags ?? []),
            JSON.stringify(input.meta ?? {}),
            input.secret ? JSON.stringify(input.secret) : null,
            input.pinned ? 1 : 0,
            input.sensitive ? 1 : 0,
            input.filing ?? 'auto',
            thumb ? 1 : 0,
            original ? 1 : 0,
            createdAt,
            updatedAt,
            input.trashedAt ?? null,
          ],
        );
        for (const fid of folderIds) {
          await this.db.run('INSERT OR IGNORE INTO item_folders (item_id, folder_id, added_at) VALUES (?, ?, ?)', [
            id,
            fid,
            now,
          ]);
        }
        for (const b of input.blobs ?? []) await this.insertBlob(id, b.kind, b.blob);
      });
      const item = await this.getItem(id);
      if (!item) throw new Error('Item was not saved');
      return item;
    });
  }

  updateItem(id: string, patch: ItemPatch): Promise<void> {
    return this.write(async () => {
      const sets: string[] = [];
      const params: SQLValue[] = [];
      const set = (col: string, value: SQLValue) => {
        sets.push(`${col} = ?`);
        params.push(value);
      };
      if (patch.title !== undefined) set('title', patch.title);
      if (patch.text !== undefined) set('body', patch.text);
      if (patch.type !== undefined) set('type', patch.type);
      if (patch.url !== undefined) {
        set('url', patch.url || null);
        set('url_key', patch.url ? normalizeUrl(patch.url) : null);
      }
      if (patch.source !== undefined) set('source', patch.source);
      if (patch.tags !== undefined) set('tags', JSON.stringify(patch.tags));
      if (patch.meta !== undefined) set('meta', JSON.stringify(patch.meta));
      if (patch.pinned !== undefined) set('pinned', patch.pinned ? 1 : 0);
      if (patch.sensitive !== undefined) set('sensitive', patch.sensitive ? 1 : 0);
      if (patch.filing !== undefined) set('filing', patch.filing);
      if (!sets.length) return;
      set('updated_at', this.deps.now());
      params.push(id);
      await this.db.run(`UPDATE items SET ${sets.join(', ')} WHERE id = ?`, params);
    });
  }

  /** Replaces the item's folders. */
  setItemFolders(id: string, folderIds: string[]): Promise<void> {
    return this.write(async () => {
      const unique = [...new Set(folderIds)];
      await this.db.transaction(async () => {
        if (unique.length) {
          await this.db.run(
            `DELETE FROM item_folders WHERE item_id = ? AND folder_id NOT IN (${placeholders(unique.length)})`,
            [id, ...unique],
          );
        } else {
          await this.db.run('DELETE FROM item_folders WHERE item_id = ?', [id]);
        }
        const now = this.deps.now();
        for (const fid of unique) {
          await this.db.run('INSERT OR IGNORE INTO item_folders (item_id, folder_id, added_at) VALUES (?, ?, ?)', [
            id,
            fid,
            now,
          ]);
        }
        await this.db.run('UPDATE items SET updated_at = ? WHERE id = ?', [now, id]);
      });
    });
  }

  trashItems(ids: string[]): Promise<void> {
    if (!ids.length) return Promise.resolve();
    return this.write(async () => {
      await this.db.run(
        `UPDATE items SET trashed_at = ?, pinned = 0 WHERE id IN (${placeholders(ids.length)}) AND trashed_at IS NULL`,
        [this.deps.now(), ...ids],
      );
    });
  }

  restoreItems(ids: string[]): Promise<void> {
    if (!ids.length) return Promise.resolve();
    return this.write(async () => {
      await this.db.run(`UPDATE items SET trashed_at = NULL, updated_at = ? WHERE id IN (${placeholders(ids.length)})`, [
        this.deps.now(),
        ...ids,
      ]);
    });
  }

  /** Permanently deletes items and their files. */
  deleteItems(ids: string[]): Promise<void> {
    if (!ids.length) return Promise.resolve();
    return this.write(async () => {
      const ph = placeholders(ids.length);
      await this.db.transaction(async () => {
        await this.db.run(`DELETE FROM blobs WHERE item_id IN (${ph})`, ids);
        await this.db.run(`DELETE FROM item_folders WHERE item_id IN (${ph})`, ids);
        await this.db.run(`DELETE FROM items WHERE id IN (${ph})`, ids);
      });
    });
  }

  /** Permanently deletes trashed items (older than `olderThan` ms ago, if given). Returns their ids. */
  async purgeTrash(olderThanMs?: number): Promise<string[]> {
    const cutoff = olderThanMs === undefined ? Number.MAX_SAFE_INTEGER : this.deps.now() - olderThanMs;
    const rows = await this.db.all<{ id: string }>(
      'SELECT id FROM items WHERE trashed_at IS NOT NULL AND trashed_at <= ?',
      [cutoff],
    );
    const ids = rows.map(r => r.id);
    await this.deleteItems(ids);
    return ids;
  }

  // ── Secrets & blobs ──────────────────────────────────────────────────────

  async getSecret(id: string): Promise<ItemSecret | null> {
    const row = await this.db.get<{ secret: string | null }>('SELECT secret FROM items WHERE id = ?', [id]);
    return row?.secret ? parseJson<ItemSecret | null>(row.secret, null) : null;
  }

  setSecret(id: string, secret: ItemSecret | null): Promise<void> {
    return this.write(async () => {
      await this.db.run('UPDATE items SET secret = ?, updated_at = ? WHERE id = ?', [
        secret ? JSON.stringify(secret) : null,
        this.deps.now(),
        id,
      ]);
    });
  }

  private async insertBlob(itemId: string, kind: BlobKind, blob: StoredBlob): Promise<void> {
    await this.db.run(
      `INSERT OR REPLACE INTO blobs (item_id, kind, mime, width, height, size, data) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [itemId, kind, blob.mime, blob.width ?? null, blob.height ?? null, blob.data.length, blob.data],
    );
  }

  putBlob(itemId: string, kind: BlobKind, blob: StoredBlob): Promise<void> {
    return this.write(async () => {
      await this.db.transaction(async () => {
        await this.insertBlob(itemId, kind, blob);
        const col = kind === 'thumb' ? 'has_thumb' : 'has_blob';
        await this.db.run(`UPDATE items SET ${col} = 1 WHERE id = ?`, [itemId]);
      });
    });
  }

  async getBlob(itemId: string, kind: BlobKind): Promise<StoredBlob | null> {
    const row = await this.db.get<{ mime: string; width: number | null; height: number | null; data: Uint8Array }>(
      'SELECT mime, width, height, data FROM blobs WHERE item_id = ? AND kind = ?',
      [itemId, kind],
    );
    if (!row) return null;
    return { mime: row.mime, data: row.data, width: row.width ?? undefined, height: row.height ?? undefined };
  }

  // ── Settings & metadata ──────────────────────────────────────────────────

  async getSettings(): Promise<VaultSettings> {
    const rows = await this.db.all<{ key: string; value: string }>('SELECT key, value FROM settings');
    const stored: Record<string, unknown> = {};
    for (const r of rows) stored[r.key] = parseJson<unknown>(r.value, undefined);
    const out = { ...DEFAULT_SETTINGS };
    for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof VaultSettings)[]) {
      const v = stored[key];
      if (typeof v === typeof DEFAULT_SETTINGS[key]) (out as Record<string, unknown>)[key] = v;
    }
    return out;
  }

  saveSettings(settings: Partial<VaultSettings>): Promise<void> {
    return this.write(async () => {
      await this.db.transaction(async () => {
        for (const [key, value] of Object.entries(settings)) {
          await this.db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, JSON.stringify(value)]);
        }
      });
    });
  }

  async getMeta(key: string): Promise<string | null> {
    const row = await this.db.get<{ value: string }>('SELECT value FROM vault_meta WHERE key = ?', [key]);
    return row?.value ?? null;
  }

  setMeta(key: string, value: string): Promise<void> {
    return this.write(async () => {
      await this.db.run('INSERT OR REPLACE INTO vault_meta (key, value) VALUES (?, ?)', [key, value]);
    });
  }

  async stats(): Promise<{ items: number; folders: number; files: number; bytes: number }> {
    const items = await this.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM items WHERE trashed_at IS NULL');
    const folders = await this.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM folders');
    const blobs = await this.db.get<{ n: number; bytes: number | null }>(
      "SELECT COUNT(*) AS n, SUM(size) AS bytes FROM blobs WHERE kind = 'original'",
    );
    return { items: items?.n ?? 0, folders: folders?.n ?? 0, files: blobs?.n ?? 0, bytes: blobs?.bytes ?? 0 };
  }
}

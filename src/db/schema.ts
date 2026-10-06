import { SQLDatabase } from './types';

/**
 * Schema migrations, applied in order and tracked with PRAGMA user_version.
 * Never edit a released migration; add a new one instead.
 */
const MIGRATIONS: string[] = [
  // v1
  `
  CREATE TABLE IF NOT EXISTS folders (
    id TEXT PRIMARY KEY NOT NULL,
    parent_id TEXT REFERENCES folders(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    emoji TEXT NOT NULL DEFAULT '📁',
    color TEXT NOT NULL DEFAULT '#7C6FE0',
    keywords TEXT NOT NULL DEFAULT '[]',
    auto INTEGER NOT NULL DEFAULT 0,
    smart_key TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS folders_parent ON folders(parent_id);
  CREATE INDEX IF NOT EXISTS folders_smart_key ON folders(smart_key);

  CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    url TEXT,
    url_key TEXT,
    source TEXT NOT NULL DEFAULT 'manual',
    tags TEXT NOT NULL DEFAULT '[]',
    meta TEXT NOT NULL DEFAULT '{}',
    secret TEXT,
    pinned INTEGER NOT NULL DEFAULT 0,
    sensitive INTEGER NOT NULL DEFAULT 0,
    filing TEXT NOT NULL DEFAULT 'auto',
    has_thumb INTEGER NOT NULL DEFAULT 0,
    has_blob INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    trashed_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS items_url_key ON items(url_key);
  CREATE INDEX IF NOT EXISTS items_created ON items(created_at);

  CREATE TABLE IF NOT EXISTS item_folders (
    item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    folder_id TEXT NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
    added_at INTEGER NOT NULL,
    PRIMARY KEY (item_id, folder_id)
  );
  CREATE INDEX IF NOT EXISTS item_folders_folder ON item_folders(folder_id);

  CREATE TABLE IF NOT EXISTS blobs (
    item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    mime TEXT NOT NULL,
    width INTEGER,
    height INTEGER,
    size INTEGER NOT NULL,
    data BLOB NOT NULL,
    PRIMARY KEY (item_id, kind)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS vault_meta (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
  `,
];

export const SCHEMA_VERSION = MIGRATIONS.length;

/** Connection-level settings. Run after the key is set and before anything else. */
export async function configureConnection(db: SQLDatabase): Promise<void> {
  await db.exec('PRAGMA foreign_keys = ON;');
}

export async function migrate(db: SQLDatabase): Promise<void> {
  const row = await db.get<{ user_version: number }>('PRAGMA user_version;');
  const current = row?.user_version ?? 0;
  if (current > SCHEMA_VERSION) {
    throw new Error(
      `This vault was created by a newer version of Forward (schema ${current}). Please update the app.`,
    );
  }
  for (let v = current; v < SCHEMA_VERSION; v++) {
    await db.transaction(async () => {
      await db.exec(MIGRATIONS[v]);
      await db.exec(`PRAGMA user_version = ${v + 1};`);
    });
  }
}

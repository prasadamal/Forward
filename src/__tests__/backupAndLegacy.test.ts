import { SqlJsDatabase } from '../testing/sqljsDatabase';
import { configureConnection, migrate } from '../db/schema';
import { VaultRepository } from '../db/repository';
import { backupPassphrase, exportBackup, mergeFromAttached } from '../db/backup';
import { importLegacyData, LEGACY_STORAGE_KEY, LegacyStorage } from '../db/legacyImport';

let seq = 0;
const deps = () => ({ newId: () => `id${++seq}`, now: () => 5_000 });

async function freshRepo() {
  const db = await SqlJsDatabase.create();
  await configureConnection(db);
  await migrate(db);
  return { db, repo: new VaultRepository(db, deps()) };
}

describe('backup merge', () => {
  it('merges an attached vault, matching folders by name and place', async () => {
    const { db, repo } = await freshRepo();
    // Existing vault: Bangalore › Food, with one item.
    const blr = await repo.createFolder({ parentId: null, name: 'Bangalore' });
    const food = await repo.createFolder({ parentId: blr.id, name: 'Food' });
    await repo.createItem({ type: 'note', title: 'mine', source: 'manual', folderIds: [food.id] });

    // Backup (attached as "bk"): bangalore › food › cafes, Goa, with items and a blob.
    await db.exec("ATTACH DATABASE ':memory:' AS bk");
    const bkSql = (await db.all<{ sql: string }>(
      "SELECT sql FROM sqlite_master WHERE type = 'table' AND sql IS NOT NULL",
    )).map(r => r.sql.replace(/CREATE TABLE (IF NOT EXISTS )?(\w+)/, 'CREATE TABLE bk.$2'));
    for (const sql of bkSql) await db.exec(sql);
    await db.exec(`
      INSERT INTO bk.folders (id, parent_id, name, created_at, updated_at) VALUES
        ('b-food', 'b-blr', 'food', 1, 1),
        ('b-blr', NULL, 'bangalore', 1, 1),
        ('b-cafes', 'b-food', 'Cafes', 1, 1),
        ('b-goa', NULL, 'Goa', 1, 1);
      INSERT INTO bk.items (id, type, title, source, created_at, updated_at) VALUES
        ('i1', 'link', 'Third wave', 'web', 1, 1),
        ('i2', 'image', 'meme', 'shared', 1, 1);
      INSERT INTO bk.item_folders (item_id, folder_id, added_at) VALUES
        ('i1', 'b-cafes', 1), ('i1', 'b-food', 1), ('i2', 'b-goa', 1);
      INSERT INTO bk.blobs (item_id, kind, mime, size, data) VALUES ('i2', 'original', 'image/png', 3, x'010203');
    `);

    const result = await mergeFromAttached(db, 'bk', 9);
    expect(result).toEqual({ items: 2, folders: 2 });

    const folders = await repo.listFolders();
    const names = folders.map(f => `${f.name}<${folders.find(p => p.id === f.parentId)?.name ?? ''}`).sort();
    expect(names).toEqual(['Bangalore<', 'Cafes<Food', 'Food<Bangalore', 'Goa<']);
    const i1 = await repo.getItem('i1');
    expect(i1?.folderIds.sort()).toEqual(['b-cafes', food.id].sort());
    expect((await repo.getBlob('i2', 'original'))?.data).toEqual(new Uint8Array([1, 2, 3]));

    // Restoring the same backup again changes nothing.
    expect(await mergeFromAttached(db, 'bk', 9)).toEqual({ items: 0, folders: 0 });
    await db.close();
  });

  it('uses an ASCII-safe passphrase and validates the password length', async () => {
    expect(backupPassphrase("it's")).toBe('69742773');
    const { db } = await freshRepo();
    await expect(exportBackup(db, 'short', '/tmp/x.forward')).rejects.toThrow(/at least 8/);
    await db.close();
  });
});

describe('legacy import', () => {
  function storage(value: unknown): LegacyStorage & { removed: boolean } {
    const s = {
      removed: false,
      async getItem(key: string) {
        return key === LEGACY_STORAGE_KEY && value !== undefined ? JSON.stringify(value) : null;
      },
      async removeItem() {
        s.removed = true;
      },
    };
    return s;
  }

  it('imports v1 notes and folders, then deletes the plaintext copy', async () => {
    const { db, repo } = await freshRepo();
    const legacy = storage({
      notes: [
        {
          id: 'n1',
          title: 'Best biryani',
          content: 'Best biryani\n\nhttps://youtu.be/dQw4w9WgXcQ',
          platform: 'twitter',
          tags: ['food'],
          folderIds: ['f1'],
          createdAt: '2025-01-02T03:04:05.000Z',
          pinned: true,
        },
        { id: 'n2', title: '', content: 'buy milk', folderIds: [], createdAt: 'garbage', archived: true },
      ],
      folders: [
        { id: 'all', name: 'All Notes', isSystem: true },
        { id: 'f1', name: 'Bangalore', emoji: '🌆', color: '#123456' },
      ],
    });
    expect(await importLegacyData(repo, legacy, 7_000)).toBe(2);
    expect(legacy.removed).toBe(true);

    const items = await repo.listItems();
    const link = items.find(i => i.type === 'link')!;
    expect(link).toMatchObject({
      title: 'Best biryani',
      text: 'Best biryani',
      url: 'https://youtu.be/dQw4w9WgXcQ',
      source: 'x',
      pinned: true,
      createdAt: Date.parse('2025-01-02T03:04:05.000Z'),
    });
    const folders = await repo.listFolders();
    expect(folders.map(f => f.name).sort()).toEqual(['Archive', 'Bangalore']);
    expect(link.folderIds).toEqual([folders.find(f => f.name === 'Bangalore')!.id]);
    const note = items.find(i => i.type === 'note')!;
    expect(note).toMatchObject({ title: 'Note', text: 'buy milk', createdAt: 7_000, trashedAt: undefined });
    expect(note.folderIds).toEqual([folders.find(f => f.name === 'Archive')!.id]);
    await db.close();
  });

  it('does nothing without legacy data and tolerates corrupt JSON', async () => {
    const { db, repo } = await freshRepo();
    expect(await importLegacyData(repo, storage(undefined), 1)).toBe(0);
    const corrupt: LegacyStorage = { getItem: async () => '{oops', removeItem: async () => undefined };
    expect(await importLegacyData(repo, corrupt, 1)).toBe(0);
    await db.close();
  });
});

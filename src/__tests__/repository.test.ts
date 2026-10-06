import { SqlJsDatabase } from '../testing/sqljsDatabase';
import { configureConnection, migrate, SCHEMA_VERSION } from '../db/schema';
import { VaultRepository } from '../db/repository';
import { DEFAULT_SETTINGS } from '../types';

let db: SqlJsDatabase;
let repo: VaultRepository;
let clock = 1000;
let seq = 0;

beforeEach(async () => {
  db = await SqlJsDatabase.create();
  await configureConnection(db);
  await migrate(db);
  clock = 1000;
  seq = 0;
  repo = new VaultRepository(db, { newId: () => `id${++seq}`, now: () => ++clock });
});

afterEach(async () => {
  await db.close();
});

describe('schema', () => {
  it('migrates to the latest version and is idempotent', async () => {
    const v = await db.get<{ user_version: number }>('PRAGMA user_version');
    expect(v?.user_version).toBe(SCHEMA_VERSION);
    await migrate(db);
    const tables = await db.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name");
    expect(tables.map(t => t.name)).toEqual(['blobs', 'folders', 'item_folders', 'items', 'settings', 'vault_meta']);
  });

  it('refuses to open a vault from a newer app version', async () => {
    await db.exec(`PRAGMA user_version = ${SCHEMA_VERSION + 1}`);
    await expect(migrate(db)).rejects.toThrow(/newer version/);
  });
});

describe('folders', () => {
  it('creates nested folders to any depth', async () => {
    let parent: string | null = null;
    for (let i = 0; i < 12; i++) {
      const f = await repo.createFolder({ parentId: parent, name: `Level ${i}` });
      parent = f.id;
    }
    const folders = await repo.listFolders();
    expect(folders).toHaveLength(12);
    expect(folders[11].parentId).toBe(folders[10].id);
  });

  it('updates and moves folders but never into their own subtree', async () => {
    const a = await repo.createFolder({ parentId: null, name: 'A' });
    const b = await repo.createFolder({ parentId: a.id, name: 'B' });
    const c = await repo.createFolder({ parentId: null, name: 'C' });
    await repo.updateFolder(b.id, { name: 'Bee', emoji: '🐝', keywords: ['bees'] });
    expect(await repo.getFolder(b.id)).toMatchObject({ name: 'Bee', emoji: '🐝', keywords: ['bees'] });
    await repo.moveFolder(b.id, c.id);
    expect((await repo.getFolder(b.id))?.parentId).toBe(c.id);
    await expect(repo.moveFolder(c.id, b.id)).rejects.toThrow();
    await repo.moveFolder(b.id, null);
    expect((await repo.getFolder(b.id))?.parentId).toBeNull();
  });

  it('deletes a folder tree, keeping items by default', async () => {
    const a = await repo.createFolder({ parentId: null, name: 'A' });
    const b = await repo.createFolder({ parentId: a.id, name: 'B' });
    const other = await repo.createFolder({ parentId: null, name: 'Other' });
    const onlyInB = await repo.createItem({ type: 'note', title: '1', source: 'manual', folderIds: [b.id] });
    const alsoElsewhere = await repo.createItem({ type: 'note', title: '2', source: 'manual', folderIds: [b.id, other.id] });

    const result = await repo.deleteFolder(a.id, 'keep');
    expect(result.folderIds.sort()).toEqual([a.id, b.id].sort());
    expect((await repo.listFolders()).map(f => f.id)).toEqual([other.id]);
    expect((await repo.getItem(onlyInB.id))?.folderIds).toEqual([]);
    expect((await repo.getItem(alsoElsewhere.id))?.folderIds).toEqual([other.id]);
  });

  it('can trash items that only lived in the deleted folder tree', async () => {
    const a = await repo.createFolder({ parentId: null, name: 'A' });
    const b = await repo.createFolder({ parentId: a.id, name: 'B' });
    const other = await repo.createFolder({ parentId: null, name: 'Other' });
    const onlyInTree = await repo.createItem({ type: 'note', title: '1', source: 'manual', folderIds: [a.id, b.id] });
    const shared = await repo.createItem({ type: 'note', title: '2', source: 'manual', folderIds: [b.id, other.id] });
    const result = await repo.deleteFolder(a.id, 'trash');
    expect(result.trashedItemIds).toEqual([onlyInTree.id]);
    expect((await repo.getItem(onlyInTree.id))?.trashedAt).toBeDefined();
    expect((await repo.getItem(shared.id))?.trashedAt).toBeUndefined();
  });
});

describe('items', () => {
  it('round-trips every field', async () => {
    const f = await repo.createFolder({ parentId: null, name: 'Bangalore' });
    const item = await repo.createItem({
      type: 'link',
      title: 'Street food',
      text: 'try the dosa',
      url: 'https://youtu.be/dQw4w9WgXcQ?si=x',
      source: 'youtube',
      tags: ['bangalore', 'food'],
      folderIds: [f.id, f.id],
      meta: { link: { author: 'Food Ranger' } },
    });
    expect(item).toMatchObject({
      type: 'link',
      title: 'Street food',
      text: 'try the dosa',
      source: 'youtube',
      tags: ['bangalore', 'food'],
      folderIds: [f.id],
      pinned: false,
      sensitive: false,
      filing: 'auto',
      meta: { link: { author: 'Food Ranger' } },
      hasBlob: false,
      hasThumb: false,
    });
    expect(await repo.listItems()).toHaveLength(1);
  });

  it('finds duplicates by normalised URL and ignores trashed ones', async () => {
    const item = await repo.createItem({ type: 'link', title: 'x', url: 'https://youtu.be/dQw4w9WgXcQ', source: 'youtube' });
    expect((await repo.findByUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&feature=shared'))?.id).toBe(item.id);
    await repo.trashItems([item.id]);
    expect(await repo.findByUrl('https://youtu.be/dQw4w9WgXcQ')).toBeNull();
  });

  it('updates fields and folders', async () => {
    const f1 = await repo.createFolder({ parentId: null, name: 'One' });
    const f2 = await repo.createFolder({ parentId: null, name: 'Two' });
    const item = await repo.createItem({ type: 'note', title: 'n', source: 'manual', folderIds: [f1.id] });
    await repo.updateItem(item.id, { title: 'new', pinned: true, filing: 'manual', url: 'https://a.com/x?utm_source=y' });
    await repo.setItemFolders(item.id, [f2.id]);
    const updated = await repo.getItem(item.id);
    expect(updated).toMatchObject({ title: 'new', pinned: true, filing: 'manual', folderIds: [f2.id], url: 'https://a.com/x?utm_source=y' });
    expect(updated!.updatedAt).toBeGreaterThan(item.updatedAt);
    expect((await repo.findByUrl('https://a.com/x'))?.id).toBe(item.id);
    await repo.setItemFolders(item.id, []);
    expect((await repo.getItem(item.id))?.folderIds).toEqual([]);
  });

  it('keeps secrets out of listings and loads them on demand', async () => {
    const card = await repo.createItem({
      type: 'card',
      title: 'HDFC Millennia',
      source: 'manual',
      sensitive: true,
      meta: { card: { brand: 'visa', last4: '1111', holder: 'A', expiry: '12/30', issuer: 'HDFC', kind: 'credit', theme: 0 } },
      secret: { card: { number: '4111111111111111', cvv: '123', pin: '' } },
    });
    const listed = (await repo.listItems())[0];
    expect(JSON.stringify(listed)).not.toContain('4111111111111111');
    expect(await repo.getSecret(card.id)).toEqual({ card: { number: '4111111111111111', cvv: '123', pin: '' } });
    await repo.setSecret(card.id, { card: { number: '4111111111111111', cvv: '999', pin: '1234' } });
    expect((await repo.getSecret(card.id))?.card?.cvv).toBe('999');
  });

  it('stores binary blobs (memes, files) and thumbnails', async () => {
    const data = new Uint8Array(256 * 1024).map((_, i) => i % 251);
    const item = await repo.createItem({
      type: 'image',
      title: 'meme',
      source: 'shared',
      blobs: [{ kind: 'original', blob: { mime: 'image/gif', data, width: 10, height: 20 } }],
    });
    expect(item.hasBlob).toBe(true);
    expect(item.hasThumb).toBe(false);
    const blob = await repo.getBlob(item.id, 'original');
    expect(blob?.mime).toBe('image/gif');
    expect(blob?.width).toBe(10);
    expect(Buffer.from(blob!.data).equals(Buffer.from(data))).toBe(true);
    await repo.putBlob(item.id, 'thumb', { mime: 'image/jpeg', data: new Uint8Array([1, 2, 3]) });
    expect((await repo.getItem(item.id))?.hasThumb).toBe(true);
    expect((await repo.stats()).bytes).toBe(data.length);
  });

  it('trashes, restores and purges', async () => {
    const f = await repo.createFolder({ parentId: null, name: 'F' });
    const a = await repo.createItem({ type: 'note', title: 'a', source: 'manual', folderIds: [f.id], pinned: true });
    const b = await repo.createItem({
      type: 'image',
      title: 'b',
      source: 'manual',
      blobs: [{ kind: 'original', blob: { mime: 'image/png', data: new Uint8Array([1]) } }],
    });
    await repo.trashItems([a.id, b.id]);
    const trashed = await repo.getItem(a.id);
    expect(trashed?.trashedAt).toBeDefined();
    expect(trashed?.pinned).toBe(false);
    expect(trashed?.folderIds).toEqual([f.id]);
    await repo.restoreItems([a.id]);
    expect((await repo.getItem(a.id))?.trashedAt).toBeUndefined();
    expect(await repo.purgeTrash()).toEqual([b.id]);
    expect(await repo.getItem(b.id)).toBeNull();
    expect(await repo.getBlob(b.id, 'original')).toBeNull();
  });

  it('purges only items trashed long enough ago', async () => {
    const a = await repo.createItem({ type: 'note', title: 'a', source: 'manual' });
    await repo.trashItems([a.id]);
    expect(await repo.purgeTrash(1_000_000)).toEqual([]);
    clock += 2_000_000;
    expect(await repo.purgeTrash(1_000_000)).toEqual([a.id]);
  });

  it('serialises concurrent writes without interleaving transactions', async () => {
    const f = await repo.createFolder({ parentId: null, name: 'F' });
    await Promise.all(
      Array.from({ length: 25 }, (_, i) =>
        repo.createItem({ type: 'note', title: `n${i}`, source: 'manual', folderIds: [f.id] }),
      ),
    );
    expect(await repo.listItems()).toHaveLength(25);
  });
});

describe('settings & meta', () => {
  it('returns defaults and persists changes', async () => {
    expect(await repo.getSettings()).toEqual(DEFAULT_SETTINGS);
    await repo.saveSettings({ autoLockSeconds: 0, linkPreviews: false });
    expect(await repo.getSettings()).toEqual({ ...DEFAULT_SETTINGS, autoLockSeconds: 0, linkPreviews: false });
  });

  it('ignores corrupt or mistyped settings', async () => {
    await db.run("INSERT INTO settings (key, value) VALUES ('autoLockSeconds', '\"soon\"'), ('autoFile', '{bad')");
    expect(await repo.getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('stores vault metadata', async () => {
    expect(await repo.getMeta('createdAt')).toBeNull();
    await repo.setMeta('createdAt', '123');
    expect(await repo.getMeta('createdAt')).toBe('123');
  });
});

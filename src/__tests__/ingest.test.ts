import { SqlJsDatabase } from '../testing/sqljsDatabase';
import { configureConnection, migrate } from '../db/schema';
import { VaultRepository } from '../db/repository';
import { enrichLink, IngestDeps, ingestShare } from '../ingest/ingest';
import { FileTooLargeError } from '../ingest/mediaTypes';
import { buildTree, pathLabel } from '../folders/tree';
import { DEFAULT_SETTINGS, IncomingShare, VaultSettings } from '../types';
import { LinkPreview } from '../ingest/linkPreview';

let db: SqlJsDatabase;
let repo: VaultRepository;
let settings: VaultSettings;
let previews: Record<string, LinkPreview>;
let deleted: string[];
let seq = 0;

function deps(overrides: Partial<IngestDeps> = {}): IngestDeps {
  return {
    repo,
    settings: () => settings,
    fetchPreview: async url => previews[url] ?? {},
    downloadThumbnail: async () => ({ mime: 'image/jpeg', data: new Uint8Array([9, 9]) }),
    prepareImage: async (uri, mime) => ({
      original: { mime, data: new Uint8Array([1, 2, 3]), width: 640, height: 480 },
      thumb: { mime: 'image/jpeg', data: new Uint8Array([4]) },
    }),
    readFileBytes: async () => new Uint8Array([7, 7, 7, 7]),
    deleteImportedCopy: uri => deleted.push(uri),
    now: () => 50_000,
    onChange: () => undefined,
    ...overrides,
  };
}

function share(partial: Partial<IncomingShare>): IncomingShare {
  return { id: `s${++seq}`, receivedAt: 1, files: [], ...partial };
}

async function folderPathsOf(itemId: string): Promise<string[]> {
  const item = await repo.getItem(itemId);
  const tree = buildTree(await repo.listFolders());
  return (item?.folderIds ?? []).map(id => pathLabel(tree, id));
}

beforeEach(async () => {
  db = await SqlJsDatabase.create();
  await configureConnection(db);
  await migrate(db);
  repo = new VaultRepository(db, { newId: () => `id${++seq}`, now: () => ++seq });
  settings = { ...DEFAULT_SETTINGS };
  previews = {};
  deleted = [];
});

afterEach(() => db.close());

describe('the Bangalore scenario', () => {
  it('collects a YouTube vlog, an Instagram spot and an X app post under Bangalore', async () => {
    const yt = 'https://youtu.be/dQw4w9WgXcQ?si=abc';
    const ig = 'https://www.instagram.com/reel/C9xYz12AbCd/?igsh=xyz';
    const x = 'https://x.com/blrtransit/status/1834567890123';
    previews = {
      [yt]: {
        title: "Bangalore's best street food | VV Puram food street",
        author: 'Food Ranger',
        siteName: 'YouTube',
        imageUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
      },
      [ig]: { title: 'Hidden lake near Bengaluru 🌅', description: 'Perfect sunset spot #bangaloretrips', siteName: 'Instagram' },
      [x]: { title: 'New app shows live BMTC bus locations in Bangalore', description: 'Download on the Play Store', siteName: 'X' },
    };

    const ids: string[] = [];
    for (const url of [yt, ig, x]) {
      // Apps usually share only the link: nothing to classify yet → Inbox.
      const [outcome] = await ingestShare(share({ text: url }), deps());
      expect(outcome.status).toBe('saved');
      const itemId = (outcome as { itemId: string }).itemId;
      expect(await folderPathsOf(itemId)).toEqual([]);
      // The preview arrives and the item is filed.
      await enrichLink(itemId, deps());
      ids.push(itemId);
    }

    expect(await folderPathsOf(ids[0])).toEqual(['Bangalore › Food']);
    expect(await folderPathsOf(ids[1])).toEqual(['Bangalore › Places to Visit']);
    expect(await folderPathsOf(ids[2])).toEqual(['Bangalore › Apps & Tech']);
    // One Bangalore folder, three topic folders inside it.
    const folders = await repo.listFolders();
    expect(folders.filter(f => f.name === 'Bangalore')).toHaveLength(1);
    expect(folders).toHaveLength(4);

    const vlog = await repo.getItem(ids[0]);
    expect(vlog).toMatchObject({
      title: "Bangalore's best street food | VV Puram food street",
      source: 'youtube',
      hasThumb: true,
      meta: { link: { author: 'Food Ranger', autoTitle: false, previewAt: 50_000 } },
    });
    expect(vlog?.tags).toEqual(expect.arrayContaining(['bangalore', 'food']));
  });

  it('files immediately when the sending app includes a title (works offline)', async () => {
    const [outcome] = await ingestShare(
      share({ text: 'https://youtu.be/dQw4w9WgXcQ', subject: 'Watch "Masala dosa trail in Bengaluru" on YouTube' }),
      deps(),
    );
    const itemId = (outcome as { itemId: string }).itemId;
    expect(await folderPathsOf(itemId)).toEqual(['Bangalore › Food']);
    expect((await repo.getItem(itemId))?.title).toBe('Masala dosa trail in Bengaluru');
  });
});

describe('ingestShare', () => {
  it('detects duplicates and keeps the new note', async () => {
    const [first] = await ingestShare(share({ text: 'https://youtu.be/dQw4w9WgXcQ' }), deps());
    const [second] = await ingestShare(share({ text: 'try on sunday https://www.youtube.com/watch?v=dQw4w9WgXcQ' }), deps());
    expect(second).toEqual({ status: 'duplicate', itemId: (first as { itemId: string }).itemId, type: 'link' });
    expect((await repo.getItem((first as { itemId: string }).itemId))?.text).toBe('try on sunday');
  });

  it('stores shared images, videos and files encrypted and deletes the temp copies', async () => {
    const outcomes = await ingestShare(
      share({
        text: 'monday mood 😂',
        files: [
          { uri: 'file:///cache/meme.gif', name: 'meme.gif', mimeType: 'image/gif' },
          { uri: 'file:///cache/clip.mp4', name: 'clip.mp4', mimeType: 'video/mp4' },
          { uri: 'file:///cache/ticket.pdf', name: 'ticket.pdf', mimeType: 'application/pdf' },
        ],
      }),
      deps(),
    );
    expect(outcomes.map(o => o.status)).toEqual(['saved', 'saved', 'saved']);
    expect(deleted).toEqual(['file:///cache/meme.gif', 'file:///cache/clip.mp4', 'file:///cache/ticket.pdf']);
    const items = await repo.listItems();
    const meme = items.find(i => i.type === 'image')!;
    expect(meme).toMatchObject({ hasBlob: true, hasThumb: true, meta: { media: { mime: 'image/gif', width: 640, fileName: 'meme.gif' } } });
    expect(await folderPathsOf(meme.id)).toEqual(['Memes & Fun']);
    const pdf = items.find(i => i.type === 'file')!;
    expect((await repo.getBlob(pdf.id, 'original'))?.data).toEqual(new Uint8Array([7, 7, 7, 7]));
  });

  it('reports files that are too large', async () => {
    const outcomes = await ingestShare(
      share({ files: [{ uri: 'file:///cache/huge.mov', name: 'huge.mov', mimeType: 'video/quicktime' }] }),
      deps({
        readFileBytes: async () => {
          throw new FileTooLargeError(99_000_000);
        },
      }),
    );
    expect(outcomes).toEqual([{ status: 'failed', reason: 'too-large', name: 'huge.mov' }]);
    expect(deleted).toEqual(['file:///cache/huge.mov']);
    expect(await repo.listItems()).toEqual([]);
  });

  it('saves plain text as a note and respects the auto-file setting', async () => {
    settings.autoFile = false;
    const [o] = await ingestShare(share({ text: 'Biryani places in Bangalore to try' }), deps());
    const item = await repo.getItem((o as { itemId: string }).itemId);
    expect(item).toMatchObject({ type: 'note', title: 'Biryani places in Bangalore to try', folderIds: [] });
  });
});

describe('enrichLink', () => {
  it('does not move items the user filed by hand', async () => {
    const url = 'https://example.com/post';
    const [o] = await ingestShare(share({ text: url }), deps());
    const itemId = (o as { itemId: string }).itemId;
    const mine = await repo.createFolder({ parentId: null, name: 'Mine' });
    await repo.setItemFolders(itemId, [mine.id]);
    await repo.updateItem(itemId, { filing: 'manual' });
    previews[url] = { title: 'Street food in Bangalore' };
    await enrichLink(itemId, deps());
    expect(await folderPathsOf(itemId)).toEqual(['Mine']);
    expect((await repo.getItem(itemId))?.title).toBe('Street food in Bangalore');
  });

  it('keeps a user-provided title', async () => {
    const url = 'https://youtu.be/dQw4w9WgXcQ';
    const [o] = await ingestShare(share({ text: url, subject: 'My title' }), deps());
    const itemId = (o as { itemId: string }).itemId;
    previews[url] = { title: 'Their title' };
    await enrichLink(itemId, deps());
    expect((await repo.getItem(itemId))?.title).toBe('My title');
  });

  it('removes auto folders that became empty after re-filing', async () => {
    const url = 'https://example.com/a';
    // Initial text says "food" → Food; preview reveals the place → Bangalore › Food.
    const [o] = await ingestShare(share({ text: `great food ${url}` }), deps());
    const itemId = (o as { itemId: string }).itemId;
    expect(await folderPathsOf(itemId)).toEqual(['Food']);
    previews[url] = { title: 'Best food in Bangalore' };
    await enrichLink(itemId, deps());
    expect(await folderPathsOf(itemId)).toEqual(['Bangalore › Food']);
    expect((await repo.listFolders()).map(f => f.name).sort()).toEqual(['Bangalore', 'Food']);
  });

  it('does nothing when previews are disabled', async () => {
    settings.linkPreviews = false;
    const fetchPreview = jest.fn();
    const [o] = await ingestShare(share({ text: 'https://example.com/b' }), deps());
    await enrichLink((o as { itemId: string }).itemId, deps({ fetchPreview }));
    expect(fetchPreview).not.toHaveBeenCalled();
  });
});

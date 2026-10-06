import { VaultRepository } from '../db/repository';
import { IncomingShare, ItemType, StoredBlob, VaultSettings } from '../types';
import { draftsFromShare, ItemDraft } from './drafts';
import { LinkPreview } from './linkPreview';
import { autoFileItem, classifyInputFor, pruneEmptyAutoFolders } from '../organizer/fileItem';
import { tidy } from '../organizer/text';
import { FileTooLargeError, PreparedImage } from './mediaTypes';

export type IngestOutcome =
  | { status: 'saved'; itemId: string; type: ItemType }
  | { status: 'duplicate'; itemId: string; type: ItemType }
  | { status: 'failed'; reason: string; name?: string };

/** Platform services, injected so the pipeline can be tested without native modules. */
export interface IngestDeps {
  repo: VaultRepository;
  settings: () => VaultSettings;
  fetchPreview: (url: string) => Promise<LinkPreview>;
  downloadThumbnail: (url: string) => Promise<StoredBlob | null>;
  prepareImage: (uri: string, mime: string, size?: number, width?: number, height?: number) => Promise<PreparedImage>;
  readFileBytes: (uri: string) => Promise<Uint8Array>;
  /** Deletes our temporary copy of an imported file (never user files). */
  deleteImportedCopy: (uri: string) => void;
  now: () => number;
  /** Called whenever an item or the folder list changed, so the UI can refresh. */
  onChange: () => void;
}

async function saveDraft(draft: ItemDraft, deps: IngestDeps): Promise<IngestOutcome> {
  const { repo } = deps;

  if (draft.type === 'link' && draft.url) {
    const existing = await repo.findByUrl(draft.url);
    if (existing) {
      // Keep any new note the user shared along with the link.
      if (draft.text && !existing.text.includes(draft.text)) {
        await repo.updateItem(existing.id, { text: [existing.text, draft.text].filter(Boolean).join('\n\n') });
      }
      return { status: 'duplicate', itemId: existing.id, type: existing.type };
    }
  }

  const blobs: { kind: 'original' | 'thumb'; blob: StoredBlob }[] = [];
  const file = draft.file;
  if (file) {
    try {
      if (draft.type === 'image') {
        const img = await deps.prepareImage(file.uri, file.mimeType, file.size, file.width, file.height);
        blobs.push({ kind: 'original', blob: img.original });
        if (img.thumb) blobs.push({ kind: 'thumb', blob: img.thumb });
      } else {
        const data = await deps.readFileBytes(file.uri);
        blobs.push({
          kind: 'original',
          blob: { mime: file.mimeType, data, width: file.width, height: file.height },
        });
      }
    } catch (e) {
      const reason = e instanceof FileTooLargeError ? 'too-large' : 'unreadable';
      return { status: 'failed', reason, name: file.name };
    } finally {
      deps.deleteImportedCopy(file.uri);
    }
  }

  const original = blobs.find(b => b.kind === 'original')?.blob;
  const item = await repo.createItem({
    type: draft.type,
    title: tidy(draft.title, 140),
    text: draft.text,
    url: draft.url,
    source: draft.source,
    filing: 'auto',
    meta: {
      ...(draft.type === 'link' ? { link: { autoTitle: draft.titleIsGuess } } : {}),
      ...(file && original
        ? {
            media: {
              mime: original.mime,
              size: original.data.length,
              width: original.width,
              height: original.height,
              fileName: file.name,
            },
          }
        : {}),
    },
    blobs,
  });

  if (deps.settings().autoFile) {
    await autoFileItem(repo, item.id, classifyInputFor(item, { hint: draft.hint }));
  }
  return { status: 'saved', itemId: item.id, type: item.type };
}

/** Saves everything in a share. Link previews are fetched afterwards by `enrichLink`. */
export async function ingestShare(share: IncomingShare, deps: IngestDeps): Promise<IngestOutcome[]> {
  const outcomes: IngestOutcome[] = [];
  for (const draft of draftsFromShare(share)) {
    try {
      outcomes.push(await saveDraft(draft, deps));
    } catch (e) {
      outcomes.push({ status: 'failed', reason: 'error', name: draft.file?.name ?? draft.title });
    }
  }
  deps.onChange();
  return outcomes;
}

/**
 * Fetches a link's title, description and thumbnail from the site itself, then
 * re-files the item if the user hasn't moved it by hand. Safe to call offline.
 */
export async function enrichLink(itemId: string, deps: IngestDeps): Promise<void> {
  const { repo } = deps;
  if (!deps.settings().linkPreviews) return;
  const item = await repo.getItem(itemId);
  if (!item?.url || item.trashedAt) return;

  const preview = await deps.fetchPreview(item.url);
  const fresh = await repo.getItem(itemId);
  if (!fresh) return;

  const link = {
    ...fresh.meta.link,
    siteName: preview.siteName ?? fresh.meta.link?.siteName,
    author: preview.author ?? fresh.meta.link?.author,
    description: preview.description ? tidy(preview.description, 600) : fresh.meta.link?.description,
    imageUrl: preview.imageUrl ?? fresh.meta.link?.imageUrl,
    finalUrl: preview.finalUrl ?? fresh.meta.link?.finalUrl,
    previewAt: deps.now(),
  };
  const replaceTitle = !!preview.title && fresh.meta.link?.autoTitle !== false;
  if (replaceTitle) link.autoTitle = false;
  await repo.updateItem(itemId, {
    meta: { ...fresh.meta, link },
    ...(replaceTitle ? { title: tidy(preview.title, 140) } : {}),
  });

  if (preview.imageUrl && !fresh.hasThumb) {
    const thumb = await deps.downloadThumbnail(preview.imageUrl);
    if (thumb) await repo.putBlob(itemId, 'thumb', thumb);
  }

  const updated = await repo.getItem(itemId);
  if (updated && updated.filing === 'auto' && deps.settings().autoFile && (preview.title || preview.description)) {
    const before = updated.folderIds;
    const result = await autoFileItem(repo, itemId, classifyInputFor(updated));
    const dropped = before.filter(id => !result.folderIds.includes(id));
    if (dropped.length) await pruneEmptyAutoFolders(repo, dropped);
  }
  deps.onChange();
}

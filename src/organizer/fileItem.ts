import { VaultRepository } from '../db/repository';
import { AsyncQueue } from '../db/types';
import { Item } from '../types';
import { classify, ClassifyInput, corpusOf } from './classify';
import { planFiling } from './autoFile';

/** Auto-filing runs one item at a time so two shares can't both create "Bangalore". */
const queue = new AsyncQueue();

export function classifyInputFor(item: Item, extra?: { hint?: string }): ClassifyInput {
  const link = item.meta.link;
  return {
    title: item.title,
    text: [item.text, link?.description, extra?.hint].filter(Boolean).join('\n'),
    url: link?.finalUrl ?? item.url,
    author: link?.author ?? link?.siteName,
  };
}

export interface FileResult {
  folderIds: string[];
  createdFolderIds: string[];
  tags: string[];
}

/**
 * Classifies an item and files it, creating smart folders as needed.
 * Replaces the item's current folders. Returns the new folder ids.
 */
export function autoFileItem(repo: VaultRepository, itemId: string, input: ClassifyInput): Promise<FileResult> {
  return queue.run(async () => {
    const c = classify(input);
    const folders = await repo.listFolders();
    const plan = planFiling(c, folders, corpusOf(input));
    const keyToId = new Map<string, string>();
    const createdFolderIds: string[] = [];
    for (const spec of plan.create) {
      const parentId = spec.parentId === null ? null : keyToId.get(spec.parentId) ?? spec.parentId;
      const folder = await repo.createFolder({
        parentId,
        name: spec.name,
        emoji: spec.emoji,
        color: spec.color,
        auto: true,
        smartKey: spec.smartKey,
      });
      keyToId.set(spec.key, folder.id);
      createdFolderIds.push(folder.id);
    }
    const folderIds = plan.targets.map(t => keyToId.get(t) ?? t);
    await repo.setItemFolders(itemId, folderIds);
    await repo.updateItem(itemId, { tags: c.tags });
    return { folderIds, createdFolderIds, tags: c.tags };
  });
}

/**
 * After re-filing, folders the auto-filer created that are now completely
 * empty (no items, no subfolders) are removed again.
 */
export async function pruneEmptyAutoFolders(repo: VaultRepository, candidateIds: string[]): Promise<string[]> {
  const removed: string[] = [];
  for (const id of candidateIds) {
    const folder = await repo.getFolder(id);
    if (!folder?.auto) continue;
    const used = await repo.db.get<{ n: number }>(
      `SELECT (SELECT COUNT(*) FROM item_folders WHERE folder_id = ?) +
              (SELECT COUNT(*) FROM folders WHERE parent_id = ?) AS n`,
      [id, id],
    );
    if ((used?.n ?? 0) === 0) {
      await repo.deleteFolder(id, 'keep');
      removed.push(id);
      // Its parent may now be empty too.
      if (folder.parentId) removed.push(...(await pruneEmptyAutoFolders(repo, [folder.parentId])));
    }
  }
  return removed;
}

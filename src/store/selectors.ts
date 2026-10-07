import { useMemo } from 'react';
import { useVault } from './vault';
import { buildTree, countItems, FolderCounts, FolderTree, pathLabel } from '../folders/tree';
import { Item, isWalletType } from '../types';
import { normalizeText } from '../organizer/text';

export function useFolderTree(): FolderTree {
  const folders = useVault(s => s.folders);
  return useMemo(() => buildTree(folders), [folders]);
}

export function useFolderCounts(): FolderCounts {
  const tree = useFolderTree();
  const items = useVault(s => s.items);
  return useMemo(() => countItems(tree, items), [tree, items]);
}

/** Forwarded content (everything that isn't a wallet item), newest first, not trashed. */
export function useLibraryItems(): Item[] {
  const items = useVault(s => s.items);
  return useMemo(() => items.filter(i => !i.trashedAt && !isWalletType(i.type)), [items]);
}

export function useWalletItems(): Item[] {
  const items = useVault(s => s.items);
  return useMemo(() => items.filter(i => !i.trashedAt && isWalletType(i.type)), [items]);
}

export function useItem(id: string | undefined): Item | undefined {
  return useVault(s => (id ? s.items.find(i => i.id === id) : undefined));
}

/** "Bangalore › Food" for the item's first folder, or "Inbox". */
export function folderLabelFor(tree: FolderTree, item: Item): string {
  const first = item.folderIds.find(id => tree.byId.has(id));
  if (!first) return 'Inbox';
  const label = pathLabel(tree, first);
  return item.folderIds.length > 1 ? `${label} +${item.folderIds.length - 1}` : label;
}

export function sortItems(items: Item[]): Item[] {
  return [...items].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt - a.createdAt);
}

/**
 * Search over titles, notes, links, tags and folder names. Every word must
 * match somewhere. Secrets are never searched (they aren't in memory).
 */
export function searchItems(items: Item[], tree: FolderTree, query: string): Item[] {
  const words = normalizeText(query).trim().split(' ').filter(Boolean);
  if (!words.length) return [];
  return items.filter(item => {
    if (item.trashedAt) return false;
    const folderNames = item.folderIds.map(id => pathLabel(tree, id)).join(' ');
    const meta = item.meta;
    const hay = normalizeText(
      [
        item.title,
        item.sensitive ? '' : item.text,
        item.url,
        item.tags.join(' '),
        folderNames,
        meta.link?.author,
        meta.link?.siteName,
        meta.link?.description,
        meta.media?.fileName,
        meta.card ? `${meta.card.issuer} ${meta.card.brand} ${meta.card.holder}` : '',
        meta.login ? `${meta.login.username} ${meta.login.website}` : '',
      ]
        .filter(Boolean)
        .join(' '),
    );
    return words.every(w => hay.includes(` ${w}`));
  });
}

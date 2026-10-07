import { Folder, Item } from '../types';

/**
 * Helpers for the folder tree. Folders reference their parent by id, so the
 * tree can be any depth. All traversals guard against cycles in case stored
 * data is ever inconsistent.
 */

export interface FolderTree {
  byId: Map<string, Folder>;
  /** Children per parent id (`null` = top level), sorted by name. */
  children: Map<string | null, Folder[]>;
}

const collator = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });

export function sortFolders(list: Folder[]): Folder[] {
  return [...list].sort((a, b) => collator(a.name, b.name));
}

export function buildTree(folders: Folder[]): FolderTree {
  const byId = new Map<string, Folder>();
  for (const f of folders) byId.set(f.id, f);
  const children = new Map<string | null, Folder[]>();
  for (const f of folders) {
    // Orphans (parent deleted or missing) are shown at the top level.
    const parent = f.parentId && byId.has(f.parentId) ? f.parentId : null;
    const list = children.get(parent) ?? [];
    list.push(f);
    children.set(parent, list);
  }
  for (const [k, list] of children) children.set(k, sortFolders(list));
  return { byId, children };
}

export function childrenOf(tree: FolderTree, parentId: string | null): Folder[] {
  return tree.children.get(parentId) ?? [];
}

/** Folders from the top level down to `id` (inclusive). */
export function getPath(tree: FolderTree, id: string): Folder[] {
  const path: Folder[] = [];
  const seen = new Set<string>();
  let cur = tree.byId.get(id);
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    path.unshift(cur);
    cur = cur.parentId ? tree.byId.get(cur.parentId) : undefined;
  }
  return path;
}

export function pathLabel(tree: FolderTree, id: string, separator = ' › '): string {
  return getPath(tree, id).map(f => f.name).join(separator);
}

export function depthOf(tree: FolderTree, id: string): number {
  return Math.max(0, getPath(tree, id).length - 1);
}

/** All descendants of `id` (not including `id`), breadth-first. */
export function getDescendantIds(tree: FolderTree, id: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>([id]);
  const queue = [id];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const child of childrenOf(tree, cur)) {
      if (seen.has(child.id)) continue;
      seen.add(child.id);
      out.push(child.id);
      queue.push(child.id);
    }
  }
  return out;
}

export function isAncestor(tree: FolderTree, ancestorId: string, id: string): boolean {
  if (ancestorId === id) return false;
  return getPath(tree, id).some(f => f.id === ancestorId);
}

/** A folder can't be moved into itself or into one of its own descendants. */
export function canMoveFolder(tree: FolderTree, folderId: string, newParentId: string | null): boolean {
  if (newParentId === null) return true;
  if (newParentId === folderId) return false;
  if (!tree.byId.has(newParentId)) return false;
  return !isAncestor(tree, folderId, newParentId);
}

/** Drop folders that are ancestors of other folders in the list (keep the most specific). */
export function keepDeepest(tree: FolderTree, ids: string[]): string[] {
  const unique = [...new Set(ids)].filter(id => tree.byId.has(id));
  return unique.filter(id => !unique.some(other => other !== id && isAncestor(tree, id, other)));
}

export interface FolderCounts {
  /** Items filed directly in the folder. */
  direct: Map<string, number>;
  /** Unique items in the folder or any of its subfolders. */
  total: Map<string, number>;
}

/** Counts of non-trashed items per folder. */
export function countItems(tree: FolderTree, items: Item[]): FolderCounts {
  const direct = new Map<string, number>();
  const totalSets = new Map<string, Set<string>>();
  for (const item of items) {
    if (item.trashedAt) continue;
    for (const fid of item.folderIds) {
      if (!tree.byId.has(fid)) continue;
      direct.set(fid, (direct.get(fid) ?? 0) + 1);
      for (const f of getPath(tree, fid)) {
        let set = totalSets.get(f.id);
        if (!set) {
          set = new Set();
          totalSets.set(f.id, set);
        }
        set.add(item.id);
      }
    }
  }
  const total = new Map<string, number>();
  for (const [id, set] of totalSets) total.set(id, set.size);
  return { direct, total };
}

/** Items in a folder, optionally including everything in its subfolders. */
export function itemsInFolder(tree: FolderTree, items: Item[], folderId: string, includeSubfolders: boolean): Item[] {
  const ids = new Set([folderId, ...(includeSubfolders ? getDescendantIds(tree, folderId) : [])]);
  return items.filter(i => !i.trashedAt && i.folderIds.some(f => ids.has(f)));
}

/** "Food", "Food 2", … — a name that doesn't clash with a sibling. */
export function uniqueChildName(tree: FolderTree, parentId: string | null, name: string, exceptId?: string): string {
  const base = name.trim() || 'New folder';
  const taken = new Set(
    childrenOf(tree, parentId)
      .filter(f => f.id !== exceptId)
      .map(f => f.name.trim().toLowerCase()),
  );
  if (!taken.has(base.toLowerCase())) return base;
  let n = 2;
  while (taken.has(`${base} ${n}`.toLowerCase())) n++;
  return `${base} ${n}`;
}

/** Flattened tree in display order with depth, for pickers. */
export function flattenTree(
  tree: FolderTree,
  expanded?: Set<string>,
): { folder: Folder; depth: number; hasChildren: boolean }[] {
  const out: { folder: Folder; depth: number; hasChildren: boolean }[] = [];
  const seen = new Set<string>();
  const walk = (parentId: string | null, depth: number) => {
    for (const f of childrenOf(tree, parentId)) {
      if (seen.has(f.id)) continue;
      seen.add(f.id);
      const kids = childrenOf(tree, f.id);
      out.push({ folder: f, depth, hasChildren: kids.length > 0 });
      if (!expanded || expanded.has(f.id)) walk(f.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

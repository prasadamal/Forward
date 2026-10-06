import { Folder } from '../types';
import { Classification } from './classify';
import { containsPhrase, normalizePhrase, phraseVariants } from './text';
import { buildTree, childrenOf, depthOf, FolderTree, isAncestor, keepDeepest } from '../folders/tree';
import { folderColor } from '../constants/palette';

/**
 * Decides which folders an item goes into. Pure: it returns a plan, and the
 * caller creates any new folders and assigns the item.
 *
 * Rules, in order:
 *  1. Folders with keywords ("Auto-file items mentioning…") that match the item.
 *  2. A place folder ("Bangalore") — reused if one already exists anywhere in
 *     the tree under that name, an alias, a keyword, or its smart key.
 *  3. A topic folder inside it ("Bangalore › Food"), or at the top level when
 *     there is no place.
 * Only the most specific folders are kept, so the item lands in
 * "Bangalore › Food" rather than both "Bangalore" and "Bangalore › Food".
 */

export interface NewFolderSpec {
  /** Temporary id used in `targets` until the folder is created. */
  key: string;
  /** Existing folder id, another spec key, or null for top level. */
  parentId: string | null;
  name: string;
  emoji: string;
  color: string;
  smartKey: string;
}

export interface FilingPlan {
  create: NewFolderSpec[];
  /** Folder ids and/or NewFolderSpec keys. Empty = Inbox. */
  targets: string[];
}

export const NEW_FOLDER_PREFIX = 'new:';

export function placeKey(name: string): string {
  return `place:${normalizePhrase(name)}`;
}

export function topicKey(name: string): string {
  return `topic:${normalizePhrase(name)}`;
}

function nameMatches(folder: Folder, names: Set<string>): boolean {
  if (names.has(normalizePhrase(folder.name))) return true;
  return folder.keywords.some(k => names.has(normalizePhrase(k)));
}

function findPlaceFolder(tree: FolderTree, folders: Folder[], c: Classification): Folder | undefined {
  if (!c.place) return undefined;
  const p = c.place.place;
  const key = placeKey(p.name);
  const bySmartKey = folders.filter(f => f.smartKey === key);
  const names = new Set([p.name, ...(p.aliases ?? [])].map(normalizePhrase));
  const candidates = bySmartKey.length ? bySmartKey : folders.filter(f => nameMatches(f, names));
  return candidates.sort(
    (a, b) => depthOf(tree, a.id) - depthOf(tree, b.id) || a.createdAt - b.createdAt,
  )[0];
}

function findTopicFolder(tree: FolderTree, parentId: string | null, c: Classification): Folder | undefined {
  if (!c.topic) return undefined;
  const key = topicKey(c.topic.topic.name);
  const siblings = childrenOf(tree, parentId);
  const names = new Set([normalizePhrase(c.topic.topic.name)]);
  return siblings.find(f => f.smartKey === key) ?? siblings.find(f => nameMatches(f, names));
}

/** Folders whose keyword rules match the item text. */
export function ruleMatches(folders: Folder[], corpus: string): Folder[] {
  return folders.filter(f =>
    f.keywords.some(k => {
      const phrase = normalizePhrase(k);
      return phrase.length > 1 && phraseVariants(phrase).some(v => containsPhrase(corpus, v));
    }),
  );
}

export interface PlanOptions {
  /** Create Place › Topic subfolders (default true). */
  topicSubfolders?: boolean;
}

export function planFiling(
  c: Classification,
  folders: Folder[],
  corpus: string,
  options: PlanOptions = {},
): FilingPlan {
  const tree = buildTree(folders);
  const create: NewFolderSpec[] = [];
  const targets: string[] = [];

  const newSpec = (parentId: string | null, name: string, emoji: string, smartKey: string): string => {
    const key = `${NEW_FOLDER_PREFIX}${create.length}`;
    create.push({ key, parentId, name, emoji, color: folderColor(name), smartKey });
    return key;
  };

  // 1. Keyword rules.
  for (const f of ruleMatches(folders, corpus)) targets.push(f.id);

  // 2. Place.
  let placeTarget: string | null = null;
  if (c.place) {
    const existing = findPlaceFolder(tree, folders, c);
    placeTarget = existing
      ? existing.id
      : newSpec(null, c.place.place.name, c.place.place.emoji, placeKey(c.place.place.name));
  }

  // 3. Topic (inside the place when there is one).
  let topicTarget: string | null = null;
  const wantTopic = c.topic && (options.topicSubfolders !== false || !placeTarget);
  if (c.topic && wantTopic) {
    const parentIsNew = placeTarget?.startsWith(NEW_FOLDER_PREFIX) ?? false;
    const existing = parentIsNew ? undefined : findTopicFolder(tree, placeTarget, c);
    topicTarget = existing
      ? existing.id
      : newSpec(placeTarget, c.topic.topic.name, c.topic.topic.emoji, topicKey(c.topic.topic.name));
  }

  const smartTarget = topicTarget ?? placeTarget;
  if (smartTarget) targets.push(smartTarget);

  // Keep only the deepest existing folders; new folders are always leaves.
  const existingTargets = keepDeepest(
    tree,
    targets.filter(t => !t.startsWith(NEW_FOLDER_PREFIX)),
  );
  const newTargets = targets.filter(t => t.startsWith(NEW_FOLDER_PREFIX));
  // A new folder created under an existing one makes that folder (and its
  // ancestors) less specific than the new folder, so drop them.
  const anchors: string[] = [];
  for (const key of newTargets) {
    let parent = create.find(s => s.key === key)?.parentId ?? null;
    while (parent && parent.startsWith(NEW_FOLDER_PREFIX)) {
      parent = create.find(s => s.key === parent)?.parentId ?? null;
    }
    if (parent) anchors.push(parent);
  }
  const finalTargets = [
    ...existingTargets.filter(id => !anchors.some(a => a === id || isAncestor(tree, id, a))),
    ...newTargets,
  ];
  return { create, targets: [...new Set(finalTargets)] };
}

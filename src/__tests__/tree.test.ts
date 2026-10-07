import {
  buildTree,
  canMoveFolder,
  countItems,
  depthOf,
  flattenTree,
  getDescendantIds,
  getPath,
  isAncestor,
  itemsInFolder,
  keepDeepest,
  pathLabel,
  uniqueChildName,
} from '../folders/tree';
import { Folder, Item } from '../types';

function folder(id: string, parentId: string | null, name = id): Folder {
  return { id, parentId, name, emoji: '📁', color: '#000', keywords: [], auto: false, createdAt: 0, updatedAt: 0 };
}

function item(id: string, folderIds: string[], trashed = false): Item {
  return {
    id,
    type: 'link',
    title: id,
    text: '',
    source: 'web',
    tags: [],
    folderIds,
    pinned: false,
    sensitive: false,
    filing: 'auto',
    meta: {},
    hasThumb: false,
    hasBlob: false,
    createdAt: 0,
    updatedAt: 0,
    trashedAt: trashed ? 1 : undefined,
  };
}

// India › Bangalore › Food
//               └── Places
// Goa
const folders = [
  folder('india', null, 'India'),
  folder('blr', 'india', 'Bangalore'),
  folder('food', 'blr', 'Food'),
  folder('places', 'blr', 'Places'),
  folder('goa', null, 'Goa'),
];

describe('folder tree', () => {
  const tree = buildTree(folders);

  it('sorts children by name', () => {
    expect(tree.children.get(null)!.map(f => f.id)).toEqual(['goa', 'india']);
    expect(tree.children.get('blr')!.map(f => f.id)).toEqual(['food', 'places']);
  });

  it('builds paths and labels to any depth', () => {
    expect(getPath(tree, 'food').map(f => f.id)).toEqual(['india', 'blr', 'food']);
    expect(pathLabel(tree, 'food')).toBe('India › Bangalore › Food');
    expect(depthOf(tree, 'food')).toBe(2);
    expect(depthOf(tree, 'goa')).toBe(0);
  });

  it('finds descendants and ancestors', () => {
    expect(getDescendantIds(tree, 'india').sort()).toEqual(['blr', 'food', 'places']);
    expect(isAncestor(tree, 'india', 'food')).toBe(true);
    expect(isAncestor(tree, 'food', 'india')).toBe(false);
    expect(isAncestor(tree, 'food', 'food')).toBe(false);
  });

  it('prevents moving a folder into itself or its descendants', () => {
    expect(canMoveFolder(tree, 'india', 'food')).toBe(false);
    expect(canMoveFolder(tree, 'india', 'india')).toBe(false);
    expect(canMoveFolder(tree, 'food', 'goa')).toBe(true);
    expect(canMoveFolder(tree, 'food', null)).toBe(true);
    expect(canMoveFolder(tree, 'food', 'missing')).toBe(false);
  });

  it('keeps only the most specific folders', () => {
    expect(keepDeepest(tree, ['india', 'food', 'goa', 'blr']).sort()).toEqual(['food', 'goa']);
  });

  it('shows orphans at the top level and survives cycles', () => {
    const broken = buildTree([folder('a', 'b'), folder('b', 'a'), folder('c', 'missing')]);
    expect(getPath(broken, 'a').length).toBeLessThanOrEqual(2);
    expect(broken.children.get(null)!.map(f => f.id)).toContain('c');
    expect(getDescendantIds(broken, 'a')).toEqual(['b']);
  });

  it('counts items directly and including subfolders (unique)', () => {
    const items = [item('1', ['food']), item('2', ['food', 'places']), item('3', ['goa']), item('4', ['food'], true)];
    const counts = countItems(tree, items);
    expect(counts.direct.get('food')).toBe(2);
    expect(counts.total.get('blr')).toBe(2);
    expect(counts.total.get('india')).toBe(2);
    expect(counts.total.get('goa')).toBe(1);
    expect(itemsInFolder(tree, items, 'india', true).map(i => i.id)).toEqual(['1', '2']);
    expect(itemsInFolder(tree, items, 'india', false)).toEqual([]);
  });

  it('generates unique sibling names', () => {
    expect(uniqueChildName(tree, 'blr', 'Food')).toBe('Food 2');
    expect(uniqueChildName(tree, 'blr', 'Cafes')).toBe('Cafes');
    expect(uniqueChildName(tree, 'blr', 'food', 'food')).toBe('food');
  });

  it('flattens the tree with depth for pickers', () => {
    const flat = flattenTree(tree);
    expect(flat.map(r => `${r.depth}:${r.folder.id}`)).toEqual(['0:goa', '0:india', '1:blr', '2:food', '2:places']);
    const collapsed = flattenTree(tree, new Set());
    expect(collapsed.map(r => r.folder.id)).toEqual(['goa', 'india']);
    expect(collapsed.find(r => r.folder.id === 'india')!.hasChildren).toBe(true);
  });
});

import React, { memo, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Folder } from '../types';
import { radius, space, useTheme } from '../theme';
import { Button, SearchField, Txt } from './primitives';
import { Sheet } from './Sheet';
import { childrenOf, FolderTree, getDescendantIds, getPath, pathLabel } from '../folders/tree';
import { normalizeText } from '../organizer/text';

export function FolderBubble({ folder, size = 40 }: { folder: Pick<Folder, 'emoji' | 'color'>; size?: number }) {
  return (
    <View style={[styles.bubble, { width: size, height: size, borderRadius: size * 0.3, backgroundColor: folder.color + '26' }]}>
      <Text style={{ fontSize: size * 0.5 }}>{folder.emoji}</Text>
    </View>
  );
}

function FolderRowBase({
  folder,
  count,
  subfolders,
  onPress,
  onLongPress,
}: {
  folder: Folder;
  count: number;
  subfolders: number;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const { c } = useTheme();
  const detail = [`${count} ${count === 1 ? 'item' : 'items'}`, subfolders ? `${subfolders} ${subfolders === 1 ? 'folder' : 'folders'}` : null]
    .filter(Boolean)
    .join(' · ');
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={`${folder.name}, ${detail}`}
      style={({ pressed }) => [styles.folderRow, { backgroundColor: c.surface, borderColor: c.border, opacity: pressed ? 0.85 : 1 }]}
    >
      <FolderBubble folder={folder} />
      <View style={{ flex: 1 }}>
        <Txt variant="bodyStrong" numberOfLines={1}>
          {folder.name}
        </Txt>
        <Txt variant="small" color={c.textMuted} style={{ marginTop: 2 }}>
          {detail}
          {folder.keywords.length ? ' · auto-collects' : ''}
        </Txt>
      </View>
      <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
    </Pressable>
  );
}

export const FolderRow = memo(FolderRowBase);

export function FolderTile({ folder, count, onPress }: { folder: Folder; count: number; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${folder.name}, ${count} items`}
      style={({ pressed }) => [styles.tile, { backgroundColor: c.surface, borderColor: c.border, opacity: pressed ? 0.85 : 1 }]}
    >
      <FolderBubble folder={folder} size={36} />
      <Txt variant="bodyStrong" numberOfLines={1} style={{ marginTop: space.sm }}>
        {folder.name}
      </Txt>
      <Txt variant="small" color={c.textMuted}>
        {count} {count === 1 ? 'item' : 'items'}
      </Txt>
    </Pressable>
  );
}

export function Breadcrumbs({ tree, folderId, onNavigate }: { tree: FolderTree; folderId: string; onNavigate: (id: string | null) => void }) {
  const { c } = useTheme();
  const path = getPath(tree, folderId);
  if (path.length <= 1) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.crumbs}>
      <Pressable onPress={() => onNavigate(null)} hitSlop={6} accessibilityRole="link" accessibilityLabel="All folders">
        <Txt variant="caption" color={c.accent}>
          Folders
        </Txt>
      </Pressable>
      {path.slice(0, -1).map(f => (
        <View key={f.id} style={styles.crumb}>
          <Ionicons name="chevron-forward" size={12} color={c.textMuted} />
          <Pressable onPress={() => onNavigate(f.id)} hitSlop={6} accessibilityRole="link">
            <Txt variant="caption" color={c.accent}>
              {f.emoji} {f.name}
            </Txt>
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}

/**
 * Pick one or more folders from the tree. Shows every level (expand/collapse),
 * supports search and creating a folder in place.
 */
export function FolderPickerSheet({
  visible,
  tree,
  title = 'Choose folders',
  subtitle,
  initialSelected,
  multiple = true,
  excludeSubtreeOf,
  allowRoot,
  confirmLabel = 'Done',
  onCreateFolder,
  onConfirm,
  onClose,
}: {
  visible: boolean;
  tree: FolderTree;
  title?: string;
  subtitle?: string;
  initialSelected: string[];
  multiple?: boolean;
  /** When moving a folder, it can't go inside itself. */
  excludeSubtreeOf?: string;
  /** Offer "Top level" as a choice (moving folders). */
  allowRoot?: boolean;
  confirmLabel?: string;
  onCreateFolder?: (parentId: string | null, name: string) => Promise<Folder>;
  onConfirm: (selected: string[]) => void;
  onClose: () => void;
}) {
  const { c } = useTheme();
  const [selected, setSelected] = useState<string[]>(initialSelected);
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const open = new Set<string>();
    for (const id of initialSelected) for (const f of getPath(tree, id).slice(0, -1)) open.add(f.id);
    return open;
  });
  const [query, setQuery] = useState('');
  const [creatingIn, setCreatingIn] = useState<string | null | undefined>(undefined);
  const [newName, setNewName] = useState('');

  React.useEffect(() => {
    if (visible) {
      setSelected(initialSelected);
      setQuery('');
      setCreatingIn(undefined);
    }
  }, [visible]);

  const excluded = useMemo(
    () => (excludeSubtreeOf ? new Set([excludeSubtreeOf, ...getDescendantIds(tree, excludeSubtreeOf)]) : new Set<string>()),
    [excludeSubtreeOf, tree],
  );

  const rows = useMemo(() => {
    const q = normalizeText(query).trim();
    if (q) {
      return [...tree.byId.values()]
        .filter(f => !excluded.has(f.id) && normalizeText(pathLabel(tree, f.id)).includes(q))
        .map(f => ({ folder: f, depth: 0, hasChildren: false, label: pathLabel(tree, f.id) }));
    }
    const out: { folder: Folder; depth: number; hasChildren: boolean; label?: string }[] = [];
    const walk = (parentId: string | null, depth: number) => {
      for (const f of childrenOf(tree, parentId)) {
        if (excluded.has(f.id)) continue;
        const kids = childrenOf(tree, f.id).filter(k => !excluded.has(k.id));
        out.push({ folder: f, depth, hasChildren: kids.length > 0 });
        if (expanded.has(f.id)) walk(f.id, depth + 1);
      }
    };
    walk(null, 0);
    return out;
  }, [tree, expanded, query, excluded]);

  const toggle = (id: string) => {
    if (multiple) setSelected(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]));
    else setSelected([id]);
  };

  const create = async () => {
    const name = newName.trim();
    if (!name || !onCreateFolder || creatingIn === undefined) return;
    const folder = await onCreateFolder(creatingIn, name);
    setNewName('');
    setCreatingIn(undefined);
    if (folder.parentId) setExpanded(e => new Set(e).add(folder.parentId!));
    if (multiple) setSelected(s => [...s, folder.id]);
    else setSelected([folder.id]);
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={title} subtitle={subtitle} fullHeight>
      <View style={{ paddingHorizontal: space.lg, marginBottom: space.sm }}>
        <SearchField value={query} onChangeText={setQuery} placeholder="Find a folder" />
      </View>
      {allowRoot ? (
        <Pressable
          onPress={() => setSelected(['@root'])}
          style={[styles.pickRow, { paddingLeft: space.lg }]}
          accessibilityRole="button"
          accessibilityState={{ selected: selected.includes('@root') }}
        >
          <View style={[styles.bubble, { width: 34, height: 34, borderRadius: 10, backgroundColor: c.surfaceAlt }]}>
            <Ionicons name="albums-outline" size={18} color={c.textSecondary} />
          </View>
          <Txt variant="body" style={{ flex: 1 }}>
            Top level
          </Txt>
          <Ionicons
            name={selected.includes('@root') ? 'radio-button-on' : 'radio-button-off'}
            size={22}
            color={selected.includes('@root') ? c.accent : c.textMuted}
          />
        </Pressable>
      ) : null}
      <FlatList
        data={rows}
        keyExtractor={r => r.folder.id}
        style={{ flexGrow: 0 }}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <Txt variant="caption" color={c.textMuted} style={{ textAlign: 'center', padding: space.xl }}>
            {query ? 'No folders match.' : 'No folders yet — create one below.'}
          </Txt>
        }
        renderItem={({ item: r }) => {
          const isSel = selected.includes(r.folder.id);
          const isOpen = expanded.has(r.folder.id);
          return (
            <View style={[styles.pickRow, { paddingLeft: space.lg + r.depth * 22 }]}>
              <Pressable
                onPress={() =>
                  r.hasChildren &&
                  setExpanded(e => {
                    const n = new Set(e);
                    if (n.has(r.folder.id)) n.delete(r.folder.id);
                    else n.add(r.folder.id);
                    return n;
                  })
                }
                hitSlop={8}
                style={{ width: 20 }}
                accessibilityLabel={isOpen ? 'Collapse' : 'Expand'}
                disabled={!r.hasChildren}
              >
                {r.hasChildren ? <Ionicons name={isOpen ? 'chevron-down' : 'chevron-forward'} size={16} color={c.textMuted} /> : null}
              </Pressable>
              <Pressable
                onPress={() => toggle(r.folder.id)}
                style={styles.pickMain}
                accessibilityRole="button"
                accessibilityState={{ selected: isSel }}
              >
                <FolderBubble folder={r.folder} size={34} />
                <Txt variant="body" numberOfLines={1} style={{ flex: 1 }}>
                  {r.label ?? r.folder.name}
                </Txt>
                <Ionicons
                  name={multiple ? (isSel ? 'checkbox' : 'square-outline') : isSel ? 'radio-button-on' : 'radio-button-off'}
                  size={22}
                  color={isSel ? c.accent : c.textMuted}
                />
              </Pressable>
              {onCreateFolder ? (
                <Pressable
                  onPress={() => setCreatingIn(r.folder.id)}
                  hitSlop={8}
                  accessibilityLabel={`New folder inside ${r.folder.name}`}
                  style={{ paddingHorizontal: space.sm }}
                >
                  <Ionicons name="add-circle-outline" size={20} color={c.textMuted} />
                </Pressable>
              ) : null}
            </View>
          );
        }}
      />
      {onCreateFolder ? (
        creatingIn !== undefined ? (
          <View style={[styles.createBox, { borderColor: c.border, backgroundColor: c.surface }]}>
            <Txt variant="small" color={c.textMuted}>
              {creatingIn ? `New folder inside ${pathLabel(tree, creatingIn)}` : 'New top-level folder'}
            </Txt>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm }}>
              <View style={{ flex: 1 }}>
                <SearchField value={newName} onChangeText={setNewName} placeholder="Folder name" autoFocus />
              </View>
              <Button title="Add" compact onPress={create} disabled={!newName.trim()} />
            </View>
          </View>
        ) : (
          <Pressable onPress={() => setCreatingIn(null)} style={styles.newFolder} accessibilityRole="button">
            <Ionicons name="add" size={18} color={c.accent} />
            <Txt variant="bodyStrong" color={c.accent}>
              New folder
            </Txt>
          </Pressable>
        )
      ) : null}
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm }}>
        <Button
          title={confirmLabel}
          onPress={() => onConfirm(selected)}
          disabled={!multiple && selected.length === 0}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  bubble: { alignItems: 'center', justifyContent: 'center' },
  folderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: space.sm,
  },
  tile: {
    width: 132,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginRight: space.sm,
  },
  crumbs: { alignItems: 'center', gap: 6, paddingHorizontal: space.lg, paddingBottom: space.sm },
  crumb: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pickRow: { flexDirection: 'row', alignItems: 'center', paddingRight: space.md, minHeight: 50 },
  pickMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 8 },
  createBox: { marginHorizontal: space.lg, marginTop: space.sm, padding: space.md, borderRadius: radius.md, borderWidth: 1 },
  newFolder: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.lg, paddingVertical: space.md },
});

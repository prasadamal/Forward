import React, { useMemo, useState } from 'react';
import { ActionSheetIOS, Alert, FlatList, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { INBOX, PINNED, RootStackParamList, TRASH } from '../navigation/types';
import { useVault } from '../store/vault';
import { sortItems, useFolderCounts, useFolderTree } from '../store/selectors';
import { childrenOf, getDescendantIds, pathLabel } from '../folders/tree';
import { isWalletType, Item, ItemType } from '../types';
import { radius, space, useTheme } from '../theme';
import { Button, Chip, EmptyState, Header, IconButton, Screen, Txt } from '../ui/primitives';
import { ItemRow } from '../ui/items';
import { Breadcrumbs, FolderBubble, FolderPickerSheet, FolderRow } from '../ui/folders';
import { AddSheet } from '../ui/AddSheet';
import { toast } from '../ui/Toast';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'Folder'>;

const TYPE_FILTERS: { key: 'all' | ItemType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'link', label: 'Links' },
  { key: 'image', label: 'Images' },
  { key: 'video', label: 'Videos' },
  { key: 'note', label: 'Notes' },
  { key: 'file', label: 'Files' },
  { key: 'card', label: 'Cards' },
  { key: 'login', label: 'Logins' },
  { key: 'secret', label: 'Secrets' },
];

export default function FolderScreen() {
  const { c } = useTheme();
  const nav = useNavigation<Nav>();
  const { folderId } = useRoute<Route>().params;
  const tree = useFolderTree();
  const counts = useFolderCounts();
  const allItems = useVault(s => s.items);
  const setItemFolders = useVault(s => s.setItemFolders);
  const trashItems = useVault(s => s.trashItems);
  const restoreItems = useVault(s => s.restoreItems);
  const deleteItemsForever = useVault(s => s.deleteItemsForever);
  const emptyTrash = useVault(s => s.emptyTrash);
  const createFolder = useVault(s => s.createFolder);
  const deleteFolder = useVault(s => s.deleteFolder);
  const moveFolder = useVault(s => s.moveFolder);

  const folder = tree.byId.get(folderId);
  const isVirtual = folderId === INBOX || folderId === PINNED || folderId === TRASH;
  const [includeSub, setIncludeSub] = useState(true);
  const [typeFilter, setTypeFilter] = useState<'all' | ItemType>('all');
  const [selected, setSelected] = useState<string[]>([]);
  const [picker, setPicker] = useState<'items' | 'folder' | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const selecting = selected.length > 0;

  const subfolders = folder ? childrenOf(tree, folder.id) : [];

  const items = useMemo(() => {
    let list: Item[];
    if (folderId === TRASH) list = allItems.filter(i => i.trashedAt);
    else if (folderId === PINNED) list = allItems.filter(i => !i.trashedAt && i.pinned);
    else if (folderId === INBOX) list = allItems.filter(i => !i.trashedAt && !i.folderIds.length && !isWalletType(i.type));
    else {
      const ids = new Set([folderId, ...(includeSub ? getDescendantIds(tree, folderId) : [])]);
      list = allItems.filter(i => !i.trashedAt && i.folderIds.some(f => ids.has(f)));
    }
    return folderId === TRASH ? [...list].sort((a, b) => (b.trashedAt ?? 0) - (a.trashedAt ?? 0)) : sortItems(list);
  }, [allItems, folderId, includeSub, tree]);

  const typeCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of items) m.set(i.type, (m.get(i.type) ?? 0) + 1);
    return m;
  }, [items]);
  const shown = typeFilter === 'all' ? items : items.filter(i => i.type === typeFilter);

  if (!folder && !isVirtual) {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} />
        <EmptyState emoji="🤷" title="Folder not found" body="It may have been deleted." />
      </Screen>
    );
  }

  const title =
    folderId === INBOX ? 'Inbox' : folderId === PINNED ? 'Pinned' : folderId === TRASH ? 'Trash' : `${folder!.name}`;
  const subtitle =
    folderId === INBOX
      ? 'Not in any folder yet. Select items to move them.'
      : folderId === TRASH
        ? 'Items here are deleted for good after 30 days.'
        : `${items.length} ${items.length === 1 ? 'item' : 'items'}${subfolders.length ? ` · ${subfolders.length} ${subfolders.length === 1 ? 'folder' : 'folders'}` : ''}`;

  const relativeLabel = (item: Item) => {
    if (!folder) return item.folderIds.length ? pathLabel(tree, item.folderIds[0]) : 'Inbox';
    const inside = item.folderIds.find(id => id !== folder.id && getDescendantIds(tree, folder.id).includes(id));
    return inside ? pathLabel(tree, inside).split(' › ').slice(-1)[0] : undefined;
  };

  const toggleSelect = (id: string) => setSelected(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]));

  const folderMenu = () => {
    if (!folder) return;
    const actions: { label: string; destructive?: boolean; run: () => void }[] = [
      { label: 'Edit folder', run: () => nav.navigate('FolderEdit', { folderId: folder.id }) },
      { label: 'New folder inside', run: () => nav.navigate('FolderEdit', { parentId: folder.id }) },
      { label: 'Move folder…', run: () => setPicker('folder') },
      {
        label: 'Delete folder…',
        destructive: true,
        run: () =>
          Alert.alert(
            `Delete “${folder.name}”?`,
            subfolders.length
              ? 'Its subfolders will be deleted too. What should happen to the items inside?'
              : 'What should happen to the items inside?',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Keep items',
                onPress: async () => {
                  await deleteFolder(folder.id, 'keep');
                  nav.goBack();
                },
              },
              {
                text: 'Move items to Trash',
                style: 'destructive',
                onPress: async () => {
                  await deleteFolder(folder.id, 'trash');
                  nav.goBack();
                },
              },
            ],
          ),
      },
    ];
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [...actions.map(a => a.label), 'Cancel'],
          cancelButtonIndex: actions.length,
          destructiveButtonIndex: actions.findIndex(a => a.destructive),
        },
        i => actions[i]?.run(),
      );
    } else {
      Alert.alert(folder.name, undefined, [
        ...actions.map(a => ({ text: a.label, style: a.destructive ? ('destructive' as const) : ('default' as const), onPress: a.run })),
        { text: 'Cancel', style: 'cancel' as const },
      ]);
    }
  };

  const moveSelected = async (targets: string[]) => {
    setPicker(null);
    for (const id of selected) await setItemFolders(id, targets);
    toast(`Moved ${selected.length} ${selected.length === 1 ? 'item' : 'items'}`);
    setSelected([]);
  };

  const headerRight = selecting ? (
    <Button title="Cancel" variant="ghost" compact onPress={() => setSelected([])} />
  ) : folderId === TRASH ? (
    items.length ? (
      <Button
        title="Empty"
        variant="danger"
        compact
        onPress={() =>
          Alert.alert('Empty Trash?', `${items.length} ${items.length === 1 ? 'item' : 'items'} will be deleted permanently.`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete all', style: 'destructive', onPress: () => void emptyTrash() },
          ])
        }
      />
    ) : null
  ) : (
    <>
      {folder ? <IconButton name="ellipsis-horizontal" label="Folder options" onPress={folderMenu} /> : null}
      {folderId !== PINNED ? <IconButton name="add" filled label="Add here" onPress={() => setAddOpen(true)} /> : null}
    </>
  );

  return (
    <Screen>
      <FlatList
        data={shown}
        keyExtractor={i => i.id}
        contentContainerStyle={{ paddingBottom: selecting ? 120 : 48 }}
        ListHeaderComponent={
          <View>
            <Header onBack={() => nav.goBack()} right={headerRight} />
            {folder ? (
              <Breadcrumbs
                tree={tree}
                folderId={folder.id}
                onNavigate={id => (id ? nav.push('Folder', { folderId: id }) : nav.navigate('Tabs', { screen: 'Folders' }))}
              />
            ) : null}
            <View style={styles.titleRow}>
              {folder ? <FolderBubble folder={folder} size={48} /> : null}
              <View style={{ flex: 1 }}>
                <Txt variant="title" numberOfLines={2}>
                  {title}
                </Txt>
                <Txt variant="caption" color={c.textSecondary} style={{ marginTop: 2 }}>
                  {subtitle}
                </Txt>
              </View>
            </View>
            {folder?.keywords.length ? (
              <Pressable onPress={() => nav.navigate('FolderEdit', { folderId: folder.id })} style={styles.rules} accessibilityRole="button">
                <Ionicons name="sparkles-outline" size={14} color={c.accent} />
                <Txt variant="small" color={c.textSecondary} numberOfLines={1} style={{ flex: 1 }}>
                  Auto-collects items mentioning {folder.keywords.map(k => `“${k}”`).join(', ')}
                </Txt>
              </Pressable>
            ) : null}

            {subfolders.length ? (
              <View style={{ paddingHorizontal: space.lg, marginTop: space.md }}>
                {subfolders.map(f => (
                  <FolderRow
                    key={f.id}
                    folder={f}
                    count={counts.total.get(f.id) ?? 0}
                    subfolders={childrenOf(tree, f.id).length}
                    onPress={() => nav.push('Folder', { folderId: f.id })}
                    onLongPress={() => nav.navigate('FolderEdit', { folderId: f.id })}
                  />
                ))}
              </View>
            ) : null}

            {items.length ? (
              <FlatList
                horizontal
                data={TYPE_FILTERS.filter(f => f.key === 'all' || typeCounts.get(f.key))}
                keyExtractor={f => f.key}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: space.lg, gap: space.sm, paddingVertical: space.md }}
                renderItem={({ item: f }) => (
                  <Chip
                    label={f.label}
                    selected={typeFilter === f.key}
                    count={f.key === 'all' ? undefined : typeCounts.get(f.key)}
                    onPress={() => setTypeFilter(f.key)}
                  />
                )}
                ListFooterComponent={
                  folder && subfolders.length ? (
                    <Chip
                      label={includeSub ? 'Including subfolders' : 'This folder only'}
                      icon={includeSub ? '🗂️' : '📁'}
                      onPress={() => setIncludeSub(v => !v)}
                    />
                  ) : null
                }
              />
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: space.lg }}>
            <ItemRow
              item={item}
              folderLabel={relativeLabel(item)}
              selected={selected.includes(item.id)}
              onPress={() => (selecting ? toggleSelect(item.id) : nav.navigate('Item', { itemId: item.id }))}
              onLongPress={() => toggleSelect(item.id)}
            />
          </View>
        )}
        ListEmptyComponent={
          folderId === TRASH ? (
            <EmptyState emoji="🗑️" title="Trash is empty" />
          ) : folderId === INBOX ? (
            <EmptyState emoji="✨" title="All sorted" body="Everything you’ve forwarded is in a folder." />
          ) : folderId === PINNED ? (
            <EmptyState emoji="📌" title="Nothing pinned" body="Pin things you want to find quickly from their detail page." />
          ) : subfolders.length ? null : (
            <EmptyState
              emoji="📭"
              title="Empty folder"
              body="Forward things here from any app, or move items in from another folder."
              action={{ label: 'Add something', icon: 'add', onPress: () => setAddOpen(true) }}
            />
          )
        }
      />

      {selecting ? (
        <View style={[styles.selectionBar, { backgroundColor: c.elevated, borderColor: c.border }]}>
          <Txt variant="bodyStrong" style={{ flex: 1 }}>
            {selected.length} selected
          </Txt>
          {folderId === TRASH ? (
            <>
              <Button
                title="Restore"
                compact
                variant="secondary"
                onPress={async () => {
                  await restoreItems(selected);
                  setSelected([]);
                }}
              />
              <Button
                title="Delete"
                compact
                variant="danger"
                onPress={() =>
                  Alert.alert('Delete permanently?', 'This can’t be undone.', [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: async () => {
                        await deleteItemsForever(selected);
                        setSelected([]);
                      },
                    },
                  ])
                }
              />
            </>
          ) : (
            <>
              <Button title="Move" icon="folder-outline" compact variant="secondary" onPress={() => setPicker('items')} />
              <Button
                title="Delete"
                compact
                variant="danger"
                onPress={async () => {
                  await trashItems(selected);
                  toast(`Moved ${selected.length} to Trash`, 'trash');
                  setSelected([]);
                }}
              />
            </>
          )}
        </View>
      ) : null}

      <FolderPickerSheet
        visible={picker === 'items'}
        tree={tree}
        title={`Move ${selected.length} ${selected.length === 1 ? 'item' : 'items'}`}
        subtitle="Choose one or more folders."
        initialSelected={folder ? [folder.id] : []}
        confirmLabel="Move"
        onCreateFolder={(parentId, name) => createFolder({ parentId, name })}
        onConfirm={moveSelected}
        onClose={() => setPicker(null)}
      />
      {folder ? (
        <FolderPickerSheet
          visible={picker === 'folder'}
          tree={tree}
          title={`Move “${folder.name}”`}
          subtitle="Pick where this folder should live."
          initialSelected={[folder.parentId ?? '@root']}
          multiple={false}
          allowRoot
          excludeSubtreeOf={folder.id}
          confirmLabel="Move here"
          onConfirm={async ([target]) => {
            setPicker(null);
            try {
              await moveFolder(folder.id, target === '@root' ? null : target);
              toast('Folder moved');
            } catch (e) {
              Alert.alert('Can’t move folder', e instanceof Error ? e.message : String(e));
            }
          }}
          onClose={() => setPicker(null)}
        />
      ) : null}
      <AddSheet visible={addOpen} onClose={() => setAddOpen(false)} folderId={folder?.id} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg },
  rules: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: space.lg,
    marginTop: space.md,
  },
  selectionBar: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    bottom: space.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
});

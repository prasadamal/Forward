import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, INBOX } from '../navigation/types';
import { useVault } from '../store/vault';
import { folderLabelFor, sortItems, useFolderCounts, useFolderTree, useLibraryItems } from '../store/selectors';
import { childrenOf } from '../folders/tree';
import { ItemType } from '../types';
import { radius, space, useTheme } from '../theme';
import { Banner, Chip, EmptyState, IconButton, Screen, Txt } from '../ui/primitives';
import { ItemRow } from '../ui/items';
import { FolderTile } from '../ui/folders';
import { AddSheet } from '../ui/AddSheet';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Filter = 'all' | Extract<ItemType, 'link' | 'image' | 'video' | 'note' | 'file'>;

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'link', label: 'Links' },
  { key: 'image', label: 'Images' },
  { key: 'video', label: 'Videos' },
  { key: 'note', label: 'Notes' },
  { key: 'file', label: 'Files' },
];

export default function HomeScreen() {
  const { c } = useTheme();
  const nav = useNavigation<Nav>();
  const items = useLibraryItems();
  const tree = useFolderTree();
  const counts = useFolderCounts();
  const lock = useVault(s => s.lock);
  const notice = useVault(s => s.notice);
  const dismissNotice = useVault(s => s.dismissNotice);
  const [filter, setFilter] = useState<Filter>('all');
  const [addOpen, setAddOpen] = useState(false);

  const inboxCount = useMemo(() => items.filter(i => i.folderIds.length === 0).length, [items]);
  const topFolders = useMemo(
    () =>
      [...childrenOf(tree, null)]
        .sort((a, b) => (counts.total.get(b.id) ?? 0) - (counts.total.get(a.id) ?? 0) || a.name.localeCompare(b.name))
        .slice(0, 12),
    [tree, counts],
  );
  const visible = useMemo(() => sortItems(filter === 'all' ? items : items.filter(i => i.type === filter)), [items, filter]);
  const typeCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of items) m.set(i.type, (m.get(i.type) ?? 0) + 1);
    return m;
  }, [items]);

  const header = (
    <View>
      <View style={styles.titleRow}>
        <View style={{ flex: 1 }}>
          <Txt variant="largeTitle">Forward</Txt>
          <Txt variant="caption" color={c.textSecondary}>
            {items.length} saved · encrypted on this phone
          </Txt>
        </View>
        <IconButton name="search" label="Search" onPress={() => nav.navigate('Search')} />
        <IconButton name="lock-closed-outline" label="Lock now" onPress={() => void lock()} />
      </View>

      <Pressable
        onPress={() => nav.navigate('Search')}
        style={[styles.searchStub, { backgroundColor: c.surfaceAlt }]}
        accessibilityRole="search"
        accessibilityLabel="Search everything"
      >
        <Ionicons name="search" size={17} color={c.textMuted} />
        <Txt variant="body" color={c.textMuted}>
          Search places, topics, notes…
        </Txt>
      </Pressable>

      {notice ? (
        <View style={styles.block}>
          <Banner tone="success" icon="shield-checkmark" title="Upgraded to an encrypted vault" body={notice} onClose={dismissNotice} />
        </View>
      ) : null}

      {inboxCount > 0 ? (
        <View style={styles.block}>
          <Banner
            icon="file-tray-full-outline"
            title={`${inboxCount} ${inboxCount === 1 ? 'item needs' : 'items need'} a folder`}
            body="Forward couldn’t tell where these belong. Tap to sort them."
            onPress={() => nav.navigate('Folder', { folderId: INBOX })}
          />
        </View>
      ) : null}

      {topFolders.length ? (
        <>
          <View style={styles.sectionHead}>
            <Txt variant="h3">Folders</Txt>
            <Pressable onPress={() => nav.navigate('Tabs', { screen: 'Folders' })} hitSlop={8} accessibilityRole="button">
              <Txt variant="caption" color={c.accent}>
                See all
              </Txt>
            </Pressable>
          </View>
          <FlatList
            horizontal
            data={topFolders}
            keyExtractor={f => f.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: space.lg }}
            renderItem={({ item: f }) => (
              <FolderTile folder={f} count={counts.total.get(f.id) ?? 0} onPress={() => nav.navigate('Folder', { folderId: f.id })} />
            )}
          />
        </>
      ) : null}

      <View style={styles.sectionHead}>
        <Txt variant="h3">Recently forwarded</Txt>
      </View>
      <FlatList
        horizontal
        data={FILTERS.filter(f => f.key === 'all' || typeCounts.get(f.key))}
        keyExtractor={f => f.key}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: space.lg, gap: space.sm, paddingBottom: space.md }}
        renderItem={({ item: f }) => (
          <Chip
            label={f.label}
            selected={filter === f.key}
            count={f.key === 'all' ? undefined : typeCounts.get(f.key)}
            onPress={() => setFilter(f.key)}
          />
        )}
      />
    </View>
  );

  return (
    <Screen>
      <FlatList
        data={visible}
        keyExtractor={i => i.id}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: 120 }}
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: space.lg }}>
            <ItemRow item={item} folderLabel={folderLabelFor(tree, item)} onPress={() => nav.navigate('Item', { itemId: item.id })} />
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            emoji="📮"
            title={items.length ? 'Nothing here' : 'Nothing forwarded yet'}
            body={
              items.length
                ? 'Try another filter.'
                : 'In YouTube, Instagram, X, WhatsApp or Photos, tap Share and choose Forward. It’ll be saved and sorted here.'
            }
            action={items.length ? undefined : { label: 'Add something', icon: 'add', onPress: () => setAddOpen(true) }}
          />
        }
      />
      <Pressable
        onPress={() => setAddOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Add"
        style={({ pressed }) => [styles.fab, { backgroundColor: c.accent, opacity: pressed ? 0.85 : 1 }]}
      >
        <Ionicons name="add" size={30} color={c.onAccent} />
      </Pressable>
      <AddSheet visible={addOpen} onClose={() => setAddOpen(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.md },
  searchStub: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginHorizontal: space.lg,
    marginTop: space.lg,
    height: 42,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
  },
  block: { paddingHorizontal: space.lg, marginTop: space.md },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    marginTop: space.xl,
    marginBottom: space.md,
  },
  fab: {
    position: 'absolute',
    right: space.xl,
    bottom: space.xl,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
});

import React, { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useVault } from '../store/vault';
import { folderLabelFor, searchItems, sortItems, useFolderCounts, useFolderTree } from '../store/selectors';
import { childrenOf, pathLabel } from '../folders/tree';
import { normalizeText } from '../organizer/text';
import { space, useTheme } from '../theme';
import { Button, EmptyState, Screen, SearchField, Txt } from '../ui/primitives';
import { ItemRow } from '../ui/items';
import { FolderRow } from '../ui/folders';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function SearchScreen() {
  const { c } = useTheme();
  const nav = useNavigation<Nav>();
  const items = useVault(s => s.items);
  const tree = useFolderTree();
  const counts = useFolderCounts();
  const [query, setQuery] = useState('');

  const folderHits = useMemo(() => {
    const q = normalizeText(query).trim();
    if (!q) return [];
    return [...tree.byId.values()]
      .filter(f => normalizeText(`${f.name} ${f.keywords.join(' ')}`).includes(` ${q}`))
      .slice(0, 6);
  }, [query, tree]);

  const results = useMemo(() => sortItems(searchItems(items, tree, query)).slice(0, 300), [items, tree, query]);

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.md }}>
        <View style={{ flex: 1 }}>
          <SearchField value={query} onChangeText={setQuery} placeholder="Search places, topics, notes…" autoFocus />
        </View>
        <Button title="Cancel" variant="ghost" compact onPress={() => nav.goBack()} />
      </View>
      <FlatList
        data={results}
        keyExtractor={i => i.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: 48 }}
        ListHeaderComponent={
          folderHits.length ? (
            <View style={{ marginBottom: space.md }}>
              <Txt variant="label" color={c.textMuted} style={{ marginBottom: space.sm }}>
                Folders
              </Txt>
              {folderHits.map(f => (
                <FolderRow
                  key={f.id}
                  folder={{ ...f, name: pathLabel(tree, f.id) }}
                  count={counts.total.get(f.id) ?? 0}
                  subfolders={childrenOf(tree, f.id).length}
                  onPress={() => nav.navigate('Folder', { folderId: f.id })}
                />
              ))}
              {results.length ? (
                <Txt variant="label" color={c.textMuted} style={{ marginTop: space.md, marginBottom: space.sm }}>
                  Items
                </Txt>
              ) : null}
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <ItemRow item={item} folderLabel={folderLabelFor(tree, item)} onPress={() => nav.navigate('Item', { itemId: item.id })} />
        )}
        ListEmptyComponent={
          query.trim() && !folderHits.length ? (
            <EmptyState emoji="🔍" title="No matches" body="Try a place, a topic, a site or a word from your notes." />
          ) : !query.trim() ? (
            <EmptyState emoji="🔎" title="Search everything" body="Titles, notes, links, tags, folders, card and login names. Secret values are never searched." />
          ) : null
        }
      />
    </Screen>
  );
}

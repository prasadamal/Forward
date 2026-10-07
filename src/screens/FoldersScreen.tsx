import React, { useMemo } from 'react';
import { FlatList, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { INBOX, PINNED, RootStackParamList, TRASH } from '../navigation/types';
import { useVault } from '../store/vault';
import { useFolderCounts, useFolderTree } from '../store/selectors';
import { childrenOf } from '../folders/tree';
import { space, useTheme } from '../theme';
import { EmptyState, Header, IconButton, ListRow, Screen, Section, Txt } from '../ui/primitives';
import { FolderRow } from '../ui/folders';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function FoldersScreen() {
  const { c } = useTheme();
  const nav = useNavigation<Nav>();
  const tree = useFolderTree();
  const counts = useFolderCounts();
  const items = useVault(s => s.items);
  const top = childrenOf(tree, null);

  const special = useMemo(() => {
    let inbox = 0;
    let pinned = 0;
    let trash = 0;
    for (const i of items) {
      if (i.trashedAt) trash++;
      else {
        if (i.pinned) pinned++;
        if (!i.folderIds.length && i.type !== 'card' && i.type !== 'login' && i.type !== 'secret') inbox++;
      }
    }
    return { inbox, pinned, trash };
  }, [items]);

  return (
    <Screen>
      <FlatList
        data={top}
        keyExtractor={f => f.id}
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: 48 }}
        ListHeaderComponent={
          <View>
            <View style={{ marginHorizontal: -space.lg }}>
              <Header
                title="Folders"
                large
                subtitle="Folders inside folders, as deep as you like."
                right={<IconButton name="add" filled label="New folder" onPress={() => nav.navigate('FolderEdit', { parentId: null })} />}
              />
            </View>
            <Section>
              <ListRow
                title="Inbox"
                subtitle="Forwarded items that aren’t in a folder yet"
                icon="file-tray-outline"
                value={String(special.inbox)}
                chevron
                onPress={() => nav.navigate('Folder', { folderId: INBOX })}
              />
              <ListRow
                title="Pinned"
                icon="pin-outline"
                iconColor={c.warning}
                value={String(special.pinned)}
                chevron
                onPress={() => nav.navigate('Folder', { folderId: PINNED })}
              />
              <ListRow
                title="Trash"
                subtitle="Deleted after 30 days"
                icon="trash-outline"
                iconColor={c.danger}
                value={String(special.trash)}
                chevron
                last
                onPress={() => nav.navigate('Folder', { folderId: TRASH })}
              />
            </Section>
            {top.length ? (
              <Txt variant="label" color={c.textMuted} style={{ marginBottom: space.sm, marginLeft: space.xs }}>
                Your folders
              </Txt>
            ) : null}
          </View>
        }
        renderItem={({ item: f }) => (
          <FolderRow
            folder={f}
            count={counts.total.get(f.id) ?? 0}
            subfolders={childrenOf(tree, f.id).length}
            onPress={() => nav.navigate('Folder', { folderId: f.id })}
            onLongPress={() => nav.navigate('FolderEdit', { folderId: f.id })}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            emoji="🗂️"
            title="Folders make themselves"
            body="Forward something about Bangalore and a Bangalore folder appears — with Food, Places to Visit and more inside. You can also create your own."
            action={{ label: 'New folder', icon: 'add', onPress: () => nav.navigate('FolderEdit', { parentId: null }) }}
          />
        }
      />
    </Screen>
  );
}

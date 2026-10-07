import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Platform, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useVault } from '../store/vault';
import { useFolderTree, useItem } from '../store/selectors';
import { IngestOutcome } from '../ingest/ingest';
import { MAX_FILE_BYTES } from '../ingest/mediaTypes';
import { pathLabel } from '../folders/tree';
import { formatBytes } from '../utils/encoding';
import { radius, space, useTheme } from '../theme';
import { Button, Chip, Header, IconButton, Screen, Scroll, TextField, Txt } from '../ui/primitives';
import { SourceBadge, Thumb } from '../ui/items';
import { FolderPickerSheet } from '../ui/folders';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'Forwarded'>;

function failureText(o: Extract<IngestOutcome, { status: 'failed' }>): string {
  if (o.reason === 'too-large') return `${o.name ?? 'File'} is larger than ${formatBytes(MAX_FILE_BYTES)}.`;
  if (o.reason === 'unreadable') return `${o.name ?? 'A file'} couldn’t be read.`;
  return `${o.name ?? 'Something'} couldn’t be saved.`;
}

function Result({ outcome, onOpen, onPickFolders }: { outcome: IngestOutcome; onOpen: (id: string) => void; onPickFolders: (id: string) => void }) {
  const { c } = useTheme();
  const tree = useFolderTree();
  const item = useItem(outcome.status === 'failed' ? undefined : outcome.itemId);
  const linkPreviews = useVault(s => s.settings.linkPreviews);

  if (outcome.status === 'failed') {
    return (
      <View style={[styles.card, { backgroundColor: c.dangerSoft, borderColor: 'transparent' }]}>
        <Ionicons name="alert-circle" size={20} color={c.danger} />
        <Txt variant="caption" color={c.danger} style={{ flex: 1 }}>
          {failureText(outcome)}
        </Txt>
      </View>
    );
  }
  if (!item) return null;

  const folders = item.folderIds.filter(id => tree.byId.has(id));
  const reading = item.type === 'link' && linkPreviews && !item.meta.link?.previewAt && item.filing === 'auto';

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border, flexDirection: 'column', alignItems: 'stretch' }]}>
      <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
        <Thumb item={item} size={56} />
        <View style={{ flex: 1, gap: 4 }}>
          <Txt variant="bodyStrong" numberOfLines={2}>
            {item.title}
          </Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <SourceBadge item={item} />
            {outcome.status === 'duplicate' ? (
              <Txt variant="small" color={c.warning}>
                Already saved
              </Txt>
            ) : null}
          </View>
        </View>
      </View>

      <View style={[styles.filed, { borderTopColor: c.border }]}>
        <Txt variant="label" color={c.textMuted}>
          {folders.length ? 'Filed in' : 'Not sorted yet'}
        </Txt>
        <View style={styles.chips}>
          {folders.map(id => (
            <Chip key={id} label={pathLabel(tree, id)} icon={tree.byId.get(id)!.emoji} onPress={() => onPickFolders(item.id)} />
          ))}
          {!folders.length ? (
            <Chip label="Inbox — pick a folder" icon="📥" onPress={() => onPickFolders(item.id)} />
          ) : null}
        </View>
        {reading ? (
          <View style={styles.reading}>
            <ActivityIndicator size="small" color={c.accent} />
            <Txt variant="small" color={c.textSecondary}>
              Reading the link to sort it…
            </Txt>
          </View>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
        <Button title="Change folder" icon="folder-open-outline" compact variant="secondary" onPress={() => onPickFolders(item.id)} style={{ flex: 1 }} />
        <Button title="Open" compact variant="ghost" onPress={() => onOpen(item.id)} />
      </View>
    </View>
  );
}

export default function ForwardedScreen() {
  const { c } = useTheme();
  const nav = useNavigation<Nav>();
  const { shareId } = useRoute<Route>().params;
  const takeShare = useVault(s => s.takeShare);
  const processShare = useVault(s => s.processShare);
  const updateItem = useVault(s => s.updateItem);
  const refileItem = useVault(s => s.refileItem);
  const setItemFolders = useVault(s => s.setItemFolders);
  const createFolder = useVault(s => s.createFolder);
  const items = useVault(s => s.items);
  const tree = useFolderTree();
  // Read without side effects here; the share is removed from the queue once processing starts.
  const [share] = useState(() => useVault.getState().pendingShares.find(s => s.id === shareId));
  const [outcomes, setOutcomes] = useState<IngestOutcome[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [pickFor, setPickFor] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const started = useRef(false);

  useEffect(() => {
    if (!share || started.current) return;
    started.current = true;
    takeShare(share.id);
    processShare(share)
      .then(o => {
        setOutcomes(o);
        if (o.some(x => x.status === 'saved')) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
        }
      })
      .catch(e => setFailed(e instanceof Error ? e.message : String(e)));
  }, [share, processShare, takeShare]);

  const saved = (outcomes ?? []).filter((o): o is Extract<IngestOutcome, { status: 'saved' }> => o.status === 'saved');
  const single = saved.length === 1 ? saved[0] : null;
  const allDuplicates = !!outcomes?.length && outcomes.every(o => o.status === 'duplicate');
  const pickItem = pickFor ? items.find(i => i.id === pickFor) : undefined;

  const finish = async () => {
    if (single && note.trim()) {
      const current = items.find(i => i.id === single.itemId);
      if (current) {
        await updateItem(current.id, { text: [current.text, note.trim()].filter(Boolean).join('\n\n') });
        // A note like "Bangalore food" helps sort items that weren't recognised.
        if (current.filing === 'auto') await refileItem(current.id);
      }
    }
    if (share?.origin === 'share' && Platform.OS === 'android') {
      // Return to the app the user shared from.
      BackHandler.exitApp();
      return;
    }
    nav.goBack();
  };

  const title = !share
    ? 'Nothing to save'
    : failed
      ? 'Couldn’t forward'
      : !outcomes
        ? 'Forwarding…'
        : allDuplicates
          ? 'Already in Forward'
          : saved.length
            ? 'Forwarded'
            : 'Nothing saved';

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']}>
      <Header right={<IconButton name="close" label="Close" onPress={() => void finish()} />} />
      <Scroll>
        <View style={styles.hero}>
          {!outcomes && share && !failed ? (
            <ActivityIndicator size="large" color={c.accent} />
          ) : (
            <View style={[styles.check, { backgroundColor: failed || !saved.length && !allDuplicates ? c.dangerSoft : c.successSoft }]}>
              <Ionicons
                name={failed || (!saved.length && !allDuplicates) ? 'close' : 'checkmark'}
                size={34}
                color={failed || (!saved.length && !allDuplicates) ? c.danger : c.success}
              />
            </View>
          )}
          <Txt variant="title" style={{ marginTop: space.md }}>
            {title}
          </Txt>
          {outcomes && saved.length ? (
            <Txt variant="caption" color={c.textSecondary} style={{ marginTop: 4, textAlign: 'center' }}>
              Encrypted and sorted on this phone.
            </Txt>
          ) : null}
          {failed ? (
            <Txt variant="caption" color={c.danger} style={{ marginTop: 4, textAlign: 'center' }}>
              {failed}
            </Txt>
          ) : null}
        </View>

        {(outcomes ?? []).map((o, i) => (
          <Result
            key={o.status === 'failed' ? `f${i}` : o.itemId}
            outcome={o}
            onOpen={id => nav.replace('Item', { itemId: id })}
            onPickFolders={id => setPickFor(id)}
          />
        ))}

        {single ? (
          <TextField
            label="Add a note (optional)"
            value={note}
            onChangeText={setNote}
            placeholder="e.g. “try this Sunday” or “Bangalore food”"
            multiline
            style={{ marginTop: space.md }}
          />
        ) : null}

        <Button title="Done" onPress={() => void finish()} disabled={!!share && !outcomes && !failed} style={{ marginTop: space.md }} />
      </Scroll>

      {pickItem ? (
        <FolderPickerSheet
          visible={!!pickFor}
          tree={tree}
          title="Choose folders"
          subtitle={pickItem.title}
          initialSelected={pickItem.folderIds}
          onCreateFolder={(parentId, name) => createFolder({ parentId, name })}
          onConfirm={async ids => {
            setPickFor(null);
            await setItemFolders(pickItem.id, ids);
          }}
          onClose={() => setPickFor(null)}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingVertical: space.xl },
  check: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: space.md,
  },
  filed: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: space.md, paddingTop: space.md, gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  reading: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});

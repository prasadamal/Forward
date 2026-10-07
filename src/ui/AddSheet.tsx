import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { ItemType } from '../types';
import { localShare, pickDocuments, pickMedia } from '../actions/files';
import { useVault } from '../store/vault';
import { radius, space, useTheme } from '../theme';
import { IconName, Txt } from './primitives';
import { Sheet } from './Sheet';
import { toast } from './Toast';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface Option {
  key: string;
  label: string;
  icon: IconName;
  color: string;
  run: () => void | Promise<void>;
}

/** "Add to Forward": everything that can be added by hand, in one place. */
export function AddSheet({ visible, onClose, folderId }: { visible: boolean; onClose: () => void; folderId?: string }) {
  const { c } = useTheme();
  const nav = useNavigation<Nav>();
  const enqueueShare = useVault(s => s.enqueueShare);

  const edit = (type: ItemType) => {
    onClose();
    nav.navigate('EditItem', { type, folderId });
  };

  const importFiles = async (pick: typeof pickMedia) => {
    onClose();
    try {
      const files = await pick();
      if (!files.length) return;
      const share = localShare(files, folderId);
      enqueueShare(share);
      nav.navigate('Forwarded', { shareId: share.id });
    } catch {
      toast('Couldn’t open the picker', 'alert-circle');
    }
  };

  const forwarded: Option[] = [
    { key: 'link', label: 'Link', icon: 'link', color: '#4DA3FF', run: () => edit('link') },
    { key: 'note', label: 'Note', icon: 'document-text', color: '#F5A524', run: () => edit('note') },
    { key: 'media', label: 'Photos & videos', icon: 'images', color: '#E85D9E', run: () => importFiles(pickMedia) },
    { key: 'file', label: 'File', icon: 'document-attach', color: '#22B8CF', run: () => importFiles(pickDocuments) },
  ];
  const wallet: Option[] = [
    { key: 'card', label: 'Card', icon: 'card', color: '#7C6FE0', run: () => edit('card') },
    { key: 'login', label: 'Password', icon: 'key', color: '#2EBD85', run: () => edit('login') },
    { key: 'secret', label: 'Secure note', icon: 'lock-closed', color: '#FF7A45', run: () => edit('secret') },
    {
      key: 'folder',
      label: 'Folder',
      icon: 'folder',
      color: '#8BC34A',
      run: () => {
        onClose();
        nav.navigate('FolderEdit', { parentId: folderId ?? null });
      },
    },
  ];

  const Grid = ({ options }: { options: Option[] }) => (
    <View style={styles.grid}>
      {options.map(o => (
        <Pressable
          key={o.key}
          onPress={() => void o.run()}
          accessibilityRole="button"
          accessibilityLabel={`Add ${o.label}`}
          style={({ pressed }) => [styles.cell, { backgroundColor: c.surface, borderColor: c.border, opacity: pressed ? 0.8 : 1 }]}
        >
          <View style={[styles.icon, { backgroundColor: o.color + '22' }]}>
            <Ionicons name={o.icon} size={22} color={o.color} />
          </View>
          <Txt variant="caption" style={{ textAlign: 'center' }} numberOfLines={2}>
            {o.label}
          </Txt>
        </Pressable>
      ))}
    </View>
  );

  return (
    <Sheet visible={visible} onClose={onClose} title="Add to Forward" subtitle="Tip: the fastest way is Share → Forward from any app.">
      <View style={{ paddingHorizontal: space.lg }}>
        <Txt variant="label" color={c.textMuted} style={styles.label}>
          Save
        </Txt>
        <Grid options={forwarded} />
        <Txt variant="label" color={c.textMuted} style={styles.label}>
          Wallet & folders
        </Txt>
        <Grid options={wallet} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  label: { marginTop: space.sm, marginBottom: space.sm },
  grid: { flexDirection: 'row', gap: space.sm, marginBottom: space.md },
  cell: {
    flex: 1,
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.md,
    paddingHorizontal: 4,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});

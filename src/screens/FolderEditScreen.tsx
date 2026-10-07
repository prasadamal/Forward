import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useVault } from '../store/vault';
import { useFolderTree } from '../store/selectors';
import { pathLabel } from '../folders/tree';
import { FOLDER_EMOJIS } from '../constants/palette';
import { normalizePhrase } from '../organizer/text';
import { radius, space, useTheme } from '../theme';
import { Button, Chip, Header, ListRow, Screen, Scroll, Section, TextField, Txt } from '../ui/primitives';
import { FolderPickerSheet } from '../ui/folders';
import { toast } from '../ui/Toast';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'FolderEdit'>;

export default function FolderEditScreen() {
  const { c } = useTheme();
  const nav = useNavigation<Nav>();
  const { folderId, parentId: initialParent } = useRoute<Route>().params ?? {};
  const tree = useFolderTree();
  const existing = folderId ? tree.byId.get(folderId) : undefined;
  const createFolder = useVault(s => s.createFolder);
  const updateFolder = useVault(s => s.updateFolder);
  const moveFolder = useVault(s => s.moveFolder);
  const deleteFolder = useVault(s => s.deleteFolder);

  const [name, setName] = useState(existing?.name ?? '');
  const [emoji, setEmoji] = useState(existing?.emoji ?? '📁');
  const [parentId, setParentId] = useState<string | null>(existing ? existing.parentId : initialParent ?? null);
  const [keywords, setKeywords] = useState<string[] | null>(existing ? existing.keywords : null);
  const [keywordDraft, setKeywordDraft] = useState('');
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);

  // New top-level folders collect items that mention their name unless the user changes that.
  const effectiveKeywords =
    keywords ?? (parentId === null && normalizePhrase(name).length >= 3 ? [normalizePhrase(name)] : []);

  const addKeyword = () => {
    const k = normalizePhrase(keywordDraft);
    if (!k) return;
    setKeywords([...new Set([...effectiveKeywords, k])]);
    setKeywordDraft('');
  };

  const save = async () => {
    if (!name.trim()) {
      Alert.alert('Name needed', 'Give the folder a name.');
      return;
    }
    setSaving(true);
    try {
      if (existing) {
        await updateFolder(existing.id, { name: name.trim(), emoji, keywords: effectiveKeywords });
        if (parentId !== existing.parentId) await moveFolder(existing.id, parentId);
        toast('Folder saved');
        nav.goBack();
      } else {
        const f = await createFolder({ parentId, name: name.trim(), emoji, keywords: effectiveKeywords });
        toast('Folder created');
        nav.replace('Folder', { folderId: f.id });
      }
    } catch (e) {
      setSaving(false);
      Alert.alert('Couldn’t save folder', e instanceof Error ? e.message : String(e));
    }
  };

  const remove = () => {
    if (!existing) return;
    Alert.alert(`Delete “${existing.name}”?`, 'Subfolders are deleted too. What about the items inside?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Keep items',
        onPress: async () => {
          await deleteFolder(existing.id, 'keep');
          nav.pop(2);
        },
      },
      {
        text: 'Move items to Trash',
        style: 'destructive',
        onPress: async () => {
          await deleteFolder(existing.id, 'trash');
          nav.pop(2);
        },
      },
    ]);
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Header
          onBack={() => nav.goBack()}
          backLabel="Cancel"
          title={existing ? 'Edit folder' : 'New folder'}
          right={<Button title="Save" compact onPress={save} loading={saving} />}
        />
        <Scroll>
          <View style={styles.preview}>
            <View style={[styles.bigEmoji, { backgroundColor: c.surfaceAlt }]}>
              <Text style={{ fontSize: 40 }}>{emoji}</Text>
            </View>
          </View>
          <TextField label="Name" value={name} onChangeText={setName} autoFocus={!existing} placeholder="e.g. Bangalore, Goa trip, Recipes" />

          <Txt variant="label" color={c.textMuted} style={{ marginBottom: space.sm }}>
            Icon
          </Txt>
          <View style={styles.emojiGrid}>
            {FOLDER_EMOJIS.map(e => (
              <Pressable
                key={e}
                onPress={() => setEmoji(e)}
                accessibilityRole="button"
                accessibilityLabel={`Icon ${e}`}
                accessibilityState={{ selected: emoji === e }}
                style={[styles.emojiCell, { backgroundColor: emoji === e ? c.accentSoft : 'transparent', borderColor: emoji === e ? c.accent : 'transparent' }]}
              >
                <Text style={{ fontSize: 22 }}>{e}</Text>
              </Pressable>
            ))}
          </View>

          <Section>
            <ListRow
              title="Location"
              subtitle={parentId ? `Inside ${pathLabel(tree, parentId)}` : 'Top level'}
              icon="git-branch-outline"
              chevron
              last
              onPress={() => setPicking(true)}
            />
          </Section>

          <Txt variant="label" color={c.textMuted} style={{ marginBottom: space.sm }}>
            Auto-collect
          </Txt>
          <View style={[styles.rulesBox, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Txt variant="caption" color={c.textSecondary}>
              Forwarded items that mention any of these words are filed here automatically.
            </Txt>
            <View style={styles.chips}>
              {effectiveKeywords.map(k => (
                <Chip key={k} label={k} icon="✕" onPress={() => setKeywords(effectiveKeywords.filter(x => x !== k))} />
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' }}>
              <TextField
                value={keywordDraft}
                onChangeText={setKeywordDraft}
                placeholder="Add a word, e.g. koramangala"
                autoCapitalize="none"
                onSubmitEditing={addKeyword}
                returnKeyType="done"
                style={{ flex: 1, marginBottom: 0 }}
              />
              <Pressable onPress={addKeyword} style={[styles.addKw, { backgroundColor: c.accent }]} accessibilityLabel="Add word" accessibilityRole="button">
                <Ionicons name="add" size={22} color={c.onAccent} />
              </Pressable>
            </View>
          </View>

          {existing ? (
            <Button title="Delete folder" variant="danger" icon="trash-outline" onPress={remove} style={{ marginTop: space.xl }} />
          ) : null}
        </Scroll>
      </KeyboardAvoidingView>

      <FolderPickerSheet
        visible={picking}
        tree={tree}
        title="Where should it live?"
        initialSelected={[parentId ?? '@root']}
        multiple={false}
        allowRoot
        excludeSubtreeOf={existing?.id}
        confirmLabel="Choose"
        onConfirm={([target]) => {
          setParentId(!target || target === '@root' ? null : target);
          setPicking(false);
        }}
        onClose={() => setPicking(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  preview: { alignItems: 'center', marginBottom: space.lg },
  bigEmoji: { width: 84, height: 84, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center' },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: space.xl },
  emojiCell: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  rulesBox: { padding: space.md, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, gap: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  addKw: { width: 48, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});

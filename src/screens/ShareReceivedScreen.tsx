import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, SafeAreaView, StatusBar,
  TouchableOpacity, ActivityIndicator, Linking, Alert,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNoteStore } from '../store/noteStore';
import { useTheme } from '../hooks/useTheme';
import { RootStackParamList } from '../types';
import { extractUrl, detectPlatform } from '../utils/smartOrganizer';
import { fetchOpenGraph, OGMetadata } from '../utils/openGraph';
import FolderPicker from '../components/FolderPicker';

type RouteType = RouteProp<RootStackParamList, 'ShareReceived'>;
type NavProp = NativeStackNavigationProp<RootStackParamList>;

const PLATFORM_COLORS: Record<string, string> = {
  youtube: '#FF0000',
  instagram: '#C13584',
  twitter: '#1DA1F2',
  reddit: '#FF4500',
  web: '#4CAF50',
  manual: '#7C6FE0',
};

const PLATFORM_LABELS: Record<string, string> = {
  youtube: 'YouTube',
  instagram: 'Instagram',
  twitter: 'Twitter / X',
  reddit: 'Reddit',
  web: 'Web',
  manual: 'Note',
};

export default function ShareReceivedScreen() {
  const route = useRoute<RouteType>();
  const navigation = useNavigation<NavProp>();
  const { addNote, moveNoteToFolder, folders, findNoteByUrl } = useNoteStore();
  const { colors } = useTheme();

  const { sharedText, mode } = route.params;

  // Compute URL first (pure, synchronous) so we can initialise loadingMeta correctly.
  // Initialising to `true` when a URL is present prevents the auto-save effect from
  // firing on the very first render before the OG-fetch effect has had a chance to set
  // loadingMeta = true (race condition with both effects running after initial render).
  const url = extractUrl(sharedText);
  const platform = url ? detectPlatform(url) : 'manual';
  const platformColor = PLATFORM_COLORS[platform];

  const [ogMeta, setOgMeta] = useState<OGMetadata>({});
  const [loadingMeta, setLoadingMeta] = useState(!!url); // true until OG fetch resolves
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedNoteId, setSavedNoteId] = useState<string | undefined>();
  const [showPicker, setShowPicker] = useState(false);
  const [selectedFolderIds, setSelectedFolderIds] = useState<string[]>([]);

  const duplicate = url ? findNoteByUrl(url) : undefined;

  const handleAutoAdd = useCallback(async () => {
    if (duplicate) {
      setSaved(true);
      setSavedNoteId(duplicate.id);
      return;
    }
    setSaving(true);
    const content = ogMeta.title
      ? `${ogMeta.title}\n\n${sharedText}`
      : sharedText;
    const note = await addNote(content);
    setSaving(false);
    setSaved(true);
    setSavedNoteId(note.id);
  }, [duplicate, ogMeta, sharedText, addNote]);

  useEffect(() => {
    if (url) {
      fetchOpenGraph(url)
        .then(meta => {
          setOgMeta(meta);
        })
        .finally(() => {
          setLoadingMeta(false);
        });
    }
  }, [url]);

  // Auto-save when mode is 'auto' and we're done loading metadata
  useEffect(() => {
    if (mode === 'auto' && !loadingMeta && !saving && !saved) {
      handleAutoAdd();
    }
  }, [mode, loadingMeta, saving, saved, handleAutoAdd]);

  const handlePickerConfirm = async () => {
    setShowPicker(false);
    setSaving(true);
    const content = ogMeta.title
      ? `${ogMeta.title}\n\n${sharedText}`
      : sharedText;
    const note = await addNote(content);
    // Move to each selected folder
    for (const folderId of selectedFolderIds) {
      await moveNoteToFolder(note.id, folderId);
    }
    setSaving(false);
    setSaved(true);
    setSavedNoteId(note.id);
  };

  const handleOpenSaved = () => {
    if (savedNoteId) {
      navigation.replace('NoteDetail', { noteId: savedNoteId });
    }
  };

  const handleDone = () => {
    navigation.goBack();
  };

  const toggleFolder = (id: string) => {
    setSelectedFolderIds(prev =>
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={colors.text === '#FFFFFF' ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />

      {/* Toolbar */}
      <View style={[styles.toolbar, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={handleDone}>
          <Text style={[styles.doneBtn, { color: colors.accent }]}>Done</Text>
        </TouchableOpacity>
        <Text style={[styles.toolbarTitle, { color: colors.text }]}>
          {mode === 'auto' ? '⚡ Auto Add' : '📁 Pick Folder'}
        </Text>
        <View style={styles.toolbarRight} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Platform badge */}
        <View style={[styles.platformBadge, { backgroundColor: platformColor + '22' }]}>
          <Text style={[styles.platformText, { color: platformColor }]}>
            {PLATFORM_LABELS[platform].toUpperCase()}
          </Text>
        </View>

        {/* OG Metadata card */}
        {loadingMeta ? (
          <View style={[styles.metaCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <ActivityIndicator color={colors.accent} />
            <Text style={[styles.metaLoadingText, { color: colors.textMuted }]}>
              Fetching page info…
            </Text>
          </View>
        ) : ogMeta.title ? (
          <View style={[styles.metaCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.metaTitle, { color: colors.text }]} numberOfLines={3}>
              {ogMeta.title}
            </Text>
            {ogMeta.description ? (
              <Text style={[styles.metaDesc, { color: colors.textSecondary }]} numberOfLines={3}>
                {ogMeta.description}
              </Text>
            ) : null}
            {ogMeta.siteName ? (
              <Text style={[styles.metaSite, { color: platformColor }]}>{ogMeta.siteName}</Text>
            ) : null}
          </View>
        ) : null}

        {/* Shared content */}
        <View style={[styles.contentCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.contentLabel, { color: colors.textMuted }]}>Shared content</Text>
          <Text style={[styles.contentText, { color: colors.textSecondary }]} numberOfLines={6}>
            {sharedText}
          </Text>
          {url && (
            <TouchableOpacity
              onPress={() =>
                Linking.openURL(url).catch(() =>
                  Alert.alert('Cannot Open Link', 'The link could not be opened on this device.')
                )
              }
            >
              <Text style={[styles.linkText, { color: platformColor }]} numberOfLines={1}>
                🔗 {url}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {duplicate && (
          <View style={[styles.duplicateBox, { backgroundColor: colors.warning + '22', borderColor: colors.warning + '44' }]}>
            <Text style={[styles.duplicateText, { color: colors.warning }]}>
              ⚠️ You already saved this URL. Tap "View Note" to see it.
            </Text>
          </View>
        )}

        {/* Status / Actions */}
        {saving && (
          <View style={styles.statusRow}>
            <ActivityIndicator color={colors.accent} />
            <Text style={[styles.statusText, { color: colors.textSecondary }]}>Saving…</Text>
          </View>
        )}

        {saved && !saving && (
          <View style={[styles.successCard, { backgroundColor: colors.success + '22', borderColor: colors.success + '44' }]}>
            <Text style={[styles.successIcon]}>✅</Text>
            <View>
              <Text style={[styles.successTitle, { color: colors.success }]}>
                {duplicate ? 'Already saved!' : 'Saved to Forward!'}
              </Text>
              <Text style={[styles.successSub, { color: colors.textSecondary }]}>
                Smart folders auto-assigned
              </Text>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        {!saved && !saving && mode === 'picker' && (
          <View style={styles.actionGroup}>
            {/* Auto Add button */}
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.accent }]}
              onPress={handleAutoAdd}
            >
              <Text style={styles.actionBtnIcon}>⚡</Text>
              <View>
                <Text style={styles.actionBtnTitle}>Auto Add</Text>
                <Text style={styles.actionBtnSub}>Smart folders detected automatically</Text>
              </View>
            </TouchableOpacity>

            {/* Pick Folder button */}
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}
              onPress={() => setShowPicker(true)}
            >
              <Text style={styles.actionBtnIcon}>📁</Text>
              <View>
                <Text style={[styles.actionBtnTitle, { color: colors.text }]}>Pick Folder</Text>
                <Text style={[styles.actionBtnSub, { color: colors.textSecondary }]}>
                  Choose one or multiple folders
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Post-save actions */}
        {saved && (
          <View style={styles.postSaveRow}>
            <TouchableOpacity
              style={[styles.viewBtn, { backgroundColor: colors.accent }]}
              onPress={handleOpenSaved}
            >
              <Text style={styles.viewBtnText}>View Note</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.doneOutlineBtn, { borderColor: colors.border }]}
              onPress={handleDone}
            >
              <Text style={[styles.doneOutlineBtnText, { color: colors.textSecondary }]}>Done</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Folder Picker Modal */}
      <FolderPicker
        visible={showPicker}
        folders={folders}
        selectedIds={selectedFolderIds}
        onToggle={toggleFolder}
        onConfirm={handlePickerConfirm}
        onCancel={() => setShowPicker(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  doneBtn: { fontSize: 16, fontWeight: '600' },
  toolbarTitle: { fontSize: 17, fontWeight: '700' },
  toolbarRight: { width: 50 },
  content: { padding: 20, paddingBottom: 60 },
  platformBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 16,
  },
  platformText: { fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  metaCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
    gap: 6,
  },
  metaLoadingText: { fontSize: 14, marginLeft: 12 },
  metaTitle: { fontSize: 17, fontWeight: '700', lineHeight: 24 },
  metaDesc: { fontSize: 14, lineHeight: 20 },
  metaSite: { fontSize: 12, fontWeight: '600', marginTop: 4 },
  contentCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
    gap: 8,
  },
  contentLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  contentText: { fontSize: 14, lineHeight: 22 },
  linkText: { fontSize: 13, fontWeight: '500' },
  duplicateBox: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  duplicateText: { fontSize: 14, lineHeight: 20 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  statusText: { fontSize: 15 },
  successCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  successIcon: { fontSize: 32 },
  successTitle: { fontSize: 17, fontWeight: '700' },
  successSub: { fontSize: 13, marginTop: 2 },
  actionGroup: { gap: 12 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
    borderRadius: 16,
  },
  actionBtnIcon: { fontSize: 28 },
  actionBtnTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  actionBtnSub: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 2 },
  postSaveRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  viewBtn: { flex: 2, padding: 14, borderRadius: 14, alignItems: 'center' },
  viewBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  doneOutlineBtn: { flex: 1, padding: 14, borderRadius: 14, borderWidth: 1, alignItems: 'center' },
  doneOutlineBtnText: { fontSize: 15, fontWeight: '600' },
});

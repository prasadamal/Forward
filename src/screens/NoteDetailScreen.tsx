import React from 'react';
import {
  View, Text, ScrollView, StyleSheet, SafeAreaView, StatusBar,
  TouchableOpacity, Alert, Linking, Share,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import { useNoteStore } from '../store/noteStore';
import { Colors } from '../constants/colors';
import { RootStackParamList } from '../types';
import { formatFullDate } from '../utils/dateUtils';

type RouteType = RouteProp<RootStackParamList, 'NoteDetail'>;
type NavProp = NativeStackNavigationProp<RootStackParamList>;

const PLATFORM_COLORS: Record<string, string> = {
  youtube: '#FF0000',
  instagram: '#C13584',
  twitter: '#1DA1F2',
  reddit: '#FF4500',
  web: '#4CAF50',
  manual: '#7C6FE0',
};

export default function NoteDetailScreen() {
  const route = useRoute<RouteType>();
  const navigation = useNavigation<NavProp>();
  const { getNoteById, deleteNote, archiveNote, restoreNote, togglePin, getFolderById } = useNoteStore();
  const colors = Colors.dark;

  const note = getNoteById(route.params.noteId);

  if (!note) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text, padding: 20 }}>Note not found.</Text>
      </SafeAreaView>
    );
  }

  const platformColor = PLATFORM_COLORS[note.platform || 'manual'];

  const handleArchive = () => {
    Alert.alert('Archive Note', 'This note will be moved to the Archived folder.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive', style: 'destructive',
        onPress: () => { archiveNote(note.id); navigation.goBack(); },
      },
    ]);
  };

  const handlePermanentDelete = () => {
    Alert.alert('Permanently Delete', 'This note will be permanently deleted. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: () => { deleteNote(note.id); navigation.goBack(); },
      },
    ]);
  };

  const handleRestore = () => {
    Alert.alert('Restore Note', 'This note will be restored from the archive.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Restore',
        onPress: () => { restoreNote(note.id); navigation.goBack(); },
      },
    ]);
  };

  const handleOpenLink = () => {
    if (note.url) Linking.openURL(note.url).catch(() => {});
  };

  const handleCopy = async () => {
    const text = note.url ? `${note.content}\n\n${note.url}` : note.content;
    await Clipboard.setStringAsync(text);
    Alert.alert('Copied', 'Note copied to clipboard');
  };

  const handleShare = async () => {
    const text = note.url ? `${note.content}\n\n${note.url}` : note.content;
    try {
      await Share.share({ message: text });
    } catch {
      // user cancelled
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* Top actions */}
      <View style={[styles.toolbar, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={[styles.backBtnText, { color: colors.accent }]}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.toolbarActions}>
          <TouchableOpacity onPress={() => togglePin(note.id)} style={styles.toolBtn}>
            <Text style={styles.toolBtnText}>{note.pinned ? '📌' : '📍'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleCopy} style={styles.toolBtn}>
            <Text style={[styles.toolBtnLabel, { color: colors.accent }]}>Copy</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleShare} style={styles.toolBtn}>
            <Text style={[styles.toolBtnLabel, { color: colors.accent }]}>Share</Text>
          </TouchableOpacity>
          {note.archived ? (
            <>
              <TouchableOpacity onPress={handleRestore} style={styles.toolBtn}>
                <Text style={[styles.toolBtnLabel, { color: colors.accent }]}>Restore</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handlePermanentDelete} style={styles.toolBtn}>
                <Text style={[styles.toolBtnLabel, { color: colors.error }]}>Delete</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                onPress={() => navigation.navigate('EditNote', { noteId: note.id })}
                style={styles.toolBtn}
              >
                <Text style={[styles.toolBtnLabel, { color: colors.accent }]}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleArchive} style={styles.toolBtn}>
                <Text style={[styles.toolBtnLabel, { color: colors.error }]}>Archive</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Platform badge */}
        <View style={[styles.platformBadge, { backgroundColor: platformColor + '22' }]}>
          <Text style={[styles.platformText, { color: platformColor }]}>
            {note.platform?.toUpperCase() || 'NOTE'}
          </Text>
        </View>

        {/* Title */}
        <Text style={[styles.title, { color: colors.text }]}>{note.title}</Text>

        {/* Date */}
        <Text style={[styles.date, { color: colors.textMuted }]}>
          {formatFullDate(note.createdAt)}
        </Text>

        {/* Content */}
        <View style={[styles.contentBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.contentText, { color: colors.textSecondary }]}>
            {note.content}
          </Text>
        </View>

        {/* URL */}
        {note.url && (
          <TouchableOpacity
            style={[styles.urlBox, { backgroundColor: colors.surface, borderColor: platformColor + '44' }]}
            onPress={handleOpenLink}
          >
            <Text style={[styles.urlLabel, { color: colors.textMuted }]}>🔗 Link</Text>
            <Text style={[styles.urlText, { color: platformColor }]} numberOfLines={2}>
              {note.url}
            </Text>
            <Text style={[styles.urlOpen, { color: colors.textMuted }]}>Tap to open ↗</Text>
          </TouchableOpacity>
        )}

        {/* Tags */}
        {note.tags.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Tags</Text>
            <View style={styles.tagsRow}>
              {note.tags.map(tag => (
                <View key={tag} style={[styles.tag, { backgroundColor: colors.accent + '22' }]}>
                  <Text style={[styles.tagText, { color: colors.accent }]}>#{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Folders */}
        {note.folderIds.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>In Folders</Text>
            <View style={styles.tagsRow}>
              {note.folderIds.map(fid => {
                const folder = getFolderById(fid);
                if (!folder) return null;
                return (
                  <TouchableOpacity
                    key={fid}
                    style={[styles.folderChip, { backgroundColor: folder.color + '33', borderColor: folder.color + '66' }]}
                    onPress={() => navigation.navigate('FolderDetail', { folderId: fid })}
                  >
                    <Text style={styles.folderChipText}>
                      {folder.emoji} {folder.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 4 },
  backBtnText: { fontSize: 16, fontWeight: '600' },
  toolbarActions: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  toolBtn: { padding: 4 },
  toolBtnText: { fontSize: 20 },
  toolBtnLabel: { fontSize: 15, fontWeight: '600' },
  content: { padding: 20, paddingBottom: 60 },
  platformBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 12,
  },
  platformText: { fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  title: { fontSize: 24, fontWeight: '800', lineHeight: 32, marginBottom: 8 },
  date: { fontSize: 13, marginBottom: 20 },
  contentBox: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  contentText: { fontSize: 15, lineHeight: 24 },
  urlBox: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  urlLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  urlText: { fontSize: 14, fontWeight: '500', marginBottom: 8, lineHeight: 20 },
  urlOpen: { fontSize: 12 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '600', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  tagText: { fontSize: 13, fontWeight: '500' },
  folderChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  folderChipText: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
});

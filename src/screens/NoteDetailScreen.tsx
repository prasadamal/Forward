import React from 'react';
import {
  View, Text, ScrollView, StyleSheet, SafeAreaView, StatusBar,
  TouchableOpacity, Alert, Linking, Share,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import { useNoteStore } from '../store/noteStore';
import { useTheme } from '../hooks/useTheme';
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
  const { colors } = useTheme();

  const note = getNoteById(route.params.noteId);

  if (!note) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.missingState}>
          <Text style={[styles.missingTitle, { color: colors.text }]}>Note not found</Text>
          <Text style={[styles.missingText, { color: colors.textSecondary }]}>
            This note may have been deleted or moved.
          </Text>
          <TouchableOpacity
            style={[styles.missingButton, { backgroundColor: colors.accent }]}
            onPress={() => navigation.navigate('MainTabs')}
            accessibilityRole="button"
            accessibilityLabel="Go back to home"
          >
            <Text style={styles.missingButtonText}>Go Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const platformColor = note.color || PLATFORM_COLORS[note.platform || 'manual'];

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

  const handleOpenLink = async () => {
    if (!note.url) return;
    try {
      await Linking.openURL(note.url);
    } catch (error) {
      console.error('[NoteDetailScreen] Failed to open link', note.url, error);
      Alert.alert(
        'Cannot Open Link',
        'The link could not be opened on this device. You can copy it and open it manually.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Copy Link',
            onPress: async () => {
              await Clipboard.setStringAsync(note.url!);
              Alert.alert('Copied', 'Link copied to clipboard');
            },
          },
        ]
      );
    }
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
      <StatusBar
        barStyle={colors.text === '#FFFFFF' ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />

      {/* Top actions */}
      <View style={[styles.toolbar, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={[styles.backBtnText, { color: colors.accent }]}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.toolbarActions}>
          <TouchableOpacity
            onPress={() => togglePin(note.id)}
            style={styles.toolBtn}
            accessibilityRole="button"
            accessibilityLabel={note.pinned ? 'Unpin note' : 'Pin note'}
          >
            <Text style={styles.toolBtnText}>{note.pinned ? '📌' : '📍'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleCopy} style={styles.toolBtn} accessibilityRole="button" accessibilityLabel="Copy note">
            <Text style={[styles.toolBtnLabel, { color: colors.accent }]}>Copy</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleShare} style={styles.toolBtn} accessibilityRole="button" accessibilityLabel="Share note">
            <Text style={[styles.toolBtnLabel, { color: colors.accent }]}>Share</Text>
          </TouchableOpacity>
          {note.archived ? (
            <>
              <TouchableOpacity onPress={handleRestore} style={styles.toolBtn} accessibilityRole="button" accessibilityLabel="Restore note">
                <Text style={[styles.toolBtnLabel, { color: colors.accent }]}>Restore</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handlePermanentDelete} style={styles.toolBtn} accessibilityRole="button" accessibilityLabel="Delete note permanently">
                <Text style={[styles.toolBtnLabel, { color: colors.error }]}>Delete</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                onPress={() => navigation.navigate('EditNote', { noteId: note.id })}
                style={styles.toolBtn}
                accessibilityRole="button"
                accessibilityLabel="Edit note"
              >
                <Text style={[styles.toolBtnLabel, { color: colors.accent }]}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleArchive} style={styles.toolBtn} accessibilityRole="button" accessibilityLabel="Archive note">
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
            accessibilityRole="link"
            accessibilityLabel={`Open saved link ${note.url}`}
            accessibilityHint="Opens the original URL in another app or browser"
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
  missingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 10,
  },
  missingTitle: { fontSize: 22, fontWeight: '800' },
  missingText: { fontSize: 14, textAlign: 'center', lineHeight: 21 },
  missingButton: { marginTop: 8, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20 },
  missingButtonText: { color: '#FFFFFF', fontWeight: '700' },
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

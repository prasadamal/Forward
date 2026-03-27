import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, ScrollView, StyleSheet, SafeAreaView,
  StatusBar, TouchableOpacity, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNoteStore } from '../store/noteStore';
import { Colors } from '../constants/colors';
import { RootStackParamList } from '../types';
import { extractTags, extractUrl, detectPlatform } from '../utils/smartOrganizer';

type RouteType = RouteProp<RootStackParamList, 'AddNote'>;
type NavProp = NativeStackNavigationProp<RootStackParamList>;

const PLATFORM_LABELS: Record<string, string> = {
  youtube: '▶ YouTube',
  instagram: '◆ Instagram',
  twitter: '✦ Twitter/X',
  reddit: '● Reddit',
  web: '⊕ Web Link',
  manual: '✎ Manual Note',
};

export default function AddNoteScreen() {
  const route = useRoute<RouteType>();
  const navigation = useNavigation<NavProp>();
  const { addNote, findNoteByUrl } = useNoteStore();
  const colors = Colors.dark;

  const [content, setContent] = useState(route.params?.initialContent || route.params?.initialUrl || '');
  const [saving, setSaving] = useState(false);

  const url = extractUrl(content);
  const platform = url ? detectPlatform(url) : 'manual';
  const { tags, folders } = extractTags(content);
  const duplicateNote = url ? findNoteByUrl(url) : undefined;

  const trimmedContent = content.trim();
  const wordCount = trimmedContent ? trimmedContent.split(/\s+/).length : 0;
  const charCount = content.length;

  const handleSave = async () => {
    if (!content.trim()) {
      Alert.alert('Empty Note', 'Please enter some content before saving.');
      return;
    }
    setSaving(true);
    const note = await addNote(content.trim());
    setSaving(false);
    navigation.replace('NoteDetail', { noteId: note.id });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={[styles.cancel, { color: colors.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>New Note</Text>
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: saving ? colors.textMuted : colors.accent }]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.saveBtnText}>{saving ? '...' : 'Save'}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Input */}
          <TextInput
            style={[styles.input, { color: colors.text }]}
            value={content}
            onChangeText={setContent}
            placeholder="Paste a link, share text, or type a note..."
            placeholderTextColor={colors.textMuted}
            multiline
            autoFocus
            scrollEnabled={false}
          />

          {/* Smart Preview */}
          {content.trim().length > 2 && (
            <View style={[styles.preview, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.previewTitle, { color: colors.textSecondary }]}>
                ✨ Smart Preview
              </Text>

              {url && (
                <View style={styles.previewRow}>
                  <Text style={[styles.previewLabel, { color: colors.textMuted }]}>Platform</Text>
                  <Text style={[styles.previewValue, { color: colors.accent }]}>
                    {PLATFORM_LABELS[platform]}
                  </Text>
                </View>
              )}

              {folders.length > 0 && (
                <View style={styles.previewRow}>
                  <Text style={[styles.previewLabel, { color: colors.textMuted }]}>Folders</Text>
                  <Text style={[styles.previewValue, { color: colors.text }]}>
                    {folders.join(', ')}
                  </Text>
                </View>
              )}

              {tags.length > 0 && (
                <View style={styles.previewRow}>
                  <Text style={[styles.previewLabel, { color: colors.textMuted }]}>Tags</Text>
                  <View style={styles.tagsRow}>
                    {tags.slice(0, 6).map(t => (
                      <View key={t} style={[styles.tag, { backgroundColor: colors.accent + '22' }]}>
                        <Text style={[styles.tagText, { color: colors.accent }]}>#{t}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {folders.length === 0 && tags.length === 0 && (
                <Text style={[styles.noTags, { color: colors.textMuted }]}>
                  No smart tags detected yet. Keep typing...
                </Text>
              )}
            </View>
          )}

          {duplicateNote && (
            <Text style={[styles.duplicateWarning, { color: colors.warning }]}>
              ⚠️ A note with this URL already exists
            </Text>
          )}

          <Text style={[styles.wordCount, { color: colors.textMuted }]}>
            {wordCount} {wordCount === 1 ? 'word' : 'words'} · {charCount} {charCount === 1 ? 'char' : 'chars'}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  cancel: { fontSize: 16 },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  saveBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
  },
  saveBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  content: { padding: 20, paddingBottom: 40 },
  input: {
    fontSize: 17,
    lineHeight: 26,
    minHeight: 140,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  preview: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    gap: 12,
  },
  previewTitle: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  previewRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  previewLabel: { fontSize: 13, width: 70, paddingTop: 2 },
  previewValue: { flex: 1, fontSize: 14, fontWeight: '500' },
  tagsRow: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  tagText: { fontSize: 12, fontWeight: '500' },
  noTags: { fontSize: 13 },
  duplicateWarning: { fontSize: 13, fontWeight: '600', marginTop: 12 },
  wordCount: { fontSize: 12, textAlign: 'right', marginTop: 8 },
});

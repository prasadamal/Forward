import React, { useState } from 'react';
import {
  View, Text, TextInput, ScrollView, StyleSheet, SafeAreaView,
  StatusBar, TouchableOpacity, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNoteStore } from '../store/noteStore';
import { useTheme } from '../hooks/useTheme';
import { NOTE_ACCENT_COLORS } from '../constants/colors';
import { RootStackParamList } from '../types';
import { extractTitle, extractUrl, detectPlatform } from '../utils/smartOrganizer';

type RouteType = RouteProp<RootStackParamList, 'EditNote'>;
type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function EditNoteScreen() {
  const route = useRoute<RouteType>();
  const navigation = useNavigation<NavProp>();
  const { getNoteById, editNote } = useNoteStore();
  const { colors } = useTheme();

  const note = getNoteById(route.params.noteId);
  const [title, setTitle] = useState(note?.title || '');
  const [content, setContent] = useState(note?.content || '');
  const [selectedColor, setSelectedColor] = useState<string | undefined>(note?.color);
  const [saving, setSaving] = useState(false);

  if (!note) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.missingState}>
          <Text style={[styles.missingTitle, { color: colors.text }]}>Note not found</Text>
          <Text style={[styles.missingText, { color: colors.textSecondary }]}>
            This note is no longer available to edit.
          </Text>
          <TouchableOpacity
            style={[styles.returnBtn, { backgroundColor: colors.accent }]}
            onPress={() => navigation.navigate('MainTabs')}
            accessibilityRole="button"
            accessibilityLabel="Go back to home"
          >
            <Text style={styles.returnBtnText}>Go Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const handleSave = async () => {
    if (!content.trim()) {
      Alert.alert('Empty Note', 'Content cannot be empty.');
      return;
    }
    setSaving(true);
    const trimmedContent = content.trim();
    const url = extractUrl(trimmedContent);
    const fallbackTitle = extractTitle(trimmedContent, url ? detectPlatform(url) : note.platform);
    await editNote(note.id, {
      title: title.trim() || fallbackTitle,
      content: trimmedContent,
      color: selectedColor,
    });
    setSaving(false);
    navigation.goBack();
  };

  const hasChanges = title !== (note?.title || '') || content !== (note?.content || '') || selectedColor !== note?.color;

  const handleCancel = () => {
    if (hasChanges) {
      Alert.alert('Discard Changes?', 'You have unsaved changes that will be lost.', [
        { text: 'Keep Editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
      ]);
    } else {
      navigation.goBack();
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={colors.text === '#FFFFFF' ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={handleCancel} accessibilityRole="button" accessibilityLabel="Cancel editing">
            <Text style={[styles.cancel, { color: colors.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Edit Note</Text>
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: saving ? colors.textMuted : colors.accent }]}
            onPress={handleSave}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel="Save note changes"
          >
            <Text style={styles.saveBtnText}>{saving ? '...' : 'Save'}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Title field */}
          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Title</Text>
          <TextInput
            style={[styles.titleInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
            value={title}
            onChangeText={setTitle}
            placeholder="Note title..."
            placeholderTextColor={colors.textMuted}
            returnKeyType="next"
            accessibilityLabel="Edit note title"
          />
          <Text style={[styles.helperText, { color: colors.textMuted }]}>
            Optional. Forward will create a title from the content if you leave this blank.
          </Text>

          {/* Content field */}
          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Content</Text>
          <TextInput
            style={[styles.input, { color: colors.text }]}
            value={content}
            onChangeText={setContent}
            multiline
            scrollEnabled={false}
            textAlignVertical="top"
            placeholder="Note content..."
            placeholderTextColor={colors.textMuted}
            accessibilityLabel="Edit note content"
          />

          {/* Color Picker */}
          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Accent color</Text>
          <View style={styles.colorRow}>
            <TouchableOpacity
              style={[
                styles.colorSwatch,
                styles.colorSwatchNone,
                { borderColor: !selectedColor ? colors.accent : colors.border },
                !selectedColor && styles.colorSwatchSelected,
              ]}
              onPress={() => setSelectedColor(undefined)}
              accessibilityRole="button"
              accessibilityLabel="Use automatic accent color"
            >
              <Text style={{ color: colors.textMuted, fontSize: 10 }}>Auto</Text>
            </TouchableOpacity>
            {NOTE_ACCENT_COLORS.map(c => (
              <TouchableOpacity
                key={c}
                style={[
                  styles.colorSwatch,
                  { backgroundColor: c, borderColor: selectedColor === c ? '#FFFFFF' : 'transparent' },
                  selectedColor === c && styles.colorSwatchSelected,
                ]}
                onPress={() => setSelectedColor(c)}
                accessibilityRole="button"
                accessibilityLabel={`Use ${c} accent color`}
              />
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  missingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  missingTitle: { fontSize: 22, fontWeight: '800', marginBottom: 8 },
  missingText: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  returnBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20 },
  returnBtnText: { color: '#FFFFFF', fontWeight: '700' },
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
  saveBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20 },
  saveBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  content: { padding: 20, paddingBottom: 60 },
  fieldLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginBottom: 8, marginTop: 4 },
  titleInput: {
    fontSize: 16,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  helperText: { fontSize: 12, lineHeight: 18, marginBottom: 20 },
  input: { fontSize: 17, lineHeight: 26, minHeight: 160, textAlignVertical: 'top', marginBottom: 20 },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  colorSwatch: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSwatchNone: { backgroundColor: 'transparent' },
  colorSwatchSelected: { transform: [{ scale: 1.15 }] },
});

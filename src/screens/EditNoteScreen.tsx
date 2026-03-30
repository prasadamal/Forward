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

type RouteType = RouteProp<RootStackParamList, 'EditNote'>;
type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function EditNoteScreen() {
  const route = useRoute<RouteType>();
  const navigation = useNavigation<NavProp>();
  const { getNoteById, editNote, settings } = useNoteStore();
  const colors = Colors[settings.theme === 'light' ? 'light' : 'dark'];
  const theme = settings.theme === 'light' ? 'light' : 'dark' as const;

  const note = getNoteById(route.params.noteId);
  const [content, setContent] = useState(note?.content || '');
  const [saving, setSaving] = useState(false);

  if (!note) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text, padding: 20 }}>Note not found.</Text>
      </SafeAreaView>
    );
  }

  const handleSave = async () => {
    if (!content.trim()) {
      Alert.alert('Empty Note', 'Content cannot be empty.');
      return;
    }
    setSaving(true);
    await editNote(note.id, { content: content.trim() });
    setSaving(false);
    navigation.goBack();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={[styles.cancel, { color: colors.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Edit Note</Text>
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: saving ? colors.textMuted : colors.accent }]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.saveBtnText}>{saving ? '...' : 'Save'}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <TextInput
            style={[styles.input, { color: colors.text }]}
            value={content}
            onChangeText={setContent}
            multiline
            autoFocus
            scrollEnabled={false}
            textAlignVertical="top"
          />
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
  saveBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20 },
  saveBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  content: { padding: 20, paddingBottom: 40 },
  input: { fontSize: 17, lineHeight: 26, minHeight: 200, textAlignVertical: 'top' },
});

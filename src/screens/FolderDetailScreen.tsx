import React from 'react';
import {
  View, Text, FlatList, StyleSheet, SafeAreaView, StatusBar,
  TouchableOpacity,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNoteStore } from '../store/noteStore';
import { useTheme } from '../hooks/useTheme';
import { RootStackParamList } from '../types';
import NoteCard from '../components/NoteCard';
import EmptyState from '../components/EmptyState';

type RouteType = RouteProp<RootStackParamList, 'FolderDetail'>;
type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function FolderDetailScreen() {
  const route = useRoute<RouteType>();
  const navigation = useNavigation<NavProp>();
  const { getFolderById, getNotesForFolder } = useNoteStore();
  const { colors } = useTheme();

  const folder = getFolderById(route.params.folderId);
  const notes = getNotesForFolder(route.params.folderId);
  const sorted = [...notes].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  if (!folder) return null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={colors.text === '#FFFFFF' ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />

      <View style={[styles.toolbar, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={[styles.backBtnText, { color: colors.accent }]}>← Back</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={styles.emoji}>{folder.emoji}</Text>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.text }]}>{folder.name}</Text>
          <Text style={[styles.count, { color: colors.textSecondary }]}>
            {notes.length} {notes.length === 1 ? 'note' : 'notes'}
          </Text>
        </View>
      </View>

      {sorted.length === 0 ? (
        <EmptyState
          icon="📭"
          title="No notes here"
          description="Notes matching this folder's topic will appear here automatically."
        />
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <NoteCard
              note={item}
              onPress={() => navigation.navigate('NoteDetail', { noteId: item.id })}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 4 },
  backBtnText: { fontSize: 16, fontWeight: '600' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    gap: 14,
  },
  emoji: { fontSize: 40 },
  headerText: {},
  title: { fontSize: 26, fontWeight: '800' },
  count: { fontSize: 13, marginTop: 2 },
  list: { paddingTop: 12, paddingBottom: 100 },
});

import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNoteStore } from '../store/noteStore';
import { Colors } from '../constants/colors';
import { RootStackParamList } from '../types';
import NoteCard from '../components/NoteCard';
import EmptyState from '../components/EmptyState';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const FILTERS = [
  { label: 'All', value: 'all' },
  { label: '▶ YouTube', value: 'youtube' },
  { label: '◆ Instagram', value: 'instagram' },
  { label: '✦ Twitter', value: 'twitter' },
  { label: '● Reddit', value: 'reddit' },
  { label: '⊕ Web', value: 'web' },
  { label: '✎ Manual', value: 'manual' },
];

export default function HomeScreen() {
  const navigation = useNavigation<NavProp>();
  const { notes } = useNoteStore();
  const [filter, setFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const colors = Colors.dark;

  const activeNotes = notes.filter(n => !n.archived);
  const filtered = filter === 'all' ? activeNotes : activeNotes.filter(n => n.platform === filter);
  const sorted = [...filtered].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.appName, { color: colors.text }]}>Forward</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {activeNotes.length} {activeNotes.length === 1 ? 'note' : 'notes'} saved
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: colors.surface }]}
            onPress={() => navigation.navigate('AddNote', {})}
          >
            <Text style={[styles.iconBtnText, { color: colors.text }]}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter Chips */}
      <FlatList
        horizontal
        data={FILTERS}
        keyExtractor={item => item.value}
        contentContainerStyle={styles.filtersContainer}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.chip,
              {
                backgroundColor: filter === item.value ? colors.accent : colors.surface,
                borderColor: filter === item.value ? colors.accent : colors.border,
              },
            ]}
            onPress={() => setFilter(item.value)}
          >
            <Text
              style={[
                styles.chipText,
                { color: filter === item.value ? '#FFFFFF' : colors.textSecondary },
              ]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Notes List */}
      {sorted.length === 0 ? (
        <EmptyState
          icon="✉️"
          title="Nothing forwarded yet"
          description="Share any link, text, or thought from any app — Forward will smart-organize it for you."
          actionLabel="Add Your First Note"
          onAction={() => navigation.navigate('AddNote', {})}
          theme="dark"
        />
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent}
            />
          }
          renderItem={({ item }) => (
            <NoteCard
              note={item}
              onPress={() => navigation.navigate('NoteDetail', { noteId: item.id })}
              theme="dark"
            />
          )}
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.accent }]}
        onPress={() => navigation.navigate('AddNote', {})}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  appName: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: { fontSize: 13, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 10 },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnText: { fontSize: 24, fontWeight: '300' },
  filtersContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  chipText: { fontSize: 13, fontWeight: '500' },
  list: { paddingTop: 8, paddingBottom: 100 },
  fab: {
    position: 'absolute',
    bottom: 90,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#7C6FE0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  fabIcon: { color: '#FFFFFF', fontSize: 28, fontWeight: '300', marginTop: -2 },
});

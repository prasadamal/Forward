import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNoteStore } from '../store/noteStore';
import { useTheme } from '../hooks/useTheme';
import { PLATFORM_COLORS } from '../constants/colors';
import { RootStackParamList } from '../types';
import NoteCard from '../components/NoteCard';
import EmptyState from '../components/EmptyState';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'YouTube', value: 'youtube' },
  { label: 'Instagram', value: 'instagram' },
  { label: 'Twitter', value: 'twitter' },
  { label: 'Reddit', value: 'reddit' },
  { label: 'Web', value: 'web' },
  { label: 'Notes', value: 'manual' },
];

type SortOption = 'newest' | 'oldest' | 'az';

const SORT_OPTIONS: { label: string; value: SortOption }[] = [
  { label: 'Newest', value: 'newest' },
  { label: 'Oldest', value: 'oldest' },
  { label: 'A–Z', value: 'az' },
];

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning ☀️';
  if (hour < 18) return 'Good afternoon 🌤';
  return 'Good evening 🌙';
}

export default function HomeScreen() {
  const navigation = useNavigation<NavProp>();
  const { notes, togglePin, settings, loadData } = useNoteStore();
  const { colors } = useTheme();

  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState<SortOption>(settings.defaultSort);
  const [refreshing, setRefreshing] = useState(false);

  const activeNotes = useMemo(() => notes.filter(n => !n.archived), [notes]);
  const sorted = useMemo(() => {
    const filtered = filter === 'all' ? activeNotes : activeNotes.filter(n => n.platform === filter);
    return [...filtered].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      switch (sortBy) {
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'az':
          return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });
  }, [activeNotes, filter, sortBy]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const filterColor = filter !== 'all' ? PLATFORM_COLORS[filter] : colors.accent;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={colors.text === '#FFFFFF' ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.greeting, { color: colors.textSecondary }]}>{getGreeting()}</Text>
          <Text style={[styles.appName, { color: colors.text }]}>Forward</Text>
        </View>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.accent }]}
          onPress={() => navigation.navigate('AddNote', {})}
        >
          <Text style={styles.addBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {/* Stats bar */}
      <View style={[styles.statsBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.statItem}>
          <Text style={[styles.statNum, { color: colors.accent }]}>{activeNotes.length}</Text>
          <Text style={[styles.statLbl, { color: colors.textMuted }]}>saved</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statNum, { color: colors.secondary }]}>
            {notes.filter(n => n.pinned).length}
          </Text>
          <Text style={[styles.statLbl, { color: colors.textMuted }]}>pinned</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statNum, { color: colors.warning }]}>
            {notes.filter(n => n.archived).length}
          </Text>
          <Text style={[styles.statLbl, { color: colors.textMuted }]}>archived</Text>
        </View>
      </View>

      {/* Filter Chips */}
      <FlatList
        horizontal
        data={FILTERS}
        keyExtractor={item => item.value}
        contentContainerStyle={styles.filtersContainer}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => {
          const isActive = filter === item.value;
          const chipColor = item.value !== 'all' ? PLATFORM_COLORS[item.value] : colors.accent;
          return (
            <TouchableOpacity
              style={[
                styles.chip,
                {
                  backgroundColor: isActive ? chipColor : colors.surface,
                  borderColor: isActive ? chipColor : colors.border,
                },
              ]}
              onPress={() => setFilter(item.value)}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: isActive ? '#FFFFFF' : colors.textSecondary },
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        }}
      />

      {/* Sort Row */}
      <View style={styles.sortRow}>
        {SORT_OPTIONS.map(opt => (
          <TouchableOpacity
            key={opt.value}
            style={[
              styles.sortChip,
              {
                backgroundColor: sortBy === opt.value ? filterColor + '22' : 'transparent',
                borderColor: sortBy === opt.value ? filterColor : colors.border,
              },
            ]}
            onPress={() => setSortBy(opt.value)}
          >
            <Text
              style={[
                styles.sortChipText,
                { color: sortBy === opt.value ? filterColor : colors.textMuted },
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
        <Text style={[styles.resultCount, { color: colors.textMuted }]}>
          {sorted.length} {sorted.length === 1 ? 'result' : 'results'}
        </Text>
      </View>

      {/* Notes List */}
      {sorted.length === 0 ? (
        <EmptyState
          icon="✉️"
          title="Nothing forwarded yet"
          description="Share any link, text, or thought from any app — Forward will smart-organize it for you."
          actionLabel="Add Your First Note"
          onAction={() => navigation.navigate('AddNote', {})}
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
              onLongPress={() => togglePin(item.id)}
            />
          )}
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.accent, shadowColor: colors.accent }]}
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
    paddingBottom: 12,
  },
  greeting: { fontSize: 13, marginBottom: 2 },
  appName: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  addBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 22,
  },
  addBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  statsBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 20, fontWeight: '800' },
  statLbl: { fontSize: 11, marginTop: 2 },
  statDivider: { width: 1, marginHorizontal: 8 },
  filtersContainer: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 8,
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  sortChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  sortChipText: { fontSize: 12, fontWeight: '500' },
  resultCount: { marginLeft: 'auto', fontSize: 12 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 4,
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

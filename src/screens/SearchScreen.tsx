import React, { useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, SafeAreaView, StatusBar,
  TextInput, TouchableOpacity, Keyboard,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNoteStore } from '../store/noteStore';
import { useTheme } from '../hooks/useTheme';
import { RootStackParamList } from '../types';
import NoteCard from '../components/NoteCard';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function SearchScreen() {
  const navigation = useNavigation<NavProp>();
  const { searchNotes, settings, updateSettings } = useNoteStore();
  const { colors } = useTheme();
  const [query, setQuery] = useState('');

  const recentSearches: string[] = settings.recentSearches || [];
  const results = query.trim().length > 1 ? searchNotes(query) : [];

  const handleSearch = (q: string) => {
    setQuery(q);
  };

  const commitSearch = (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length >= 2) {
      const updated = [trimmed, ...recentSearches.filter(s => s !== trimmed)].slice(0, 5);
      updateSettings({ recentSearches: updated });
    }
  };

  const clearRecent = () => {
    updateSettings({ recentSearches: [] });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={colors.text === '#FFFFFF' ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />

      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Search</Text>
      </View>

      <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.searchIcon, { color: colors.textMuted }]}>🔍</Text>
        <TextInput
          style={[styles.input, { color: colors.text }]}
          value={query}
          onChangeText={handleSearch}
          onSubmitEditing={() => commitSearch(query)}
          placeholder="Search notes, tags, links..."
          placeholderTextColor={colors.textMuted}
          autoFocus
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => { setQuery(''); Keyboard.dismiss(); }}>
            <Text style={[styles.clear, { color: colors.textMuted }]}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {query.trim().length < 2 ? (
        recentSearches.length > 0 ? (
          <View style={styles.recentContainer}>
            <View style={styles.recentHeader}>
              <Text style={[styles.recentTitle, { color: colors.textSecondary }]}>Recent</Text>
              <TouchableOpacity onPress={clearRecent}>
                <Text style={[styles.clearAll, { color: colors.accent }]}>Clear</Text>
              </TouchableOpacity>
            </View>
            {recentSearches.map(s => (
              <TouchableOpacity
                key={s}
                style={[styles.recentItem, { borderBottomColor: colors.border }]}
                onPress={() => { setQuery(s); commitSearch(s); }}
              >
                <Text style={[styles.recentIcon, { color: colors.textMuted }]}>🕐</Text>
                <Text style={[styles.recentText, { color: colors.text }]}>{s}</Text>
                <Text style={[styles.recentArrow, { color: colors.textMuted }]}>↗</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.hintContainer}>
            <Text style={styles.hintIcon}>🔎</Text>
            <Text style={[styles.hintText, { color: colors.textSecondary }]}>
              Search by title, content, tag, or location
            </Text>
          </View>
        )
      ) : results.length === 0 ? (
        <View style={styles.hintContainer}>
          <Text style={styles.hintIcon}>🫙</Text>
          <Text style={[styles.hintText, { color: colors.textSecondary }]}>
            No notes found for "{query}"
          </Text>
        </View>
      ) : (
        <>
          <Text style={[styles.resultCount, { color: colors.textMuted }]}>
            {results.length} {results.length === 1 ? 'result' : 'results'}
          </Text>
          <FlatList
            data={results}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <NoteCard
                note={item}
                onPress={() => { commitSearch(query); navigation.navigate('NoteDetail', { noteId: item.id }); }}
              />
            )}
          />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: { fontSize: 28, fontWeight: '800' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    gap: 10,
  },
  searchIcon: { fontSize: 18 },
  input: { flex: 1, fontSize: 16, padding: 0 },
  clear: { fontSize: 16, padding: 4 },
  hintContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 },
  hintIcon: { fontSize: 48, marginBottom: 14 },
  hintText: { fontSize: 15, textAlign: 'center' },
  resultCount: { paddingHorizontal: 20, paddingBottom: 8, fontSize: 13 },
  list: { paddingTop: 4, paddingBottom: 100 },
  recentContainer: { paddingHorizontal: 16, paddingTop: 8 },
  recentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  recentTitle: { fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  clearAll: { fontSize: 13, fontWeight: '600' },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  recentIcon: { fontSize: 16 },
  recentText: { flex: 1, fontSize: 15 },
  recentArrow: { fontSize: 14 },
});


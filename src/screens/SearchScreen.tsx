import React, { useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, SafeAreaView, StatusBar,
  TextInput, TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNoteStore } from '../store/noteStore';
import { Colors } from '../constants/colors';
import { RootStackParamList } from '../types';
import NoteCard from '../components/NoteCard';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function SearchScreen() {
  const navigation = useNavigation<NavProp>();
  const { searchNotes } = useNoteStore();
  const [query, setQuery] = useState('');
  const colors = Colors.dark;

  const results = query.trim().length > 1 ? searchNotes(query) : [];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Search</Text>
      </View>

      <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.searchIcon, { color: colors.textMuted }]}>🔍</Text>
        <TextInput
          style={[styles.input, { color: colors.text }]}
          value={query}
          onChangeText={setQuery}
          placeholder="Search notes, tags, links..."
          placeholderTextColor={colors.textMuted}
          autoFocus
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Text style={[styles.clear, { color: colors.textMuted }]}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {query.trim().length < 2 ? (
        <View style={styles.hintContainer}>
          <Text style={[styles.hintIcon]}>🔎</Text>
          <Text style={[styles.hintText, { color: colors.textSecondary }]}>
            Search by title, content, tag, or location
          </Text>
        </View>
      ) : results.length === 0 ? (
        <View style={styles.hintContainer}>
          <Text style={styles.hintIcon}>🫙</Text>
          <Text style={[styles.hintText, { color: colors.textSecondary }]}>
            No notes found for "{query}"
          </Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <NoteCard
              note={item}
              onPress={() => navigation.navigate('NoteDetail', { noteId: item.id })}
              theme="dark"
            />
          )}
        />
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
  list: { paddingTop: 8, paddingBottom: 100 },
});

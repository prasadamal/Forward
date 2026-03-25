import React from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, StatusBar,
  TouchableOpacity, Alert, ScrollView,
} from 'react-native';
import { useNoteStore } from '../store/noteStore';
import { Colors } from '../constants/colors';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SettingsScreen() {
  const { notes, folders, settings, updateSettings } = useNoteStore();
  const colors = Colors.dark;

  const handleClearAll = () => {
    Alert.alert(
      'Clear All Data',
      'This will permanently delete all notes and folders.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All', style: 'destructive',
          onPress: async () => {
            await AsyncStorage.clear();
            Alert.alert('Done', 'All data cleared. Restart the app.');
          },
        },
      ]
    );
  };

  const userFolders = folders.filter(f => !f.isSystem);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>Settings</Text>

        {/* Stats */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>YOUR DATA</Text>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={[styles.statNumber, { color: colors.accent }]}>{notes.length}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Notes</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.stat}>
              <Text style={[styles.statNumber, { color: colors.secondary }]}>{userFolders.length}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Folders</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.stat}>
              <Text style={[styles.statNumber, { color: colors.success }]}>
                {notes.filter(n => n.pinned).length}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Pinned</Text>
            </View>
          </View>
        </View>

        {/* About */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>ABOUT</Text>
          <View style={styles.aboutRow}>
            <Text style={styles.appEmoji}>✉️</Text>
            <View>
              <Text style={[styles.appName, { color: colors.text }]}>Forward</Text>
              <Text style={[styles.appDesc, { color: colors.textSecondary }]}>
                Smart notes, auto-organized
              </Text>
              <Text style={[styles.version, { color: colors.textMuted }]}>Version 1.0.0</Text>
            </View>
          </View>
          <Text style={[styles.aboutText, { color: colors.textSecondary }]}>
            Forward automatically organizes content shared from YouTube, Instagram, Twitter and anywhere
            else into smart folders based on locations, topics, and themes.
          </Text>
        </View>

        {/* How to use */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>HOW TO USE</Text>
          {[
            { icon: '📤', tip: 'Share any link from any app to Forward' },
            { icon: '✨', tip: 'Smart folders auto-organize by location & topic' },
            { icon: '🔍', tip: 'Search across all your notes instantly' },
            { icon: '📌', tip: 'Long-press or tap pin to pin important notes' },
            { icon: '📁', tip: 'Create custom folders to organize manually' },
          ].map((item, i) => (
            <View key={i} style={styles.tipRow}>
              <Text style={styles.tipIcon}>{item.icon}</Text>
              <Text style={[styles.tipText, { color: colors.textSecondary }]}>{item.tip}</Text>
            </View>
          ))}
        </View>

        {/* Danger zone */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>DANGER ZONE</Text>
          <TouchableOpacity
            style={[styles.dangerBtn, { borderColor: colors.error + '44' }]}
            onPress={handleClearAll}
          >
            <Text style={[styles.dangerBtnText, { color: colors.error }]}>🗑 Clear All Data</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 80 },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 20 },
  section: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 14,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  stat: { alignItems: 'center', flex: 1 },
  statNumber: { fontSize: 28, fontWeight: '800' },
  statLabel: { fontSize: 12, marginTop: 4 },
  statDivider: { width: 1, height: 40 },
  aboutRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
  appEmoji: { fontSize: 44 },
  appName: { fontSize: 20, fontWeight: '800' },
  appDesc: { fontSize: 13, marginTop: 2 },
  version: { fontSize: 12, marginTop: 4 },
  aboutText: { fontSize: 14, lineHeight: 22 },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  tipIcon: { fontSize: 20, width: 28 },
  tipText: { flex: 1, fontSize: 14, lineHeight: 20 },
  dangerBtn: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  dangerBtnText: { fontSize: 15, fontWeight: '600' },
  secondary: { color: '#FF6584' },
  success: { color: '#4CAF50' },
});

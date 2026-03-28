import React from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, StatusBar,
  TouchableOpacity, Alert, ScrollView,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useNoteStore } from '../store/noteStore';
import { Colors } from '../constants/colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform as PlatformType } from '../types';

const PLATFORM_STATS: { key: PlatformType; label: string; color: string }[] = [
  { key: 'youtube', label: 'YouTube', color: '#FF0000' },
  { key: 'instagram', label: 'Instagram', color: '#C13584' },
  { key: 'twitter', label: 'Twitter', color: '#1DA1F2' },
  { key: 'reddit', label: 'Reddit', color: '#FF4500' },
  { key: 'web', label: 'Web', color: '#4CAF50' },
  { key: 'manual', label: 'Manual', color: '#7C6FE0' },
];

export default function SettingsScreen() {
  const { notes, folders, settings, updateSettings } = useNoteStore();
  const colors = Colors[settings.theme === 'light' ? 'light' : 'dark'];
  const theme = settings.theme === 'light' ? 'light' : 'dark' as const;

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

  const platformCounts = notes.filter(n => !n.archived).reduce<Record<string, number>>((acc, n) => {
    const p = n.platform || 'manual';
    acc[p] = (acc[p] || 0) + 1;
    return acc;
  }, {});

  const activeCount = notes.filter(n => !n.archived).length;
  const archivedCount = notes.filter(n => n.archived).length;

  const handleExportNotes = async () => {
    const json = JSON.stringify(notes, null, 2);
    await Clipboard.setStringAsync(json);
    Alert.alert('Exported', 'All notes copied to clipboard as JSON');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

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

        {/* Notes by Platform */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>NOTES BY PLATFORM</Text>
          {PLATFORM_STATS.map(p => (
              <View key={p.key} style={styles.platformRow}>
                <View style={[styles.platformDot, { backgroundColor: p.color }]} />
                <Text style={[styles.platformLabel, { color: colors.textSecondary }]}>{p.label}</Text>
                <Text style={[styles.platformCount, { color: colors.text }]}>{platformCounts[p.key] || 0}</Text>
              </View>
            ))}
        </View>

        {/* Notes by Status */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>NOTES BY STATUS</Text>
          <View style={styles.statusRow}>
            <View style={styles.stat}>
              <Text style={[styles.statNumber, { color: colors.success }]}>{activeCount}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Active</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.stat}>
              <Text style={[styles.statNumber, { color: colors.warning }]}>{archivedCount}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Archived</Text>
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

        {/* Export */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>EXPORT</Text>
          <TouchableOpacity
            style={[styles.exportBtn, { borderColor: colors.accent + '44' }]}
            onPress={handleExportNotes}
          >
            <Text style={[styles.exportBtnText, { color: colors.accent }]}>📋 Export Notes as JSON</Text>
          </TouchableOpacity>
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
  exportBtn: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  exportBtnText: { fontSize: 15, fontWeight: '600' },
  platformRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  platformDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  platformLabel: { flex: 1, fontSize: 14 },
  platformCount: { fontSize: 14, fontWeight: '700' },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
});

import React from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, StatusBar,
  TouchableOpacity, Alert, ScrollView,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useNoteStore } from '../store/noteStore';
import { useTheme } from '../hooks/useTheme';
import { PLATFORM_COLORS } from '../constants/colors';
import { Platform as PlatformType } from '../types';

const PLATFORM_STATS: { key: PlatformType; label: string; color: string }[] = [
  { key: 'youtube', label: 'YouTube', color: PLATFORM_COLORS.youtube },
  { key: 'instagram', label: 'Instagram', color: PLATFORM_COLORS.instagram },
  { key: 'twitter', label: 'Twitter', color: PLATFORM_COLORS.twitter },
  { key: 'reddit', label: 'Reddit', color: PLATFORM_COLORS.reddit },
  { key: 'web', label: 'Web', color: PLATFORM_COLORS.web },
  { key: 'manual', label: 'Manual', color: PLATFORM_COLORS.manual },
];

export default function SettingsScreen() {
  const { notes, folders, settings, updateSettings, clearAllData } = useNoteStore();
  const { colors } = useTheme();

  const handleClearAll = () => {
    Alert.alert(
      'Clear All Data',
      'This will permanently delete all notes and folders, and reset saved settings to their defaults on this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All', style: 'destructive',
          onPress: async () => {
            await clearAllData();
            Alert.alert('Done', 'All Forward data has been cleared from this device.');
          },
        },
      ]
    );
  };

  const userFolders = folders.filter(f => !f.isSystem);
  const activeNotes = notes.filter(n => !n.archived);
  const archivedCount = notes.filter(n => n.archived).length;

  const platformCounts = activeNotes.reduce<Record<string, number>>((acc, n) => {
    const p = n.platform || 'manual';
    acc[p] = (acc[p] || 0) + 1;
    return acc;
  }, {});

  const handleExportNotes = async () => {
    try {
      const json = JSON.stringify(notes, null, 2);
      await Clipboard.setStringAsync(json);
      Alert.alert(
        'Exported',
        `${notes.length} ${notes.length === 1 ? 'note was' : 'notes were'} copied to the clipboard as JSON.`
      );
    } catch {
      Alert.alert('Export Failed', 'Forward could not copy your notes to the clipboard.');
    }
  };

  const ThemeButton = ({ value, label, icon }: { value: string; label: string; icon: string }) => (
    <TouchableOpacity
      style={[
        styles.themeBtn,
        {
          backgroundColor: settings.theme === value ? colors.accent : colors.card,
          borderColor: settings.theme === value ? colors.accent : colors.border,
        },
      ]}
      onPress={() => updateSettings({ theme: value as 'light' | 'dark' | 'system' })}
      accessibilityRole="button"
      accessibilityLabel={`Use ${label} theme`}
    >
      <Text style={styles.themeBtnIcon}>{icon}</Text>
      <Text style={[styles.themeBtnLabel, { color: settings.theme === value ? '#FFFFFF' : colors.textSecondary }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const SortButton = ({ value, label }: { value: string; label: string }) => (
    <TouchableOpacity
      style={[
        styles.sortBtn,
        {
          backgroundColor: settings.defaultSort === value ? colors.accent : colors.card,
          borderColor: settings.defaultSort === value ? colors.accent : colors.border,
        },
      ]}
      onPress={() => updateSettings({ defaultSort: value as 'newest' | 'oldest' | 'az' })}
      accessibilityRole="button"
      accessibilityLabel={`Sort notes by ${label}`}
    >
      <Text style={[styles.sortBtnLabel, { color: settings.defaultSort === value ? '#FFFFFF' : colors.textSecondary }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={colors.text === '#FFFFFF' ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>Settings</Text>

        {/* Theme */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>APPEARANCE</Text>
          <View style={styles.themeRow}>
            <ThemeButton value="light" label="Light" icon="☀️" />
            <ThemeButton value="dark" label="Dark" icon="🌙" />
            <ThemeButton value="system" label="System" icon="📱" />
          </View>
        </View>

        {/* Default Sort */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>DEFAULT SORT</Text>
          <View style={styles.sortRow}>
            <SortButton value="newest" label="Newest" />
            <SortButton value="oldest" label="Oldest" />
            <SortButton value="az" label="A–Z" />
          </View>
        </View>

        {/* Stats */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>YOUR DATA</Text>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={[styles.statNumber, { color: colors.accent }]}>{notes.filter(n => !n.archived).length}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.stat}>
              <Text style={[styles.statNumber, { color: colors.secondary }]}>{userFolders.length}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Folders</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.stat}>
              <Text style={[styles.statNumber, { color: colors.success }]}>
                {notes.filter(n => n.pinned && !n.archived).length}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Pinned</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.stat}>
              <Text style={[styles.statNumber, { color: colors.warning }]}>{archivedCount}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Archived</Text>
            </View>
          </View>
        </View>

        {/* Notes by Platform with progress bars */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>NOTES BY PLATFORM</Text>
          {PLATFORM_STATS.map(p => {
            const count = platformCounts[p.key] || 0;
            const pct = activeNotes.length > 0 ? count / activeNotes.length : 0;
            return (
              <View key={p.key} style={styles.platformRow}>
                <View style={[styles.platformDot, { backgroundColor: p.color }]} />
                <Text style={[styles.platformLabel, { color: colors.textSecondary }]}>{p.label}</Text>
                <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
                  <View
                    style={[
                      styles.progressBar,
                      { backgroundColor: p.color, width: `${Math.round(pct * 100)}%` },
                    ]}
                  />
                </View>
                <Text style={[styles.platformCount, { color: colors.text }]}>{count}</Text>
              </View>
            );
          })}
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
            { icon: '📌', tip: 'Long-press a note to pin/unpin it quickly' },
            { icon: '🎨', tip: 'Pick a color accent when creating a new note' },
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
            accessibilityRole="button"
            accessibilityLabel="Export notes as JSON"
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
            accessibilityRole="button"
            accessibilityLabel="Clear all app data"
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
  themeRow: { flexDirection: 'row', gap: 10 },
  themeBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  themeBtnIcon: { fontSize: 22 },
  themeBtnLabel: { fontSize: 13, fontWeight: '600' },
  sortRow: { flexDirection: 'row', gap: 10 },
  sortBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  sortBtnLabel: { fontSize: 13, fontWeight: '600' },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  stat: { alignItems: 'center', flex: 1 },
  statNumber: { fontSize: 24, fontWeight: '800' },
  statLabel: { fontSize: 11, marginTop: 4 },
  statDivider: { width: 1, height: 36 },
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
    marginBottom: 12,
    gap: 10,
  },
  platformDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  platformLabel: { width: 72, fontSize: 13 },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
  },
  platformCount: { fontSize: 13, fontWeight: '700', width: 24, textAlign: 'right' },
});

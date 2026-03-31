import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Note } from '../types';
import { useTheme } from '../hooks/useTheme';
import { formatRelativeDate } from '../utils/dateUtils';

interface Props {
  note: Note;
  onPress: () => void;
  onLongPress?: () => void;
  theme?: 'dark' | 'light';
}

const PLATFORM_COLORS: Record<string, string> = {
  youtube: '#FF0000',
  instagram: '#C13584',
  twitter: '#1DA1F2',
  reddit: '#FF4500',
  web: '#4CAF50',
  manual: '#7C6FE0',
};

const PLATFORM_LABELS: Record<string, string> = {
  youtube: 'YouTube',
  instagram: 'Instagram',
  twitter: 'Twitter',
  reddit: 'Reddit',
  web: 'Web',
  manual: 'Note',
};

/** Extract the hostname from a URL, stripping leading "www.". Falls back to a shortened URL. */
function getDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, '');
  } catch {
    return `${url.slice(0, 40)}${url.length > 40 ? '…' : ''}`;
  }
}

export default function NoteCard({ note, onPress, onLongPress }: Props) {
  const { colors } = useTheme();
  const platformColor = note.color || PLATFORM_COLORS[note.platform || 'manual'];
  const platformLabel = PLATFORM_LABELS[note.platform || 'manual'];
  const displayTitle = note.title.trim() || note.content.trim().slice(0, 40) || 'Untitled Note';
  const displayContent = note.content.trim() || 'No preview available';

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.75}
    >
      {/* Colored left stripe */}
      <View style={[styles.stripe, { backgroundColor: platformColor }]} />

      <View style={styles.inner}>
        <View style={styles.header}>
          <View style={[styles.platformBadge, { backgroundColor: platformColor + '22' }]}>
            <Text style={[styles.platformText, { color: platformColor }]}>{platformLabel}</Text>
          </View>
          {note.pinned && <Text style={styles.pinIcon}>📌</Text>}
          <Text style={[styles.date, { color: colors.textMuted }]}>
            {formatRelativeDate(note.createdAt)}
          </Text>
        </View>

        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {displayTitle}
        </Text>

        {note.url ? (
          <Text
            style={[styles.url, { color: colors.accent }]}
            numberOfLines={1}
            accessibilityLabel={`Link: ${getDomain(note.url)}`}
            accessibilityRole="link"
          >
            🔗 {getDomain(note.url)}
          </Text>
        ) : (
          <Text style={[styles.content, { color: colors.textSecondary }]} numberOfLines={2}>
            {displayContent}
          </Text>
        )}

        {note.tags.length > 0 && (
          <View style={styles.tagsRow}>
            {note.tags.slice(0, 4).map(tag => (
              <View key={tag} style={[styles.tag, { backgroundColor: colors.accent + '22' }]}>
                <Text style={[styles.tagText, { color: colors.accent }]}>#{tag}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  stripe: {
    width: 4,
  },
  inner: {
    flex: 1,
    padding: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  platformBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  platformText: {
    fontSize: 11,
    fontWeight: '600',
  },
  pinIcon: {
    fontSize: 12,
  },
  date: {
    fontSize: 12,
    marginLeft: 'auto',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
    lineHeight: 22,
  },
  url: {
    fontSize: 13,
    marginBottom: 8,
  },
  content: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '500',
  },
});

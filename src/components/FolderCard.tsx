import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SmartFolder } from '../types';
import { Colors } from '../constants/colors';

interface Props {
  folder: SmartFolder;
  onPress: () => void;
  theme?: 'dark' | 'light';
}

export default function FolderCard({ folder, onPress, theme = 'dark' }: Props) {
  const colors = Colors[theme];

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={[styles.emojiCircle, { backgroundColor: folder.color + '33' }]}>
        <Text style={styles.emoji}>{folder.emoji}</Text>
      </View>
      <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
        {folder.name}
      </Text>
      <Text style={[styles.count, { color: colors.textSecondary }]}>
        {folder.noteIds.length} {folder.noteIds.length === 1 ? 'note' : 'notes'}
      </Text>
      <View style={[styles.colorBar, { backgroundColor: folder.color }]} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    flex: 1,
    margin: 6,
    borderWidth: 1,
    alignItems: 'center',
    minHeight: 130,
    overflow: 'hidden',
    position: 'relative',
  },
  emojiCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emoji: {
    fontSize: 26,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  count: {
    fontSize: 12,
    textAlign: 'center',
  },
  colorBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    borderRadius: 3,
  },
});

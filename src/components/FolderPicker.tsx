import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, FlatList, SafeAreaView,
} from 'react-native';
import { SmartFolder } from '../types';
import { useTheme } from '../hooks/useTheme';

interface Props {
  visible: boolean;
  folders: SmartFolder[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function FolderPicker({ visible, folders, selectedIds, onToggle, onConfirm, onCancel }: Props) {
  const { colors } = useTheme();

  const userFolders = folders.filter(f => !f.isSystem);

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <SafeAreaView style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          <Text style={[styles.title, { color: colors.text }]}>Choose Folders</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Select one or more folders for this note
          </Text>

          {userFolders.length === 0 ? (
            <View style={styles.empty}>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                No custom folders yet. The note will be auto-organized.
              </Text>
            </View>
          ) : (
            <FlatList
              data={userFolders}
              keyExtractor={item => item.id}
              style={styles.list}
              renderItem={({ item }) => {
                const selected = selectedIds.includes(item.id);
                return (
                  <TouchableOpacity
                    style={[
                      styles.folderRow,
                      {
                        borderBottomColor: colors.border,
                        backgroundColor: selected ? colors.accent + '15' : 'transparent',
                      },
                    ]}
                    onPress={() => onToggle(item.id)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.emojiCircle, { backgroundColor: item.color + '33' }]}>
                      <Text style={styles.emoji}>{item.emoji}</Text>
                    </View>
                    <View style={styles.folderInfo}>
                      <Text style={[styles.folderName, { color: colors.text }]}>{item.name}</Text>
                      <Text style={[styles.folderCount, { color: colors.textMuted }]}>
                        {item.noteIds.length} notes
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.checkbox,
                        {
                          backgroundColor: selected ? colors.accent : 'transparent',
                          borderColor: selected ? colors.accent : colors.border,
                        },
                      ]}
                    >
                      {selected && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.cancelBtn, { borderColor: colors.border }]}
              onPress={onCancel}
            >
              <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: colors.accent }]}
              onPress={onConfirm}
            >
              <Text style={styles.confirmBtnText}>
                {selectedIds.length > 0 ? `Save to ${selectedIds.length} folder${selectedIds.length > 1 ? 's' : ''}` : 'Save (auto-organize)'}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    maxHeight: '80%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    paddingHorizontal: 24,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  list: { flexGrow: 0 },
  folderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 14,
  },
  emojiCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 20 },
  folderInfo: { flex: 1 },
  folderName: { fontSize: 16, fontWeight: '600' },
  folderCount: { fontSize: 13, marginTop: 2 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  empty: { padding: 24 },
  emptyText: { fontSize: 14, lineHeight: 22 },
  actions: {
    flexDirection: 'row',
    gap: 12,
    padding: 24,
    paddingBottom: 8,
  },
  cancelBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: 15, fontWeight: '600' },
  confirmBtn: {
    flex: 2,
    padding: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  confirmBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});

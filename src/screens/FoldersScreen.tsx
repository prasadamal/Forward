import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, Alert, TextInput, Modal, Keyboard,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNoteStore } from '../store/noteStore';
import { useTheme } from '../hooks/useTheme';
import { RootStackParamList } from '../types';
import FolderCard from '../components/FolderCard';
import EmptyState from '../components/EmptyState';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function FoldersScreen() {
  const navigation = useNavigation<NavProp>();
  const { folders, createFolder, deleteFolder } = useNoteStore();
  const { colors } = useTheme();
  const [showCreate, setShowCreate] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const userFolders = folders.filter(f => !f.isSystem);
  const systemFolders = folders.filter(f => f.isSystem);

  const MAX_FOLDER_NAME_LENGTH = 50;

  const handleCreate = async () => {
    const trimmed = newFolderName.trim();
    if (!trimmed) {
      Alert.alert('Name Required', 'Please enter a folder name.');
      return;
    }
    if (trimmed.length > MAX_FOLDER_NAME_LENGTH) {
      Alert.alert('Name Too Long', `Folder names must be ${MAX_FOLDER_NAME_LENGTH} characters or fewer.`);
      return;
    }
    const existing = folders.find(f => f.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      Alert.alert('Already Exists', `A folder named "${existing.name}" already exists.`);
      return;
    }
    await createFolder(trimmed);
    Keyboard.dismiss();
    setNewFolderName('');
    setShowCreate(false);
  };

  const closeCreateModal = () => {
    Keyboard.dismiss();
    setShowCreate(false);
    setNewFolderName('');
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert('Delete Folder', `Delete "${name}"? Notes won't be deleted.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteFolder(id) },
    ]);
  };

  const allData = [...systemFolders, ...userFolders];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={colors.text === '#FFFFFF' ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />

      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Smart Folders</Text>
        <TouchableOpacity
          style={[styles.createBtn, { backgroundColor: colors.accent }]}
          onPress={() => setShowCreate(true)}
          accessibilityRole="button"
          accessibilityLabel="Create a new folder"
        >
          <Text style={styles.createBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {allData.length === 0 ? (
        <EmptyState
          icon="📁"
          title="No folders yet"
          description="Add notes and Forward will auto-create smart folders for locations and topics."
        />
      ) : (
        <FlatList
          data={allData}
          keyExtractor={item => item.id}
          numColumns={2}
          contentContainerStyle={styles.grid}
          renderItem={({ item }) => (
            <View style={styles.gridItem}>
              <FolderCard
                folder={item}
                onPress={() => navigation.navigate('FolderDetail', { folderId: item.id })}
              />
              {!item.isSystem && (
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => handleDelete(item.id, item.name)}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${item.name} folder`}
                  hitSlop={8}
                >
                  <Text style={styles.deleteBtnText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        />
      )}

      {/* Create Folder Modal */}
      <Modal visible={showCreate} transparent animationType="slide" onRequestClose={closeCreateModal}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>New Folder</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
              placeholder="Folder name (e.g. Bangalore, Food)"
              placeholderTextColor={colors.textMuted}
              value={newFolderName}
              onChangeText={setNewFolderName}
              autoFocus
              onSubmitEditing={handleCreate}
              returnKeyType="done"
              accessibilityLabel="Folder name input"
              accessibilityHint="Enter a folder name and submit to create it"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.card }]}
                onPress={closeCreateModal}
                accessibilityRole="button"
                accessibilityLabel="Cancel folder creation"
              >
                <Text style={[styles.modalBtnText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.accent }]}
                onPress={handleCreate}
                accessibilityRole="button"
                accessibilityLabel="Create folder"
              >
                <Text style={[styles.modalBtnText, { color: '#FFFFFF' }]}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  title: { fontSize: 28, fontWeight: '800' },
  createBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  createBtnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
  grid: { padding: 10, paddingBottom: 100 },
  gridItem: { flex: 1, position: 'relative' },
  deleteBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,100,100,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  deleteBtnText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modal: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 16 },
  modalInput: {
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalBtnText: { fontWeight: '600', fontSize: 15 },
});

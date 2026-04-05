// Unit tests for noteStore actions.
// AsyncStorage is mocked via the jest-expo/src/setup/async-storage mock.

import { useNoteStore, STORAGE_KEY } from '../store/noteStore';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Reset store before each test
beforeEach(() => {
  useNoteStore.setState({
    notes: [],
    folders: [
      { id: 'all', name: 'All Notes', emoji: '📝', noteIds: [], createdAt: new Date().toISOString(), isSystem: true, color: '#7C6FE0' },
      { id: 'pinned', name: 'Pinned', emoji: '📌', noteIds: [], createdAt: new Date().toISOString(), isSystem: true, color: '#FF6584' },
      { id: 'archived', name: 'Archived', emoji: '🗑️', noteIds: [], createdAt: new Date().toISOString(), isSystem: true, color: '#FF9800' },
    ],
    settings: { theme: 'dark', defaultSort: 'newest', recentSearches: [] },
    isLoading: false,
    storageError: null,
  });
  (AsyncStorage as jest.Mocked<typeof AsyncStorage>).clear();
});

describe('addNote', () => {
  it('adds a note to the notes array', async () => {
    const { addNote } = useNoteStore.getState();
    await addNote('Hello world');
    const { notes } = useNoteStore.getState();
    expect(notes).toHaveLength(1);
    expect(notes[0].content).toBe('Hello world');
  });

  it('adds new note to the "all" folder', async () => {
    const { addNote } = useNoteStore.getState();
    const note = await addNote('Test note');
    const { folders } = useNoteStore.getState();
    const allFolder = folders.find(f => f.id === 'all')!;
    expect(allFolder.noteIds).toContain(note.id);
  });

  it('sets archived to false for new notes', async () => {
    const { addNote } = useNoteStore.getState();
    const note = await addNote('Some content');
    expect(note.archived).toBe(false);
  });

  it('applies a custom color to the note', async () => {
    const { addNote } = useNoteStore.getState();
    const note = await addNote('Colored note', '#FF0000');
    expect(note.color).toBe('#FF0000');
  });

  it('detects platform from URL in content', async () => {
    const { addNote } = useNoteStore.getState();
    const note = await addNote('https://www.youtube.com/watch?v=abc');
    expect(note.platform).toBe('youtube');
  });

  it('persists data to AsyncStorage', async () => {
    const { addNote } = useNoteStore.getState();
    await addNote('Persisted note');
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.notes).toHaveLength(1);
  });
});

describe('editNote', () => {
  it('updates note content', async () => {
    const { addNote, editNote } = useNoteStore.getState();
    const note = await addNote('Original content');
    await editNote(note.id, { content: 'Updated content' });
    const { notes } = useNoteStore.getState();
    expect(notes[0].content).toBe('Updated content');
  });

  it('updates updatedAt timestamp', async () => {
    const { addNote, editNote } = useNoteStore.getState();
    const note = await addNote('Content');
    const originalUpdatedAt = note.updatedAt;
    await new Promise(r => setTimeout(r, 5));
    await editNote(note.id, { title: 'New title' });
    const { notes } = useNoteStore.getState();
    expect(notes[0].updatedAt).not.toBe(originalUpdatedAt);
  });

  it('does nothing when note id does not exist', async () => {
    const { addNote, editNote } = useNoteStore.getState();
    await addNote('Original');
    await editNote('nonexistent-id', { content: 'Should not appear' });
    const { notes } = useNoteStore.getState();
    expect(notes[0].content).toBe('Original');
  });
});

describe('deleteNote', () => {
  it('removes note from notes array', async () => {
    const { addNote, deleteNote } = useNoteStore.getState();
    const note = await addNote('To delete');
    await deleteNote(note.id);
    const { notes } = useNoteStore.getState();
    expect(notes).toHaveLength(0);
  });

  it('removes note from all folders', async () => {
    const { addNote, deleteNote } = useNoteStore.getState();
    const note = await addNote('To delete');
    await deleteNote(note.id);
    const { folders } = useNoteStore.getState();
    folders.forEach(f => {
      expect(f.noteIds).not.toContain(note.id);
    });
  });
});

describe('togglePin', () => {
  it('pins an unpinned note', async () => {
    const { addNote, togglePin } = useNoteStore.getState();
    const note = await addNote('Pinnable note');
    await togglePin(note.id);
    const { notes, folders } = useNoteStore.getState();
    expect(notes[0].pinned).toBe(true);
    const pinnedFolder = folders.find(f => f.id === 'pinned')!;
    expect(pinnedFolder.noteIds).toContain(note.id);
  });

  it('unpins a pinned note', async () => {
    const { addNote, togglePin } = useNoteStore.getState();
    const note = await addNote('Pinnable note');
    await togglePin(note.id); // pin
    await togglePin(note.id); // unpin
    const { notes, folders } = useNoteStore.getState();
    expect(notes[0].pinned).toBe(false);
    const pinnedFolder = folders.find(f => f.id === 'pinned')!;
    expect(pinnedFolder.noteIds).not.toContain(note.id);
  });

  it('does nothing for a nonexistent note id', async () => {
    const { togglePin } = useNoteStore.getState();
    // Should not throw
    await expect(togglePin('fake-id')).resolves.toBeUndefined();
  });
});

describe('archiveNote', () => {
  it('marks note as archived', async () => {
    const { addNote, archiveNote } = useNoteStore.getState();
    const note = await addNote('To archive');
    await archiveNote(note.id);
    const { notes } = useNoteStore.getState();
    expect(notes[0].archived).toBe(true);
  });

  it('adds note to archived folder and removes from "all" folder', async () => {
    const { addNote, archiveNote } = useNoteStore.getState();
    const note = await addNote('Archive me');
    await archiveNote(note.id);
    const { folders } = useNoteStore.getState();
    const archivedFolder = folders.find(f => f.id === 'archived')!;
    const allFolder = folders.find(f => f.id === 'all')!;
    expect(archivedFolder.noteIds).toContain(note.id);
    expect(allFolder.noteIds).not.toContain(note.id);
  });

  it('sets pinned to false when archiving a pinned note', async () => {
    const { addNote, togglePin, archiveNote } = useNoteStore.getState();
    const note = await addNote('Pin then archive');
    await togglePin(note.id);
    await archiveNote(note.id);
    const { notes } = useNoteStore.getState();
    expect(notes[0].pinned).toBe(false);
  });

  it('does nothing for a nonexistent note id', async () => {
    const { archiveNote } = useNoteStore.getState();
    await expect(archiveNote('fake-id')).resolves.toBeUndefined();
  });
});

describe('restoreNote', () => {
  it('marks note as not archived', async () => {
    const { addNote, archiveNote, restoreNote } = useNoteStore.getState();
    const note = await addNote('Restore me');
    await archiveNote(note.id);
    await restoreNote(note.id);
    const { notes } = useNoteStore.getState();
    expect(notes[0].archived).toBe(false);
  });

  it('adds note back to "all" folder after restore', async () => {
    const { addNote, archiveNote, restoreNote } = useNoteStore.getState();
    const note = await addNote('Restore me');
    await archiveNote(note.id);
    await restoreNote(note.id);
    const { folders } = useNoteStore.getState();
    const allFolder = folders.find(f => f.id === 'all')!;
    expect(allFolder.noteIds).toContain(note.id);
  });

  it('does nothing for a nonexistent note id', async () => {
    const { restoreNote } = useNoteStore.getState();
    await expect(restoreNote('fake-id')).resolves.toBeUndefined();
  });
});

describe('createFolder', () => {
  it('creates a new user folder', async () => {
    const { createFolder } = useNoteStore.getState();
    const folder = await createFolder('Travel');
    const { folders } = useNoteStore.getState();
    expect(folders.some(f => f.id === folder.id)).toBe(true);
    expect(folder.name).toBe('Travel');
    expect(folder.isSystem).toBe(false);
  });

  it('returns existing folder on duplicate name (case-insensitive)', async () => {
    const { createFolder } = useNoteStore.getState();
    const first = await createFolder('Food');
    const second = await createFolder('food');
    expect(first.id).toBe(second.id);
  });
});

describe('deleteFolder', () => {
  it('removes user folder from state', async () => {
    const { createFolder, deleteFolder } = useNoteStore.getState();
    const folder = await createFolder('Temp');
    await deleteFolder(folder.id);
    const { folders } = useNoteStore.getState();
    expect(folders.find(f => f.id === folder.id)).toBeUndefined();
  });

  it('cannot delete system folders', async () => {
    const { deleteFolder } = useNoteStore.getState();
    await deleteFolder('all');
    const { folders } = useNoteStore.getState();
    expect(folders.find(f => f.id === 'all')).toBeDefined();
  });
});

describe('searchNotes', () => {
  it('finds notes by title content', async () => {
    const { addNote, searchNotes } = useNoteStore.getState();
    await addNote('A note about React Native development');
    const results = searchNotes('react');
    expect(results.length).toBeGreaterThan(0);
  });

  it('excludes archived notes from search', async () => {
    const { addNote, archiveNote, searchNotes } = useNoteStore.getState();
    const note = await addNote('Archived content searchable');
    await archiveNote(note.id);
    const results = searchNotes('Archived content');
    expect(results).toHaveLength(0);
  });

  it('returns empty array when no matches found', async () => {
    const { addNote, searchNotes } = useNoteStore.getState();
    await addNote('Some note');
    const results = searchNotes('zyxwvutsrqponmlkjihgfedcba');
    expect(results).toHaveLength(0);
  });
});

describe('loadData', () => {
  it('loads notes and folders from AsyncStorage', async () => {
    const storedData = {
      notes: [{ id: 'test-1', title: 'Loaded note', content: 'content', tags: [], folderIds: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), pinned: false, archived: false }],
      folders: [],
      settings: { theme: 'light', defaultSort: 'newest', recentSearches: [] },
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(storedData));

    const { loadData } = useNoteStore.getState();
    await loadData();

    const { notes, settings } = useNoteStore.getState();
    expect(notes).toHaveLength(1);
    expect(notes[0].id).toBe('test-1');
    expect(settings.theme).toBe('light');
  });

  it('falls back to defaults when AsyncStorage has no data', async () => {
    const { loadData } = useNoteStore.getState();
    await loadData();
    const { notes, isLoading } = useNoteStore.getState();
    expect(notes).toHaveLength(0);
    expect(isLoading).toBe(false);
  });

  it('normalizes an invalid theme value to "dark"', async () => {
    const storedData = {
      notes: [],
      folders: [],
      settings: { theme: 'invalid-theme', defaultSort: 'newest', recentSearches: [] },
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(storedData));

    const { loadData } = useNoteStore.getState();
    await loadData();

    const { settings } = useNoteStore.getState();
    expect(settings.theme).toBe('dark');
  });

  it('sets storageError when AsyncStorage.getItem throws', async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('Storage error'));
    const { loadData } = useNoteStore.getState();
    await loadData();
    const { storageError } = useNoteStore.getState();
    expect(storageError).not.toBeNull();
  });
});

describe('updateSettings', () => {
  it('updates theme in settings', async () => {
    const { updateSettings } = useNoteStore.getState();
    await updateSettings({ theme: 'light' });
    const { settings } = useNoteStore.getState();
    expect(settings.theme).toBe('light');
  });

  it('persists settings to AsyncStorage', async () => {
    const { updateSettings } = useNoteStore.getState();
    await updateSettings({ theme: 'system', defaultSort: 'az' });
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = JSON.parse(stored!);
    expect(parsed.settings.theme).toBe('system');
    expect(parsed.settings.defaultSort).toBe('az');
  });
});

describe('clearAllData', () => {
  it('resets notes and folders to defaults', async () => {
    const { addNote, clearAllData } = useNoteStore.getState();
    await addNote('Will be cleared');
    await clearAllData();
    const { notes } = useNoteStore.getState();
    expect(notes).toHaveLength(0);
  });

  it('removes data from AsyncStorage', async () => {
    const { addNote, clearAllData } = useNoteStore.getState();
    await addNote('Will be cleared');
    await clearAllData();
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    expect(stored).toBeNull();
  });
});

describe('getNoteById', () => {
  it('returns note by id', async () => {
    const { addNote, getNoteById } = useNoteStore.getState();
    const note = await addNote('Findable note');
    const found = getNoteById(note.id);
    expect(found).toBeDefined();
    expect(found?.id).toBe(note.id);
  });

  it('returns undefined for missing id', () => {
    const { getNoteById } = useNoteStore.getState();
    expect(getNoteById('nonexistent')).toBeUndefined();
  });
});

describe('findNoteByUrl', () => {
  it('finds a non-archived note by URL', async () => {
    const { addNote, findNoteByUrl } = useNoteStore.getState();
    await addNote('https://example.com great site');
    const found = findNoteByUrl('https://example.com');
    expect(found).toBeDefined();
  });

  it('returns undefined for archived notes', async () => {
    const { addNote, archiveNote, findNoteByUrl } = useNoteStore.getState();
    const note = await addNote('https://example.com great site');
    await archiveNote(note.id);
    const found = findNoteByUrl('https://example.com');
    expect(found).toBeUndefined();
  });
});

describe('getNotesForFolder', () => {
  it('returns notes belonging to a folder', async () => {
    const { addNote, createFolder, moveNoteToFolder, getNotesForFolder } = useNoteStore.getState();
    const note = await addNote('Folder note');
    const folder = await createFolder('MyFolder');
    await moveNoteToFolder(note.id, folder.id);
    const results = getNotesForFolder(folder.id);
    expect(results.some(n => n.id === note.id)).toBe(true);
  });

  it('excludes archived notes from non-archived folders', async () => {
    const { addNote, archiveNote, createFolder, moveNoteToFolder, getNotesForFolder } = useNoteStore.getState();
    const note = await addNote('Will be archived');
    const folder = await createFolder('TestFolder');
    await moveNoteToFolder(note.id, folder.id);
    await archiveNote(note.id);
    const results = getNotesForFolder(folder.id);
    expect(results.some(n => n.id === note.id)).toBe(false);
  });

  it('includes archived notes when viewing the archived folder', async () => {
    const { addNote, archiveNote, getNotesForFolder } = useNoteStore.getState();
    const note = await addNote('Archived');
    await archiveNote(note.id);
    const results = getNotesForFolder('archived');
    expect(results.some(n => n.id === note.id)).toBe(true);
  });

  it('returns empty array for nonexistent folder id', () => {
    const { getNotesForFolder } = useNoteStore.getState();
    expect(getNotesForFolder('nonexistent-folder')).toHaveLength(0);
  });
});

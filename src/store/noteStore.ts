import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Note, SmartFolder, AppSettings } from '../types';
import {
  extractTags, extractUrl, extractTitle, detectPlatform,
  assignEmoji, getFolderColor,
} from '../utils/smartOrganizer';

export const STORAGE_KEY = '@forward_data_v1';

function buildSystemFolders(): SmartFolder[] {
  const createdAt = new Date().toISOString();
  return [
    {
      id: 'all',
      name: 'All Notes',
      emoji: '📝',
      noteIds: [],
      createdAt,
      isSystem: true,
      color: '#7C6FE0',
    },
    {
      id: 'pinned',
      name: 'Pinned',
      emoji: '📌',
      noteIds: [],
      createdAt,
      isSystem: true,
      color: '#FF6584',
    },
    {
      id: 'archived',
      name: 'Archived',
      emoji: '🗑️',
      noteIds: [],
      createdAt,
      isSystem: true,
      color: '#FF9800',
    },
  ];
}

function buildDefaultSettings(): AppSettings {
  return {
    theme: 'dark',
    defaultSort: 'newest',
    recentSearches: [],
  };
}

function normalizeDefaultSort(value: unknown): AppSettings['defaultSort'] {
  return value === 'oldest' || value === 'az' || value === 'newest' ? value : 'newest';
}

function normalizeTheme(value: unknown): AppSettings['theme'] {
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'dark';
}

interface NoteStore {
  notes: Note[];
  folders: SmartFolder[];
  settings: AppSettings;
  isLoading: boolean;
  storageError: string | null;

  // Actions
  loadData: () => Promise<void>;
  addNote: (content: string, color?: string) => Promise<Note>;
  editNote: (id: string, updates: Partial<Note>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  togglePin: (id: string) => Promise<void>;
  createFolder: (name: string) => Promise<SmartFolder>;
  deleteFolder: (id: string) => Promise<void>;
  moveNoteToFolder: (noteId: string, folderId: string) => Promise<void>;
  removeNoteFromFolder: (noteId: string, folderId: string) => Promise<void>;
  archiveNote: (id: string) => Promise<void>;
  restoreNote: (id: string) => Promise<void>;
  getArchivedNotes: () => Note[];
  searchNotes: (query: string) => Note[];
  updateSettings: (updates: Partial<AppSettings>) => Promise<void>;
  clearAllData: () => Promise<void>;
  dismissStorageError: () => void;
  getNoteById: (id: string) => Note | undefined;
  getFolderById: (id: string) => SmartFolder | undefined;
  getNotesForFolder: (folderId: string) => Note[];
  findNoteByUrl: (url: string) => Note | undefined;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export const useNoteStore = create<NoteStore>((set, get) => ({
  notes: [],
  folders: buildSystemFolders(),
  settings: buildDefaultSettings(),
  isLoading: true,
  storageError: null,

  loadData: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const { notes, folders, settings } = JSON.parse(raw);
        const storedSettings = settings || {};
        set({
          notes: notes || [],
          folders: folders || buildSystemFolders(),
          settings: {
            theme: normalizeTheme(storedSettings.theme),
            defaultSort: normalizeDefaultSort(storedSettings.defaultSort),
            recentSearches: storedSettings.recentSearches || [],
          },
          isLoading: false,
          storageError: null,
        });
      } else {
        set({ isLoading: false, storageError: null });
      }
    } catch (error) {
      console.error('[noteStore] Failed to load data', error);
      set({
        notes: [],
        folders: buildSystemFolders(),
        settings: buildDefaultSettings(),
        isLoading: false,
        storageError: 'Saved data could not be loaded. Forward started with a fresh local library.',
      });
    }
  },

  addNote: async (content: string, color?: string) => {
    const url = extractUrl(content);
    const platform = url ? detectPlatform(url) : 'manual';
    const { tags, folders: detectedFolderNames } = extractTags(content);
    const title = extractTitle(content, platform);
    const now = new Date().toISOString();

    const note: Note = {
      id: generateId(),
      title,
      content,
      url,
      platform,
      tags,
      folderIds: [],
      createdAt: now,
      updatedAt: now,
      pinned: false,
      color,
      archived: false,
    };

    const state = get();
    let updatedFolders = [...state.folders];

    // Assign to smart folders
    const folderIds: string[] = [];
    for (const folderName of detectedFolderNames) {
      let folder = updatedFolders.find(
        f => f.name.toLowerCase() === folderName.toLowerCase() && !f.isSystem
      );
      if (!folder) {
        folder = {
          id: generateId(),
          name: folderName,
          emoji: assignEmoji(folderName),
          noteIds: [],
          createdAt: now,
          isSystem: false,
          color: getFolderColor(folderName),
        };
        updatedFolders.push(folder);
      }
      if (!folder.noteIds.includes(note.id)) {
        folder = { ...folder, noteIds: [...folder.noteIds, note.id] };
        updatedFolders = updatedFolders.map(f => (f.id === folder!.id ? folder! : f));
      }
      folderIds.push(folder.id);
    }

    // Update "All Notes" system folder
    updatedFolders = updatedFolders.map(f =>
      f.id === 'all' ? { ...f, noteIds: [...f.noteIds, note.id] } : f
    );

    note.folderIds = folderIds;
    const updatedNotes = [note, ...state.notes];

    set({ notes: updatedNotes, folders: updatedFolders });
    await persist(updatedNotes, updatedFolders, state.settings);
    return note;
  },

  editNote: async (id, updates) => {
    const state = get();
    if (!state.notes.some(n => n.id === id)) return;
    const updatedNotes = state.notes.map(n =>
      n.id === id ? { ...n, ...updates, updatedAt: new Date().toISOString() } : n
    );
    set({ notes: updatedNotes });
    await persist(updatedNotes, state.folders, state.settings);
  },

  deleteNote: async (id) => {
    const state = get();
    const updatedNotes = state.notes.filter(n => n.id !== id);
    const updatedFolders = state.folders.map(f => ({
      ...f,
      noteIds: f.noteIds.filter(nid => nid !== id),
    }));
    set({ notes: updatedNotes, folders: updatedFolders });
    await persist(updatedNotes, updatedFolders, state.settings);
  },

  togglePin: async (id) => {
    const state = get();
    const note = state.notes.find(n => n.id === id);
    if (!note) return;

    const updatedNotes = state.notes.map(n =>
      n.id === id ? { ...n, pinned: !n.pinned, updatedAt: new Date().toISOString() } : n
    );

    let updatedFolders = state.folders;
    if (!note.pinned) {
      updatedFolders = updatedFolders.map(f =>
        f.id === 'pinned' ? { ...f, noteIds: [...f.noteIds, id] } : f
      );
    } else {
      updatedFolders = updatedFolders.map(f =>
        f.id === 'pinned' ? { ...f, noteIds: f.noteIds.filter(nid => nid !== id) } : f
      );
    }

    set({ notes: updatedNotes, folders: updatedFolders });
    await persist(updatedNotes, updatedFolders, state.settings);
  },

  createFolder: async (name) => {
    const state = get();
    const existing = state.folders.find(f => f.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing;

    const folder: SmartFolder = {
      id: generateId(),
      name,
      emoji: assignEmoji(name),
      noteIds: [],
      createdAt: new Date().toISOString(),
      isSystem: false,
      color: getFolderColor(name),
    };

    const updatedFolders = [...state.folders, folder];
    set({ folders: updatedFolders });
    await persist(state.notes, updatedFolders, state.settings);
    return folder;
  },

  deleteFolder: async (id) => {
    const state = get();
    const folder = state.folders.find(f => f.id === id);
    if (!folder || folder.isSystem) return;

    const updatedNotes = state.notes.map(n => ({
      ...n,
      folderIds: n.folderIds.filter(fid => fid !== id),
    }));
    const updatedFolders = state.folders.filter(f => f.id !== id);
    set({ notes: updatedNotes, folders: updatedFolders });
    await persist(updatedNotes, updatedFolders, state.settings);
  },

  moveNoteToFolder: async (noteId, folderId) => {
    const state = get();
    const updatedNotes = state.notes.map(n =>
      n.id === noteId && !n.folderIds.includes(folderId)
        ? { ...n, folderIds: [...n.folderIds, folderId] }
        : n
    );
    const updatedFolders = state.folders.map(f =>
      f.id === folderId && !f.noteIds.includes(noteId)
        ? { ...f, noteIds: [...f.noteIds, noteId] }
        : f
    );
    set({ notes: updatedNotes, folders: updatedFolders });
    await persist(updatedNotes, updatedFolders, state.settings);
  },

  removeNoteFromFolder: async (noteId, folderId) => {
    const state = get();
    const updatedNotes = state.notes.map(n =>
      n.id === noteId ? { ...n, folderIds: n.folderIds.filter(fid => fid !== folderId) } : n
    );
    const updatedFolders = state.folders.map(f =>
      f.id === folderId ? { ...f, noteIds: f.noteIds.filter(nid => nid !== noteId) } : f
    );
    set({ notes: updatedNotes, folders: updatedFolders });
    await persist(updatedNotes, updatedFolders, state.settings);
  },

  archiveNote: async (id) => {
    const state = get();
    const note = state.notes.find(n => n.id === id);
    if (!note) return;
    const updatedNotes = state.notes.map(n =>
      n.id === id ? { ...n, archived: true, pinned: false, archivedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } : n
    );
    const updatedFolders = state.folders.map(f => {
      if (f.id === 'archived' && !f.noteIds.includes(id)) {
        return { ...f, noteIds: [...f.noteIds, id] };
      }
      // Remove from system folders when archiving (including pinned)
      if (f.isSystem && f.id !== 'archived' && f.noteIds.includes(id)) {
        return { ...f, noteIds: f.noteIds.filter(nid => nid !== id) };
      }
      // Also remove from custom folders when archiving
      if (!f.isSystem && f.noteIds.includes(id)) {
        return { ...f, noteIds: f.noteIds.filter(nid => nid !== id) };
      }
      return f;
    });
    set({ notes: updatedNotes, folders: updatedFolders });
    await persist(updatedNotes, updatedFolders, state.settings);
  },

  restoreNote: async (id) => {
    const state = get();
    const note = state.notes.find(n => n.id === id);
    if (!note) return;

    const updatedNotes = state.notes.map(n => {
      if (n.id !== id) return n;
      return { ...n, archived: false, archivedAt: undefined, updatedAt: new Date().toISOString() };
    });
    const updatedFolders = state.folders.map(f => {
      if (f.id === 'archived') {
        return { ...f, noteIds: f.noteIds.filter(nid => nid !== id) };
      }
      // Add back to "All Notes" on restore
      if (f.id === 'all' && !f.noteIds.includes(id)) {
        return { ...f, noteIds: [...f.noteIds, id] };
      }
      // Restore to custom folders that note belongs to
      if (!f.isSystem && note.folderIds.includes(f.id) && !f.noteIds.includes(id)) {
        return { ...f, noteIds: [...f.noteIds, id] };
      }
      // Restore to pinned folder if note was pinned
      if (f.id === 'pinned' && note.pinned && !f.noteIds.includes(id)) {
        return { ...f, noteIds: [...f.noteIds, id] };
      }
      return f;
    });
    set({ notes: updatedNotes, folders: updatedFolders });
    await persist(updatedNotes, updatedFolders, state.settings);
  },

  getArchivedNotes: () => get().notes.filter(n => n.archived),

  searchNotes: (query) => {
    const lower = query.toLowerCase();
    return get().notes.filter(
      n =>
        !n.archived &&
        (n.title.toLowerCase().includes(lower) ||
        n.content.toLowerCase().includes(lower) ||
        n.tags.some(t => t.includes(lower)) ||
        (n.url ? n.url.toLowerCase().includes(lower) : false))
    );
  },

  updateSettings: async (updates) => {
    const state = get();
    const updatedSettings = { ...state.settings, ...updates };
    set({ settings: updatedSettings });
    await persist(state.notes, state.folders, updatedSettings);
  },

  clearAllData: async () => {
    const nextFolders = buildSystemFolders();
    const nextSettings = buildDefaultSettings();
    set({
      notes: [],
      folders: nextFolders,
      settings: nextSettings,
      storageError: null,
    });
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('[noteStore] Failed to clear data', error);
      set({
        storageError: 'Forward reset on screen, but local storage could not be fully cleared.',
      });
    }
  },

  dismissStorageError: () => set({ storageError: null }),

  getNoteById: (id) => get().notes.find(n => n.id === id),
  getFolderById: (id) => get().folders.find(f => f.id === id),
  getNotesForFolder: (folderId) => {
    const { notes, folders } = get();
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return [];
    // Filter out archived notes unless viewing the archived folder
    return notes.filter(n => folder.noteIds.includes(n.id) && (folderId === 'archived' || !n.archived));
  },
  findNoteByUrl: (url) => {
    return get().notes.find(n => !n.archived && n.url === url);
  },
}));

async function persist(notes: Note[], folders: SmartFolder[], settings: AppSettings) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ notes, folders, settings }));
    useNoteStore.setState({ storageError: null });
  } catch (error) {
    console.error('[noteStore] Failed to persist data', error);
    useNoteStore.setState({
      storageError: 'Your latest changes could not be saved locally. Keep the app open and try again.',
    });
  }
}

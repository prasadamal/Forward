import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Note, SmartFolder, AppSettings } from '../types';
import {
  extractTags, extractUrl, extractTitle, detectPlatform,
  assignEmoji, getFolderColor,
} from '../utils/smartOrganizer';

const STORAGE_KEY = '@forward_data_v1';

const SYSTEM_FOLDERS: SmartFolder[] = [
  {
    id: 'all',
    name: 'All Notes',
    emoji: '📝',
    noteIds: [],
    createdAt: new Date().toISOString(),
    isSystem: true,
    color: '#7C6FE0',
  },
  {
    id: 'pinned',
    name: 'Pinned',
    emoji: '📌',
    noteIds: [],
    createdAt: new Date().toISOString(),
    isSystem: true,
    color: '#FF6584',
  },
  {
    id: 'archived',
    name: 'Archived',
    emoji: '🗑️',
    noteIds: [],
    createdAt: new Date().toISOString(),
    isSystem: true,
    color: '#FF9800',
  },
];

interface NoteStore {
  notes: Note[];
  folders: SmartFolder[];
  settings: AppSettings;
  isLoading: boolean;

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
  folders: SYSTEM_FOLDERS,
  settings: { theme: 'dark', defaultView: 'notes', defaultSort: 'newest', recentSearches: [] },
  isLoading: true,

  loadData: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const { notes, folders, settings } = JSON.parse(raw);
        const s = settings || {};
        set({
          notes: notes || [],
          folders: folders || SYSTEM_FOLDERS,
          settings: {
            theme: s.theme || 'dark',
            defaultView: s.defaultView || 'notes',
            defaultSort: s.defaultSort || 'newest',
            recentSearches: s.recentSearches || [],
          },
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
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
    const updatedNotes = state.notes.map(n =>
      n.id === id ? { ...n, archived: true, archivedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } : n
    );
    const updatedFolders = state.folders.map(f => {
      if (f.id === 'archived' && !f.noteIds.includes(id)) {
        return { ...f, noteIds: [...f.noteIds, id] };
      }
      // Remove from other system folders when archiving
      if (f.isSystem && f.id !== 'archived' && f.noteIds.includes(id)) {
        return { ...f, noteIds: f.noteIds.filter(nid => nid !== id) };
      }
      return f;
    });
    set({ notes: updatedNotes, folders: updatedFolders });
    await persist(updatedNotes, updatedFolders, state.settings);
  },

  restoreNote: async (id) => {
    const state = get();
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
        n.tags.some(t => t.includes(lower)))
    );
  },

  updateSettings: async (updates) => {
    const state = get();
    const updatedSettings = { ...state.settings, ...updates };
    set({ settings: updatedSettings });
    await persist(state.notes, state.folders, updatedSettings);
  },

  getNoteById: (id) => get().notes.find(n => n.id === id),
  getFolderById: (id) => get().folders.find(f => f.id === id),
  getNotesForFolder: (folderId) => {
    const { notes, folders } = get();
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return [];
    return notes.filter(n => folder.noteIds.includes(n.id));
  },
  findNoteByUrl: (url) => {
    return get().notes.find(n => !n.archived && n.url === url);
  },
}));

async function persist(notes: Note[], folders: SmartFolder[], settings: AppSettings) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ notes, folders, settings }));
  } catch {
    // ignore persist errors silently
  }
}

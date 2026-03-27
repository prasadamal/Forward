export type Platform = 'youtube' | 'instagram' | 'twitter' | 'reddit' | 'web' | 'manual';

export interface Note {
  id: string;
  title: string;
  content: string;
  url?: string;
  platform?: Platform;
  thumbnail?: string;
  tags: string[];
  folderIds: string[];
  createdAt: string;
  updatedAt: string;
  pinned: boolean;
  color?: string;
  archived: boolean;
  archivedAt?: string;
}

export interface SmartFolder {
  id: string;
  name: string;
  emoji: string;
  noteIds: string[];
  createdAt: string;
  isSystem: boolean;
  color: string;
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  defaultView: 'notes' | 'folders';
}

export type RootTabParamList = {
  Home: undefined;
  Folders: undefined;
  Search: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  MainTabs: undefined;
  NoteDetail: { noteId: string };
  FolderDetail: { folderId: string };
  AddNote: { initialContent?: string; initialUrl?: string };
  EditNote: { noteId: string };
};

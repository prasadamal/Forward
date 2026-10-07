import { NavigatorScreenParams } from '@react-navigation/native';
import { ItemType } from '../types';

/** Virtual folders shown alongside real ones. */
export const INBOX = '@inbox';
export const PINNED = '@pinned';
export const TRASH = '@trash';
export type VirtualFolderId = typeof INBOX | typeof PINNED | typeof TRASH;

export type TabParamList = {
  Home: undefined;
  Folders: undefined;
  Wallet: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  Folder: { folderId: string };
  Item: { itemId: string };
  EditItem: { itemId?: string; type?: ItemType; folderId?: string };
  Forwarded: { shareId: string };
  Search: undefined;
  FolderEdit: { folderId?: string; parentId?: string | null };
  ImageViewer: { itemId: string };
  VideoPlayer: { itemId: string };
  Backup: undefined;
  ChangePasscode: undefined;
  Privacy: undefined;
};
